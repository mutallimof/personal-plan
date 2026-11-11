import { z } from "zod";
import { daysUntil } from "@/features/pantry/items";
import { UNITS, type PantryItem, type Unit } from "@/features/pantry/model";
import { recipeSchema, type AiRecipe } from "./ai-recipes";
import { ingredientKey } from "./names";

/** Most pantry lines, saved-recipe titles and chat turns that ever go into one request. */
export const MAX_SUMMARY_LINES = 80;
export const MAX_RECIPE_TITLES = 40;
export const MAX_TURNS = 10;
export const MAX_TURN_CHARS = 1000;
export const MAX_CARDS = 3;

/** One pantry entry as the model sees it. Nothing else about an item ever leaves the device. */
export type SummaryLine = { name: string; quantity: number; unit: Unit; expires_in_days?: number };

/**
 * The compact pantry summary for the chat: names, quantities, units and days until expiry, merged per name and unit.
 * No places, notes, ids, dates of purchase or anything about the person. Items that are used up are left out.
 */
export function chatSummary(items: readonly PantryItem[], today: Date): SummaryLine[] {
  const merged = new Map<string, SummaryLine>();
  for (const i of items) {
    if (!(i.quantity > 0) || !UNITS.includes(i.unit as Unit) || !i.name.trim()) continue;
    const days = i.expires_on ? daysUntil(i.expires_on, today) : null;
    const key = `${ingredientKey(i.name)}|${i.unit}`;
    const line = merged.get(key);
    if (line) {
      line.quantity = Math.round((line.quantity + i.quantity) * 1000) / 1000;
      if (days !== null && (line.expires_in_days === undefined || days < line.expires_in_days)) line.expires_in_days = days;
    } else {
      merged.set(key, {
        name: i.name.trim().slice(0, 80),
        quantity: i.quantity,
        unit: i.unit as Unit,
        ...(days !== null ? { expires_in_days: days } : {}),
      });
    }
  }
  return [...merged.values()].slice(0, MAX_SUMMARY_LINES);
}

export type SavedRecipe = { id: string; title: string };

export type ChatTurn = { role: "user" | "assistant"; content: string };

/** Keeps only well-formed user and assistant turns, the latest few, each cut short. The first turn is always the user's. */
export function cleanTurns(value: unknown): ChatTurn[] {
  if (!Array.isArray(value)) return [];
  const turns: ChatTurn[] = [];
  for (const v of value) {
    const o = v as Record<string, unknown> | null;
    if (!o || (o["role"] !== "user" && o["role"] !== "assistant") || typeof o["content"] !== "string") continue;
    const content = o["content"].trim().slice(0, MAX_TURN_CHARS);
    if (content) turns.push({ role: o["role"], content });
  }
  const last = turns.slice(-MAX_TURNS);
  while (last.length && last[0]?.role !== "user") last.shift();
  return last;
}

/** Saved recipes as id and title only, whatever the browser sent. */
export function cleanRecipes(value: unknown): SavedRecipe[] {
  if (!Array.isArray(value)) return [];
  const out: SavedRecipe[] = [];
  for (const v of value) {
    const o = v as Record<string, unknown> | null;
    if (o && typeof o["id"] === "string" && typeof o["title"] === "string" && o["title"].trim()) {
      out.push({ id: o["id"].slice(0, 64), title: o["title"].trim().slice(0, 120) });
    }
  }
  return out.slice(0, MAX_RECIPE_TITLES);
}

export const SYSTEM_PROMPT = [
  "You are a cooking helper inside a pantry app. You suggest simple home-cooking recipes from what the person has.",
  "Use the tools: search_pantry to look something up, suggest_recipes to show 1 to 3 recipe cards, save_recipe only when the person asks to save, cook_recipe only when the person wants to cook a saved recipe now (they confirm on screen), add_to_shopping_list only when asked.",
  `Use only these units: ${UNITS.join(", ")}. Use the pantry's ingredient names exactly when you use them. Basic staples (water, salt, pepper) may be added.`,
  "Never give calories or protein: the app computes them from the person's own table. Keep any text short.",
].join(" ");

/** The context message: the compact pantry summary and the saved recipe titles. */
export function contextPrompt(pantry: readonly SummaryLine[], recipes: readonly SavedRecipe[], today: Date): string {
  return [
    `Today is ${today.toISOString().slice(0, 10)}.`,
    `Pantry (name, quantity, unit, days until expiry when known): ${JSON.stringify(pantry)}`,
    `Saved recipes (id, title): ${JSON.stringify(recipes)}`,
  ].join("\n");
}

const unit = z.enum(UNITS);

const searchArgs = z.object({
  query: z.string().trim().max(80).optional(),
  expiring_within_days: z.number().int().min(0).max(365).optional(),
});
const suggestArgs = z.object({ recipes: z.array(z.unknown()).min(1).max(10) });
const saveArgs = z.object({ recipe: recipeSchema });
const cookArgs = z.object({ recipe_id: z.string().trim().min(1).max(64) });
const shopArgs = z.object({
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        quantity: z.number().positive().max(100000).optional(),
        unit: unit.optional(),
      }),
    )
    .min(1)
    .max(30),
});

export type ShoppingEntry = { name: string; quantity?: number | undefined; unit?: Unit | undefined };

export type ToolCallData =
  | { name: "search_pantry"; query: string; expiringWithinDays: number | null }
  | { name: "suggest_recipes"; recipes: AiRecipe[] }
  | { name: "save_recipe"; recipe: AiRecipe }
  | { name: "cook_recipe"; recipeId: string }
  | { name: "add_to_shopping_list"; items: ShoppingEntry[] };

export type Validated = { ok: true; call: ToolCallData } | { ok: false; error: string };

const bad = (error: string): Validated => ({ ok: false, error });
const why = (e: z.ZodError) => e.issues.slice(0, 3).map((i) => `${i.path.join(".") || "arguments"}: ${i.message}`).join("; ");

/** Parses the argument text of a tool call: a JSON object, or null for anything else. Empty text means no arguments. */
export function parseArguments(raw: string | undefined): Record<string, unknown> | null {
  if (!raw || !raw.trim()) return {};
  try {
    const v: unknown = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Checks one tool call from the model. Nothing reaches the database or the screen without passing this. */
export function validateToolCall(name: string, args: Record<string, unknown>): Validated {
  switch (name) {
    case "search_pantry": {
      const r = searchArgs.safeParse(args);
      return r.success ? { ok: true, call: { name, query: r.data.query ?? "", expiringWithinDays: r.data.expiring_within_days ?? null } } : bad(why(r.error));
    }
    case "suggest_recipes": {
      const r = suggestArgs.safeParse(args);
      if (!r.success) return bad(why(r.error));
      const recipes: AiRecipe[] = [];
      for (const entry of r.data.recipes) {
        const one = recipeSchema.safeParse(entry);
        if (one.success) recipes.push(one.data);
        if (recipes.length === MAX_CARDS) break;
      }
      return recipes.length ? { ok: true, call: { name, recipes } } : bad("None of the recipes had a title, servings, ingredients with name, quantity and unit, and steps.");
    }
    case "save_recipe": {
      const r = saveArgs.safeParse(args);
      return r.success ? { ok: true, call: { name, recipe: r.data.recipe } } : bad(why(r.error));
    }
    case "cook_recipe": {
      const r = cookArgs.safeParse(args);
      return r.success ? { ok: true, call: { name, recipeId: r.data.recipe_id } } : bad(why(r.error));
    }
    case "add_to_shopping_list": {
      const r = shopArgs.safeParse(args);
      return r.success ? { ok: true, call: { name, items: r.data.items } } : bad(why(r.error));
    }
    default:
      return bad(`Unknown tool "${name.slice(0, 40)}".`);
  }
}

/** What search_pantry returns: lines matching the words, optionally only those expiring soon. */
export function searchSummary(lines: readonly SummaryLine[], query: string, expiringWithinDays: number | null): SummaryLine[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return lines.filter((l) => {
    const text = l.name.toLowerCase();
    const named = words.every((w) => text.includes(w) || text.includes(ingredientKey(w)));
    const soon = expiringWithinDays === null || (l.expires_in_days !== undefined && l.expires_in_days <= expiringWithinDays);
    return named && soon;
  });
}

/** Recipes from the text of a model reply that ignored the tools: a JSON object with a "recipes" list, maybe in fences. */
export function recipesFromText(text: string): AiRecipe[] {
  const t = text.replace(/```(?:json)?/gi, "");
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end <= start) return [];
  try {
    const value = JSON.parse(t.slice(start, end + 1)) as { recipes?: unknown };
    const list = Array.isArray(value?.recipes) ? value.recipes : [];
    const out: AiRecipe[] = [];
    for (const entry of list) {
      const r = recipeSchema.safeParse(entry);
      if (r.success) out.push(r.data);
      if (out.length === MAX_CARDS) break;
    }
    return out;
  } catch {
    return [];
  }
}

/** Tool definitions for the provider. */
const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties, required });
const recipeShape = obj(
  {
    title: { type: "string" },
    servings: { type: "number" },
    minutes: { type: "integer", description: "Total time in minutes" },
    ingredients: {
      type: "array",
      items: obj({ name: { type: "string" }, quantity: { type: "number" }, unit: { type: "string", enum: [...UNITS] } }, ["name", "quantity", "unit"]),
    },
    steps: { type: "array", items: { type: "string" } },
  },
  ["title", "servings", "ingredients", "steps"],
);

export const CHAT_TOOLS = [
  {
    name: "search_pantry",
    description: "Look through the person's pantry. Optional words to match and optional days: only items expiring within that many days.",
    parameters: obj({ query: { type: "string" }, expiring_within_days: { type: "integer" } }),
  },
  {
    name: "suggest_recipes",
    description: "Show 1 to 3 recipe ideas as cards. Do not include calories or protein.",
    parameters: obj({ recipes: { type: "array", items: recipeShape } }, ["recipes"]),
  },
  { name: "save_recipe", description: "Save a recipe to the person's recipe book. Only when they ask.", parameters: obj({ recipe: recipeShape }, ["recipe"]) },
  {
    name: "cook_recipe",
    description: "Open the cooking confirmation for a saved recipe (by its id). The person confirms amounts there; nothing is removed before.",
    parameters: obj({ recipe_id: { type: "string" } }, ["recipe_id"]),
  },
  {
    name: "add_to_shopping_list",
    description: "Add things to the shopping list. Only when asked.",
    parameters: obj(
      { items: { type: "array", items: obj({ name: { type: "string" }, quantity: { type: "number" }, unit: { type: "string", enum: [...UNITS] } }, ["name"]) } },
      ["items"],
    ),
  },
].map((t) => ({ type: "function" as const, ...t }));
