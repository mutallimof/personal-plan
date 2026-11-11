import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PantryItem } from "@/features/pantry/model";
import type { PantrySettings } from "@/features/pantry/data";
import { aiDraft, type AiRecipe } from "./ai-recipes";
import { lineStatus, missingText, type Need } from "./can-cook";
import { cookChat } from "./chat.functions";
import { CookScreen } from "./CookScreen";
import { cook, recipesQuery, shopping, useInvalidateCook } from "./data";
import { recipeNutrition, type NutritionRow } from "./nutrition";
import { RecipeCard } from "./RecipeCard";
import { groupByRecipe, toDrafts } from "./recipes";

type Message = { id: number; role: "user" | "assistant"; text: string; cards?: AiRecipe[]; error?: boolean };
type Cooking = { recipe: { id: string; title: string; servings: number }; needs: Need[] };

type Props = {
  settings: PantrySettings;
  items: readonly PantryItem[];
  nutrition: readonly NutritionRow[];
  onOpenSettings: () => void;
};

const EXAMPLES = ["What can I cook with what I have?", "Something high in protein, no oven", "Use up what expires soon"];

/** Talk to the AI about what to cook. Off until the person turns it on in Settings. */
export function CookChat({ settings, items, nutrition, onOpenSettings }: Props) {
  const ask = useServerFn(cookChat);
  const qc = useQueryClient();
  const invalidate = useInvalidateCook();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooking, setCooking] = useState<Cooking | null>(null);
  const next = useRef(1);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "end" });
  }, [messages, busy]);

  async function openCook(recipeId: string) {
    const book = await qc.fetchQuery({ ...recipesQuery, staleTime: 0 });
    const recipe = book.recipes.find((r) => r.id === recipeId);
    if (!recipe) return;
    setCooking({ recipe, needs: toDrafts(groupByRecipe(book.ingredients).get(recipeId) ?? []) });
  }

  async function send(message: string) {
    const clean = message.trim();
    if (!clean || busy) return;
    const history = messages.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.text }));
    setMessages((all) => [...all, { id: next.current++, role: "user", text: clean }]);
    setText("");
    setBusy(true);
    try {
      const res = await ask({ data: { turns: [...history, { role: "user", content: clean }] } });
      if (res.ok) {
        setMessages((all) => [...all, { id: next.current++, role: "assistant", text: res.reply, cards: res.cards }]);
        if (res.saved.length || res.shopping.length) await invalidate();
        if (res.cook) await openCook(res.cook);
      } else {
        setMessages((all) => [...all, { id: next.current++, role: "assistant", text: res.error, error: true }]);
      }
      await qc.invalidateQueries({ queryKey: ["pantry", "settings"] });
    } catch {
      setMessages((all) => [...all, { id: next.current++, role: "assistant", text: "The AI request failed — please try again.", error: true }]);
    } finally {
      setBusy(false);
    }
  }

  async function undo(id: string) {
    try {
      await cook.undoCook(id);
      await invalidate();
      toast.success("Put back in your pantry");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not undo");
    }
  }

  if (cooking) {
    return (
      <CookScreen
        recipe={cooking.recipe}
        needs={cooking.needs}
        items={items}
        nutrition={nutrition}
        onCancel={() => setCooking(null)}
        onCooked={(id, title) => {
          setCooking(null);
          toast.success(`Cooked ${title}`, { duration: 15_000, action: { label: "Undo", onClick: () => void undo(id) } });
        }}
      />
    );
  }

  if (!settings.aiChat) {
    return (
      <div className="space-y-3 rounded-2xl bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">AI cooking chat is off.</p>
        <Button className="h-11" onClick={onOpenSettings}>
          Turn it on in Settings
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!messages.length && (
        <div className="space-y-2">
          {EXAMPLES.map((e) => (
            <button key={e} type="button" className="flex min-h-11 w-full items-center rounded-2xl bg-card px-4 text-left text-sm" onClick={() => void send(e)}>
              {e}
            </button>
          ))}
        </div>
      )}
      <ul className="space-y-3" aria-live="polite">
        {messages.map((m) => (
          <li key={m.id} className={m.role === "user" ? "flex justify-end" : "space-y-3"}>
            {m.role === "user" ? (
              <p className="max-w-[85%] rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground">{m.text}</p>
            ) : (
              <>
                <p role={m.error ? "alert" : undefined} className={m.error ? "rounded-2xl bg-card px-4 py-2 text-sm text-destructive" : "rounded-2xl bg-card px-4 py-2 text-sm"}>
                  {m.text}
                </p>
                {m.cards?.map((card, i) => (
                  <IdeaCard key={`${m.id}-${i}`} recipe={card} items={items} nutrition={nutrition} onCook={setCooking} />
                ))}
              </>
            )}
          </li>
        ))}
      </ul>
      {busy && (
        <p role="status" className="text-sm text-muted-foreground">
          Thinking…
        </p>
      )}
      <div ref={end} />
      <form
        className="sticky bottom-0 flex gap-2 bg-background pb-2 pt-1"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        <Input aria-label="Ask what to cook" placeholder="What can I cook in 30 minutes?" className="h-11 text-base sm:text-sm" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} />
        <Button type="submit" size="icon" className="h-11 w-11 shrink-0" aria-label="Send" disabled={busy || !text.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

type CardProps = { recipe: AiRecipe; items: readonly PantryItem[]; nutrition: readonly NutritionRow[]; onCook: (c: Cooking) => void };

/** One recipe idea. Calories and protein come from the nutrition table; ingredients without a row are labeled as missing. */
function IdeaCard({ recipe, items, nutrition, onCook }: CardProps) {
  const invalidate = useInvalidateCook();
  const draft = useMemo(() => aiDraft(recipe, items), [recipe, items]);
  const lines = useMemo(() => draft.ingredients.map((i) => lineStatus(i, items)), [draft, items]);
  const missing = lines.filter((l) => l.state !== "ok");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(): Promise<string | null> {
    if (savedId) return savedId;
    setBusy(true);
    try {
      const id = await cook.saveRecipe(draft);
      setSavedId(id);
      await invalidate();
      return id;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function addMissing() {
    try {
      await shopping.add(missing.map((l) => ({ name: l.need.name, quantity: l.short || l.need.quantity, unit: l.need.unit })));
      await invalidate();
      toast.success("Added to your shopping list");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add");
    }
  }

  return (
    <RecipeCard
      className="bg-background ring-1 ring-border"
      title={recipe.title}
      servings={recipe.servings}
      facts={recipeNutrition(draft.ingredients, nutrition, recipe.servings)}
      missing={missing}
      actions={
        <>
          <Button
            className="h-11"
            disabled={busy}
            onClick={async () => {
              const id = await save();
              if (id) onCook({ recipe: { id, title: recipe.title, servings: recipe.servings }, needs: draft.ingredients });
            }}
          >
            Cook this
          </Button>
          <Button variant="outline" className="h-11" disabled={busy || !!savedId} onClick={() => void save()}>
            {savedId ? "Saved" : "Save recipe"}
          </Button>
          {missing.length > 0 && (
            <Button variant="outline" className="h-11" onClick={() => void addMissing()}>
              Add missing to list
            </Button>
          )}
        </>
      }
    >
      {recipe.minutes ? <p className="text-sm text-muted-foreground">{recipe.minutes} min</p> : null}
      <details className="text-sm">
        <summary className="min-h-8 cursor-pointer font-medium">Ingredients and steps</summary>
        <ul className="mt-2 space-y-1">
          {lines.map((l, i) => (
            <li key={i} className={l.state === "ok" ? "" : "text-muted-foreground"}>
              {l.need.quantity} {l.need.unit} {l.need.name}
              {l.state === "ok" ? " — have" : ` — ${missingText(l).replace(l.need.name, "").trim() || "missing"}`}
            </li>
          ))}
        </ul>
        <ol className="mt-3 list-decimal space-y-1 pl-5">
          {recipe.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </details>
    </RecipeCard>
  );
}
