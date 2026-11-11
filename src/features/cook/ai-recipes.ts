import { z } from "zod";
import { UNITS, type PantryItem, type Unit } from "@/features/pantry/model";
import { ingredientKey, sameIngredient } from "./names";
import type { RecipeDraft } from "./recipes";

/** Most distinct pantry entries sent in one request. */
export const MAX_PANTRY_LINES = 80;
export const MAX_IDEAS = 3;

export type PantryLine = { name: string; quantity: number; unit: Unit };

/**
 * The only thing that leaves the device for AI ideas: ingredient names with quantities and units, merged per
 * name and unit. No dates, places, notes, ids or anything about the person.
 */
export function pantrySummary(items: readonly PantryItem[]): PantryLine[] {
  const merged = new Map<string, PantryLine>();
  for (const i of items) {
    if (!(i.quantity > 0) || !UNITS.includes(i.unit as Unit)) continue;
    const key = `${ingredientKey(i.name)}|${i.unit}`;
    const line = merged.get(key);
    if (line) line.quantity = Math.round((line.quantity + i.quantity) * 1000) / 1000;
    else merged.set(key, { name: i.name.trim().slice(0, 80), quantity: i.quantity, unit: i.unit as Unit });
  }
  return [...merged.values()].slice(0, MAX_PANTRY_LINES);
}

export const SYSTEM_PROMPT =
  `You suggest simple home-cooking recipes from the ingredients a person has. Suggest exactly ${MAX_IDEAS} different recipes ` +
  "that use mostly the ingredients given (basic staples like water, salt and pepper may be added). " +
  `Use only these units: ${UNITS.join(", ")}. Use the ingredient names exactly as given when you use them. ` +
  "Do not give nutrition numbers. " +
  'Reply with ONLY a JSON object: {"recipes":[{"title":"...","servings":2,"ingredients":[{"name":"...","quantity":200,"unit":"g"}],"steps":["..."]}]}.';

export const userPrompt = (lines: readonly PantryLine[]) => `Ingredients I have:\n${JSON.stringify(lines)}`;

export const recipeSchema = z.object({
  title: z.string().trim().min(1).max(120),
  servings: z.number().positive().max(50),
  minutes: z.number().int().positive().max(1440).optional(),
  ingredients: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        quantity: z.number().positive().max(100000),
        unit: z.enum(UNITS),
      }),
    )
    .min(1)
    .max(40),
  steps: z.array(z.string().trim().min(1).max(600)).min(1).max(30),
});

export type AiRecipe = z.infer<typeof recipeSchema>;

/** The valid recipes of a model answer (at most three). Anything that does not fit the format is dropped. */
export function parseAiRecipes(value: unknown): AiRecipe[] {
  const list = (value as { recipes?: unknown } | null)?.recipes;
  if (!Array.isArray(list)) return [];
  const out: AiRecipe[] = [];
  for (const entry of list) {
    const parsed = recipeSchema.safeParse(entry);
    if (parsed.success) out.push(parsed.data);
    if (out.length === MAX_IDEAS) break;
  }
  return out;
}

/**
 * A draft to review and save. Ingredients that match a pantry item by name take the pantry's name and link to it;
 * the rest keep the model's wording. Numbers for nutrition are never taken from the model.
 */
export function aiDraft(recipe: AiRecipe, items: readonly PantryItem[]): RecipeDraft {
  return {
    title: recipe.title,
    servings: recipe.servings,
    steps: recipe.steps.join("\n"),
    source: "ai",
    ingredients: recipe.ingredients.map((ing) => {
      const match = items.find((i) => i.quantity > 0 && sameIngredient(i.name, ing.name));
      return match
        ? { name: match.name, quantity: ing.quantity, unit: ing.unit, pantry_item_id: match.id }
        : { name: ing.name, quantity: ing.quantity, unit: ing.unit, pantry_item_id: null };
    }),
  };
}
