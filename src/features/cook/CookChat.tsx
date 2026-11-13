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
import { readChatEvents, type ChatEvent } from "./chat-stream";
import { CookScreen } from "./CookScreen";
import { cook, recipesQuery, useInvalidateCook } from "./data";
import { recipeNutrition, type NutritionRow } from "./nutrition";
import { RecipeCard } from "./RecipeCard";
import { isStaple } from "./suggestions";
import { groupByRecipe, toDrafts } from "./recipes";

type Message = { id: number; role: "user" | "assistant"; text: string; cards?: AiRecipe[]; error?: boolean; streaming?: boolean };
type Cooking = { recipe: { id: string; title: string; servings: number }; needs: Need[] };

type Props = {
  settings: PantrySettings;
  items: readonly PantryItem[];
  nutrition: readonly NutritionRow[];
  onOpenSettings: () => void;
};

const EXAMPLES = ["What can I cook with what I have?", "Something high in protein, no oven", "Dinner in 20 minutes"];

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
    const history = messages.filter((m) => !m.error && !m.streaming).map((m) => ({ role: m.role, content: m.text }));
    // Take the ids here, not inside the updater: React may run an updater twice (StrictMode in dev).
    const userId = next.current++;
    const answerId = next.current++;
    setMessages((all) => [...all, { id: userId, role: "user", text: clean }, { id: answerId, role: "assistant", text: "", streaming: true }]);
    setText("");
    setBusy(true);
    const patch = (change: Partial<Message>) => setMessages((all) => all.map((m) => (m.id === answerId ? { ...m, ...change } : m)));
    let last: ChatEvent | null = null;
    try {
      const res = await ask({ data: { turns: [...history, { role: "user", content: clean }] } });
      let shown = "";
      await readChatEvents(res.body, (e) => {
        if (e.type === "text") {
          shown += e.delta;
          patch({ text: shown });
        } else last = e;
      });
    } catch {
      last = { type: "error", error: "The AI request failed — please try again." };
    }
    const end = last as ChatEvent | null;
    if (end?.type === "done") {
      patch({ text: end.reply, cards: end.cards, streaming: false });
      try {
        if (end.saved.length) await invalidate();
        if (end.cook) await openCook(end.cook);
        await qc.invalidateQueries({ queryKey: ["pantry", "settings"] });
      } catch {
        toast.error("Could not refresh your recipes.");
      }
    } else {
      patch({ text: end?.type === "error" ? end.error : "The AI request failed — please try again.", error: true, streaming: false });
    }
    setBusy(false);
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
      <div className="space-y-3 tile p-6 text-center">
        <p className="text-sm text-muted-foreground">AI cooking chat is off.</p>
        <Button className="h-11" onClick={onOpenSettings}>
          Turn it on in Settings
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      {!messages.length && (
        <div className="space-y-2">
          {EXAMPLES.map((e) => (
            <button key={e} type="button" className="tile press flex min-h-13 w-full items-center gap-3 px-4 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => void send(e)}>
              {e}
            </button>
          ))}
        </div>
      )}
      <ul className="space-y-3" aria-live="polite">
        {messages.map((m) => (
          <li key={m.id} className={m.role === "user" ? "flex justify-end" : "space-y-3"}>
            {m.role === "user" ? (
              <p className="max-w-[85%] rounded-3xl rounded-br-lg bg-primary px-4 py-2.5 text-[15px] text-primary-foreground">{m.text}</p>
            ) : (
              <>
                {m.streaming && !m.text ? (
                  <p role="status" aria-label="Thinking" className="inline-flex items-center gap-1 rounded-3xl rounded-bl-lg border bg-card px-4 py-3.5" data-typing>
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 motion-reduce:animate-none" style={{ animationDelay: `${i * 150}ms` }} />
                    ))}
                  </p>
                ) : (
                  <p role={m.error ? "alert" : undefined} aria-busy={m.streaming || undefined} className={m.error ? "w-fit max-w-[92%] rounded-3xl rounded-bl-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-[15px] text-destructive" : "w-fit max-w-[92%] rounded-3xl rounded-bl-lg border bg-card px-4 py-2.5 text-[15px] leading-relaxed"}>
                    {m.text}
                  </p>
                )}
                {m.cards?.map((card, i) => (
                  <IdeaCard key={`${m.id}-${i}`} recipe={card} items={items} nutrition={nutrition} onCook={setCooking} />
                ))}
              </>
            )}
          </li>
        ))}
      </ul>
      <div ref={end} className="flex-1" />
      <form
        className="sticky bottom-[5rem] z-10 flex gap-2 rounded-full border bg-card p-1.5 shadow-pop"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        <Input aria-label="Ask what to cook" placeholder="What can I cook in 30 minutes?" className="h-11 rounded-full border-0 bg-transparent text-base focus-visible:ring-0 sm:text-sm" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} />
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
  // water, salt and pepper are assumed to be at home (the same rule the check in suggestions.ts uses)
  const missing = lines.filter((l) => l.state !== "ok" && !isStaple(l.need.name));
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

  return (
    <RecipeCard
      className="shadow-pop"
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
