import { z } from "zod";
import { UNITS } from "@/features/pantry/model";
import type { RecipeDraft } from "./recipes";

const item = z.object({
  title: z.string().trim().min(1).max(120),
  servings: z.number().positive().max(50).default(2),
  ingredients: z
    .array(z.object({ name: z.string().trim().min(1).max(120), quantity: z.number().positive().max(100000), unit: z.enum(UNITS) }))
    .min(1)
    .max(60),
  steps: z.union([z.string().max(10000), z.array(z.string().max(600)).max(60)]).default(""),
});

export type ImportResult = { drafts: RecipeDraft[]; skipped: number } | { error: string };

/**
 * Recipes from JSON text: a list, or an object with a "recipes" list. Each recipe has a title, optional servings
 * (default 2), ingredients with name, quantity and unit (g, kg, ml, l, pieces, pack) and steps as text or a list.
 * Recipes that do not fit are skipped and counted; nothing here touches the database.
 */
export function parseRecipeImport(text: string): ImportResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { error: "That file is not valid JSON." };
  }
  const list = Array.isArray(value) ? value : Array.isArray((value as { recipes?: unknown } | null)?.recipes) ? (value as { recipes: unknown[] }).recipes : null;
  if (!list) return { error: 'Expected a list of recipes, or an object with a "recipes" list.' };
  const drafts: RecipeDraft[] = [];
  let skipped = 0;
  for (const entry of list.slice(0, 200)) {
    const r = item.safeParse(entry);
    if (!r.success) {
      skipped++;
      continue;
    }
    drafts.push({
      title: r.data.title,
      servings: r.data.servings,
      steps: Array.isArray(r.data.steps) ? r.data.steps.join("\n") : r.data.steps,
      source: "manual",
      ingredients: r.data.ingredients.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit, pantry_item_id: null })),
    });
  }
  return drafts.length ? { drafts, skipped } : { error: "No usable recipes found in that file." };
}
