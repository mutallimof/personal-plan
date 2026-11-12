import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { QuantityField } from "@/features/pantry/ui";
import type { PantryItem } from "@/features/pantry/model";
import type { Need } from "./can-cook";
import { changesFor, planLines, withAmount, type PlanLine } from "./cook-plan";
import { cook, useInvalidateCook } from "./data";
import { approxLabel, formatAmounts, recipeNutrition, scaleAmounts, type NutritionRow } from "./nutrition";
import { scaleIngredients } from "./recipes";

type Props = {
  recipe: { id: string; title: string; servings: number };
  needs: readonly Need[];
  items: readonly PantryItem[];
  nutrition: readonly NutritionRow[];
  /** Called with the new log id once the pantry has been updated. */
  onCooked: (logId: string, title: string) => void;
  onCancel: () => void;
};

/** The "Cook this" confirmation: every ingredient with the amount that will leave the pantry, all editable. */
export function CookScreen({ recipe, needs, items, nutrition, onCooked, onCancel }: Props) {
  const invalidate = useInvalidateCook();
  const [servings, setServings] = useState(String(recipe.servings));
  const count = Number(servings);
  const validServings = Number.isFinite(count) && count > 0;
  const factor = validServings ? count / recipe.servings : 1;
  // how many portions you eat of what you cook; the log counts only these
  const [eaten, setEaten] = useState("1");
  const portions = Number(eaten);
  const validPortions = Number.isFinite(portions) && portions > 0;
  const [lines, setLines] = useState<PlanLine[]>(() => planLines(needs, items, 1));
  const [busy, setBusy] = useState(false);

  // The nutrition of what is cooked: the recipe scaled to the chosen servings, per serving times servings.
  const facts = useMemo(
    () => recipeNutrition(scaleIngredients(needs, factor), nutrition, validServings ? count : recipe.servings),
    [needs, factor, nutrition, validServings, count, recipe.servings],
  );
  const changes = useMemo(() => changesFor(lines, items), [lines, items]);

  function changeServings(text: string) {
    setServings(text);
    const n = Number(text);
    // New servings give new amounts; edits made to single rows start over.
    if (Number.isFinite(n) && n > 0) setLines(planLines(needs, items, n / recipe.servings));
  }

  const update = (id: string, patch: (l: PlanLine) => PlanLine) => setLines((all) => all.map((l) => (l.id === id ? patch(l) : l)));

  async function confirm() {
    if (!validServings || !validPortions) return;
    setBusy(true);
    try {
      const id = await cook.cookRecipe({
        recipeId: recipe.id,
        title: recipe.title,
        servings: count,
        nutrition: scaleAmounts(facts.perServing, portions),
        portions,
        missing: facts.missing.length,
        changes,
      });
      await invalidate();
      onCooked(id, recipe.title);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the pantry");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">{recipe.title}</h2>
        <p className="text-sm text-muted-foreground">
          {formatAmounts(facts.perServing)} per portion ({approxLabel(facts.missing.length)})
        </p>
      </div>

      <label className="tile flex items-center justify-between gap-3 py-2 pl-4 pr-2 text-sm font-medium">
        Servings
        <Input
          aria-label="Servings"
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          className="h-11 w-24 text-center text-base sm:text-sm"
          value={servings}
          onChange={(e) => changeServings(e.target.value)}
        />
      </label>

      <label className="tile flex items-center justify-between gap-3 py-2 pl-4 pr-2 text-sm font-medium">
        Portions I eat
        <Input
          aria-label="Portions I eat"
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          className="h-11 w-24 text-center text-base sm:text-sm"
          value={eaten}
          onChange={(e) => setEaten(e.target.value)}
        />
      </label>

      <ul className="space-y-2">
        {lines.map((l) => (
          <li key={l.id} className={cn("space-y-2 tile p-4", l.skip && "opacity-60")}>
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">{l.name}</span>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                Skip
                <Switch checked={l.skip} onCheckedChange={(skip) => update(l.id, (x) => ({ ...x, skip }))} aria-label={`Skip ${l.name}`} />
              </label>
            </div>
            {l.available <= 0 ? (
              <p className="text-sm text-muted-foreground">{l.loose ? "In your pantry, in another unit. Nothing is taken out." : "Not in your pantry"}</p>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div aria-label={`Amount of ${l.name}`} className="min-w-0 flex-1">
                    <QuantityField value={l.amount} unit={l.unit} onChange={(n) => update(l.id, (x) => withAmount(x, n))} />
                  </div>
                  <span className="w-12 shrink-0 text-sm text-muted-foreground">{l.unit}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Needs {l.wanted} {l.unit}, you have {l.available} {l.unit}
                </p>
              </>
            )}
          </li>
        ))}
      </ul>

      <Button size="lg" className="w-full" disabled={busy || !validServings || !validPortions} onClick={confirm}>
        Cook
      </Button>
      <Button variant="ghost" className="h-11 w-full" disabled={busy} onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
