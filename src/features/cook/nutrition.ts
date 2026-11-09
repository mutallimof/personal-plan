import type { Unit } from "@/features/pantry/model";
import { ingredientKey } from "./names";
import { dimensionOf, toBase } from "./units";

/** What the numbers of a nutrition row refer to. */
export type NutritionBasis = "100g" | "100ml" | "piece";

export const BASIS_LABEL: Record<NutritionBasis, string> = { "100g": "per 100 g", "100ml": "per 100 ml", piece: "per piece" };

export const isBasis = (v: unknown): v is NutritionBasis => v === "100g" || v === "100ml" || v === "piece";

export type NutritionRow = { name: string; basis: NutritionBasis; kcal: number; protein_g: number };

/** The basis an ingredient's unit needs, or null for "pack" (a pack has no known weight). */
export function basisFor(unit: Unit): NutritionBasis | null {
  switch (dimensionOf(unit)) {
    case "mass":
      return "100g";
    case "volume":
      return "100ml";
    case "pieces":
      return "piece";
    default:
      return null;
  }
}

export type Ingredient = { name: string; quantity: number; unit: Unit };
export type Amounts = { kcal: number; protein_g: number };

/** Energy and protein of one ingredient line, or null when there is no matching row in the table. */
export function ingredientNutrition(ing: Ingredient, rows: readonly NutritionRow[]): Amounts | null {
  const basis = basisFor(ing.unit);
  if (!basis) return null;
  const key = ingredientKey(ing.name);
  const row = rows.find((r) => r.basis === basis && ingredientKey(r.name) === key);
  if (!row) return null;
  const times = basis === "piece" ? ing.quantity : toBase(ing.quantity, ing.unit) / 100;
  return { kcal: row.kcal * times, protein_g: row.protein_g * times };
}

export type RecipeNutrition = {
  /** Per serving, from the ingredients that have data. */
  perServing: Amounts;
  total: Amounts;
  /** Names of ingredients with no nutrition data; they are not in the numbers. */
  missing: string[];
};

export function recipeNutrition(ingredients: readonly Ingredient[], rows: readonly NutritionRow[], servings: number): RecipeNutrition {
  const total: Amounts = { kcal: 0, protein_g: 0 };
  const missing: string[] = [];
  for (const ing of ingredients) {
    const n = ingredientNutrition(ing, rows);
    if (!n) {
      missing.push(ing.name);
      continue;
    }
    total.kcal += n.kcal;
    total.protein_g += n.protein_g;
  }
  const s = servings > 0 ? servings : 1;
  return { total, perServing: { kcal: total.kcal / s, protein_g: total.protein_g / s }, missing };
}

/** "approx., 2 ingredients missing" or "approx." when every ingredient was found. Numbers from this table are always rough. */
export function approxLabel(missing: number): string {
  return missing === 0 ? "approx." : `approx., ${missing} ${missing === 1 ? "ingredient" : "ingredients"} missing`;
}

/** Whole kcal, protein with one decimal below 10 g. */
export const formatKcal = (n: number) => `${Math.round(n)} kcal`;
export const formatProtein = (n: number) => `${n < 10 ? (Math.round(n * 10) / 10).toString() : Math.round(n).toString()} g protein`;

/** Stored rows as nutrition rows; rows with an unknown basis are left out (the table does not allow them). */
export function toNutritionRows(rows: readonly { name: string; basis: string; kcal: number; protein_g: number }[]): NutritionRow[] {
  return rows.flatMap((r) => (isBasis(r.basis) ? [{ name: r.name, basis: r.basis, kcal: r.kcal, protein_g: r.protein_g }] : []));
}
