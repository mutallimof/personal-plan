import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { PantryItem } from "@/features/pantry/model";
import { UNITS, isUnit } from "@/features/pantry/model";
import { asOptions, Choice } from "@/features/pantry/ui";
import { cook, useInvalidateCook } from "./data";
import { cleanIngredients, draftProblems, linkIngredients, type RecipeDraft } from "./recipes";

type Props = {
  initial: RecipeDraft;
  /** Recipe being edited; omit for a new one. */
  recipeId?: string | undefined;
  /** Pantry items, used to suggest names and to link ingredients. */
  items: readonly PantryItem[];
  onSaved: () => void;
  onCancel: () => void;
};

type Row = { name: string; quantity: string; unit: string; pantry_item_id: string | null };

export function RecipeForm({ initial, recipeId, items, onSaved, onCancel }: Props) {
  const invalidate = useInvalidateCook();
  const [title, setTitle] = useState(initial.title);
  const [servings, setServings] = useState(String(initial.servings));
  const [stepsText, setStepsText] = useState(initial.steps);
  const [rows, setRows] = useState<Row[]>(
    initial.ingredients.map((i) => ({ name: i.name, quantity: String(i.quantity), unit: i.unit, pantry_item_id: i.pantry_item_id ?? null })),
  );
  const [busy, setBusy] = useState(false);
  const [showProblems, setShowProblems] = useState(false);

  const draft: RecipeDraft = {
    title,
    servings: Number(servings),
    steps: stepsText,
    source: initial.source,
    ingredients: rows.map((r) => ({
      name: r.name,
      quantity: Number(r.quantity),
      unit: isUnit(r.unit) ? r.unit : "g",
      pantry_item_id: r.pantry_item_id,
    })),
  };
  const problems = draftProblems(draft);

  const setRow = (i: number, patch: Partial<Row>) => setRows((all) => all.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  async function save() {
    if (problems.length) {
      setShowProblems(true);
      return;
    }
    setBusy(true);
    try {
      await cook.saveRecipe({ ...draft, ingredients: linkIngredients(cleanIngredients(draft.ingredients), items) }, recipeId);
      await invalidate();
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Input aria-label="Recipe name" placeholder="Recipe name" className="h-12 text-base sm:text-sm" value={title} onChange={(e) => setTitle(e.target.value)} />
      <label className="flex min-h-11 items-center justify-between gap-3 tile px-4 text-sm">
        Servings
        <Input
          aria-label="Servings"
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          className="h-11 w-24 text-center text-base sm:text-sm"
          value={servings}
          onChange={(e) => setServings(e.target.value)}
        />
      </label>

      <datalist id="pantry-names">
        {[...new Set(items.map((i) => i.name))].map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={i} className="space-y-2 tile p-3">
            <div className="flex gap-2">
              <Input
                aria-label={`Ingredient ${i + 1}`}
                placeholder="Ingredient"
                list="pantry-names"
                className="h-11 min-w-0 flex-1 text-base sm:text-sm"
                value={r.name}
                onChange={(e) => setRow(i, { name: e.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11 shrink-0"
                aria-label={`Remove ingredient ${i + 1}`}
                onClick={() => setRows((all) => all.filter((_, k) => k !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                aria-label={`Amount ${i + 1}`}
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                className="h-11 min-w-0 flex-1 text-base sm:text-sm"
                value={r.quantity}
                onChange={(e) => setRow(i, { quantity: e.target.value })}
              />
              <Choice className="w-28" label={`Unit ${i + 1}`} value={r.unit} onChange={(unit) => setRow(i, { unit })} options={asOptions(UNITS)} />
            </div>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full"
        onClick={() => setRows((all) => [...all, { name: "", quantity: "1", unit: "g", pantry_item_id: null }])}
      >
        <Plus className="mr-1 h-4 w-4" /> Add ingredient
      </Button>

      <Textarea
        aria-label="Steps"
        placeholder="Steps, one per line"
        className="min-h-32 tile text-base sm:text-sm"
        value={stepsText}
        onChange={(e) => setStepsText(e.target.value)}
      />

      {showProblems && problems.length > 0 && (
        <ul role="alert" className="space-y-1 text-sm text-destructive">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      <Button className="h-12 w-full" disabled={busy} onClick={save}>
        Save
      </Button>
      <Button variant="ghost" className="h-11 w-full" disabled={busy} onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
