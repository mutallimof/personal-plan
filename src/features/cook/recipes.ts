import { isUnit, type PantryItem, type Unit } from "@/features/pantry/model";
import { ingredientKey, sameIngredient } from "./names";

export type RecipeSource = "manual" | "ai";

export type IngredientDraft = {
  name: string;
  quantity: number;
  unit: Unit;
  /** Optional hint to one pantry item (matching by name works without it). */
  pantry_item_id?: string | null;
};

export type RecipeDraft = {
  title: string;
  servings: number;
  /** One step per line. */
  steps: string;
  source: RecipeSource;
  ingredients: IngredientDraft[];
};

export const emptyDraft = (): RecipeDraft => ({
  title: "",
  servings: 2,
  steps: "",
  source: "manual",
  ingredients: [{ name: "", quantity: 1, unit: "g" }],
});

/** What is wrong with a recipe, in plain words; empty when it can be saved. Blank ingredient rows are ignored. */
export function draftProblems(d: RecipeDraft): string[] {
  const out: string[] = [];
  if (!d.title.trim()) out.push("Give the recipe a name.");
  if (!(d.servings > 0)) out.push("Servings must be more than 0.");
  const rows = cleanIngredients(d.ingredients);
  if (!rows.length) out.push("Add at least one ingredient.");
  if (d.ingredients.some((i) => i.name.trim() && !(i.quantity > 0))) out.push("Every ingredient needs an amount above 0.");
  if (d.ingredients.some((i) => !isUnit(i.unit))) out.push("Pick a unit for every ingredient.");
  return out;
}

/** Drops blank rows and trims names. */
export function cleanIngredients(list: readonly IngredientDraft[]): IngredientDraft[] {
  return list.filter((i) => i.name.trim()).map((i) => ({ ...i, name: i.name.trim() }));
}

export function steps(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

type Searchable = { id: string; title: string };

/** Recipes whose title or any ingredient name contains every word of the query. */
export function searchRecipes<T extends Searchable>(
  recipes: readonly T[],
  ingredientNames: ReadonlyMap<string, readonly string[]>,
  query: string,
): T[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [...recipes];
  return recipes.filter((r) => {
    const text = [r.title, ...(ingredientNames.get(r.id) ?? [])].join(" ").toLowerCase();
    return words.every((w) => text.includes(w) || text.includes(ingredientKey(w)));
  });
}

/** Ingredient amounts for a different number of servings. */
export function scaleIngredients<T extends { quantity: number }>(list: readonly T[], factor: number): T[] {
  return list.map((i) => ({ ...i, quantity: Math.round(i.quantity * factor * 1000) / 1000 }));
}

/** Ingredient rows of all recipes grouped per recipe, in their saved order. */
export function groupByRecipe<T extends { recipe_id: string; position: number }>(list: readonly T[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of [...list].sort((a, b) => a.position - b.position)) out.set(row.recipe_id, [...(out.get(row.recipe_id) ?? []), row]);
  return out;
}

type StoredIngredient = { name: string; quantity: number; unit: string; pantry_item_id: string | null };

/** Stored ingredient rows as drafts. Rows with an unknown unit are left out (the table does not allow them). */
export function toDrafts(rows: readonly StoredIngredient[]): IngredientDraft[] {
  return rows.flatMap((r) => (isUnit(r.unit) ? [{ name: r.name, quantity: r.quantity, unit: r.unit, pantry_item_id: r.pantry_item_id }] : []));
}

/** Links each ingredient to the pantry item with the same name, if there is one; clears a link whose item no longer matches. */
export function linkIngredients(list: readonly IngredientDraft[], items: readonly PantryItem[]): IngredientDraft[] {
  return list.map((i) => {
    const linked = items.find((p) => p.id === i.pantry_item_id);
    if (linked && sameIngredient(linked.name, i.name)) return i;
    return { ...i, pantry_item_id: items.find((p) => sameIngredient(p.name, i.name))?.id ?? null };
  });
}
