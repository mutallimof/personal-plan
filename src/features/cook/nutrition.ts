import type { Unit } from "@/features/pantry/model";
import { ingredientKey } from "./names";
import { dimensionOf, toBase } from "./units";

/** What the numbers of a nutrition row refer to. */
export type NutritionBasis = "100g" | "100ml" | "piece";

export const BASIS_LABEL: Record<NutritionBasis, string> = { "100g": "per 100 g", "100ml": "per 100 ml", piece: "per piece" };

export const isBasis = (v: unknown): v is NutritionBasis => v === "100g" || v === "100ml" || v === "piece";

/** Carbohydrate and fat are optional: a row without them simply has no such numbers. */
export type NutritionRow = { name: string; basis: NutritionBasis; kcal: number; protein_g: number; carbs_g?: number | null; fat_g?: number | null };

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
/** Carbs and fat are null when the table does not have them for every ingredient that was found (no half sums). */
export type Amounts = { kcal: number; protein_g: number; carbs_g: number | null; fat_g: number | null };

/** Energy and protein of one ingredient line, or null when there is no matching row in the table. */
export function ingredientNutrition(ing: Ingredient, rows: readonly NutritionRow[]): Amounts | null {
  const basis = basisFor(ing.unit);
  if (!basis) return null;
  const key = ingredientKey(ing.name);
  const row = rows.find((r) => r.basis === basis && ingredientKey(r.name) === key);
  if (!row) return null;
  const times = basis === "piece" ? ing.quantity : toBase(ing.quantity, ing.unit) / 100;
  return {
    kcal: row.kcal * times,
    protein_g: row.protein_g * times,
    carbs_g: row.carbs_g == null ? null : row.carbs_g * times,
    fat_g: row.fat_g == null ? null : row.fat_g * times,
  };
}

export type RecipeNutrition = {
  /** Per serving, from the ingredients that have data. */
  perServing: Amounts;
  total: Amounts;
  /** Names of ingredients with no nutrition data; they are not in the numbers. */
  missing: string[];
};

export function recipeNutrition(ingredients: readonly Ingredient[], rows: readonly NutritionRow[], servings: number): RecipeNutrition {
  let kcal = 0;
  let protein_g = 0;
  let carbs_g: number | null = 0;
  let fat_g: number | null = 0;
  let found = 0;
  const missing: string[] = [];
  for (const ing of ingredients) {
    const n = ingredientNutrition(ing, rows);
    if (!n) {
      missing.push(ing.name);
      continue;
    }
    found++;
    kcal += n.kcal;
    protein_g += n.protein_g;
    carbs_g = carbs_g === null || n.carbs_g === null ? null : carbs_g + n.carbs_g;
    fat_g = fat_g === null || n.fat_g === null ? null : fat_g + n.fat_g;
  }
  if (!found) {
    carbs_g = null;
    fat_g = null;
  }
  const total: Amounts = { kcal, protein_g, carbs_g, fat_g };
  const s = servings > 0 ? servings : 1;
  return { total, perServing: scaleAmounts(total, 1 / s), missing };
}

/** Every amount times a factor (null stays null). */
export function scaleAmounts(a: Amounts, factor: number): Amounts {
  return {
    kcal: a.kcal * factor,
    protein_g: a.protein_g * factor,
    carbs_g: a.carbs_g === null ? null : a.carbs_g * factor,
    fat_g: a.fat_g === null ? null : a.fat_g * factor,
  };
}

/** "approx., 2 ingredients missing" or "approx." when every ingredient was found. Numbers from this table are always rough. */
export function approxLabel(missing: number): string {
  return missing === 0 ? "approx." : `approx., ${missing} ${missing === 1 ? "ingredient" : "ingredients"} missing`;
}

/** Whole kcal, protein with one decimal below 10 g. */
export const formatKcal = (n: number) => `${Math.round(n)} kcal`;
export const formatGrams = (n: number, what: string) => `${n < 10 ? (Math.round(n * 10) / 10).toString() : Math.round(n).toString()} g ${what}`;
export const formatProtein = (n: number) => `${n < 10 ? (Math.round(n * 10) / 10).toString() : Math.round(n).toString()} g protein`;

/** Stored rows as nutrition rows; rows with an unknown basis are left out (the table does not allow them). */
export function toNutritionRows(
  rows: readonly { name: string; basis: string; kcal: number; protein_g: number; carbs_g?: number | null; fat_g?: number | null }[],
): NutritionRow[] {
  return rows.flatMap((r) =>
    isBasis(r.basis) ? [{ name: r.name, basis: r.basis, kcal: r.kcal, protein_g: r.protein_g, carbs_g: r.carbs_g ?? null, fat_g: r.fat_g ?? null }] : [],
  );
}

/** "110 kcal · 23 g protein · 12 g carbs · 3 g fat": carbs and fat only when the table has them. */
export function formatAmounts(a: Amounts): string {
  const parts = [formatKcal(a.kcal), formatProtein(a.protein_g)];
  if (a.carbs_g !== null) parts.push(formatGrams(a.carbs_g, "carbs"));
  if (a.fat_g !== null) parts.push(formatGrams(a.fat_g, "fat"));
  return parts.join(" · ");
}
