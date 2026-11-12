import { z } from "zod";
import { UNITS, type PantryItem, type Unit } from "@/features/pantry/model";
import { recipeSchema, type AiRecipe } from "./ai-recipes";
import { MAX_MISSING_PRODUCTS, MAX_NEAR, MIN_COOKABLE, SUGGESTION_COUNT } from "./suggestions";
import { ingredientKey, ingredientTokens, sameIngredient } from "./names";

/** Most pantry lines, saved-recipe titles and chat turns that ever go into one request. */
export const MAX_SUMMARY_LINES = 80;
export const MAX_RECIPE_TITLES = 40;
export const MAX_TURNS = 10;
export const MAX_TURN_CHARS = 1000;
/** Recipe cards shown at once: the AI proposes this many (see `suggestions.ts` for the rule they must follow). */
export const MAX_CARDS = SUGGESTION_COUNT;
/** Most recipes read from one answer: a few more than are shown, so the check can pick the ones that fit the stock. */
export const MAX_PROPOSED = 8;

/** One pantry entry as the model sees it: name, quantity, unit. Nothing else about an item ever leaves the device. */
export type SummaryLine = { name: string; quantity: number; unit: Unit };

/**
 * The compact stock list for the chat: name, quantity and unit, merged per name and unit. No expiry dates, places,
 * notes, ids or anything about the person. Items that are used up are left out.
 */
export function chatSummary(items: readonly Pick<PantryItem, "name" | "quantity" | "unit">[], limit = MAX_SUMMARY_LINES): SummaryLine[] {
  const merged = new Map<string, SummaryLine>();
  for (const i of items) {
    if (!(i.quantity > 0) || !UNITS.includes(i.unit as Unit) || !i.name.trim()) continue;
    const key = `${ingredientKey(i.name)}|${i.unit}`;
    const line = merged.get(key);
    if (line) line.quantity = Math.round((line.quantity + i.quantity) * 1000) / 1000;
    else merged.set(key, { name: i.name.trim().slice(0, 80), quantity: Math.round(i.quantity * 1000) / 1000, unit: i.unit as Unit });
  }
  return [...merged.values()].slice(0, limit);
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
  "You are a cooking helper inside a pantry app. Suggest simple home-cooking recipes from the stock you are given.",
  "Use the tools: search_pantry to look something up, suggest_recipes to show 5 recipe cards in one call, save_recipe only when the person asks to save, cook_recipe only when the person wants to cook a saved recipe now (they confirm on screen).",
  "You cannot change the shopping list; the person keeps it by hand. If something is missing, just say what it is.",
  `Use only these units: ${UNITS.join(", ")}. Use the stock's ingredient names exactly when you use them. Basic staples (water, salt, pepper) may be added.`,
  `When asked for ideas, send exactly ${SUGGESTION_COUNT} recipes in ONE suggest_recipes call: at least ${MIN_COOKABLE} must be cookable with the stock alone (use the stock's names, never more than the stock has; water, salt and pepper may be added), and at most ${MAX_NEAR} may need up to ${MAX_MISSING_PRODUCTS} products that are not in stock. The app checks this and sends recipes back that do not fit.`,
  "Never give calories or protein: the app computes them. Put recipes in suggest_recipes, not in the text; keep the text to one or two short sentences.",
].join(" ");

/** The context message: the stock as one short line per item ("Chicken breast 500 g") and the saved recipes. */
export function contextPrompt(pantry: readonly SummaryLine[], recipes: readonly SavedRecipe[]): string {
  const stock = pantry.length ? pantry.map((l) => `${l.name} ${l.quantity} ${l.unit}`).join("; ") : "nothing";
  const lines = [`Stock: ${stock}`];
  if (recipes.length) lines.push(`Saved recipes (id: title): ${recipes.map((r) => `${r.id}: ${r.title}`).join("; ")}`);
  return lines.join("\n");
}

const unit = z.enum(UNITS);

const searchArgs = z.object({ query: z.string().trim().max(80).optional() });
const suggestArgs = z.object({ recipes: z.array(z.unknown()).min(1).max(10) });
const saveArgs = z.object({ recipe: recipeSchema });
const cookArgs = z.object({ recipe_id: z.string().trim().min(1).max(64) });
export type ToolCallData =
  | { name: "search_pantry"; query: string }
  | { name: "suggest_recipes"; recipes: AiRecipe[] }
  | { name: "save_recipe"; recipe: AiRecipe }
  | { name: "cook_recipe"; recipeId: string };

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
      return r.success ? { ok: true, call: { name, query: r.data.query ?? "" } } : bad(why(r.error));
    }
    case "suggest_recipes": {
      const r = suggestArgs.safeParse(args);
      if (!r.success) return bad(why(r.error));
      const recipes: AiRecipe[] = [];
      for (const entry of r.data.recipes) {
        const one = recipeSchema.safeParse(entry);
        if (one.success) recipes.push(one.data);
        if (recipes.length === MAX_PROPOSED) break;
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
    default:
      return bad(`Unknown tool "${name.slice(0, 40)}".`);
  }
}

/** What search_pantry returns: the stock lines matching all the words. */
export function searchSummary(lines: readonly SummaryLine[], query: string): SummaryLine[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return lines.filter((l) => words.every((w) => sameIngredient(l.name, w) || l.name.toLowerCase().includes(w) || ingredientTokens(l.name).includes(ingredientTokens(w)[0] ?? "")));
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
      if (out.length === MAX_PROPOSED) break;
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
    description: "Look through the person's stock. Optional words to match.",
    parameters: obj({ query: { type: "string" } }),
  },
  {
    name: "suggest_recipes",
    description: "Show recipe ideas as cards: send 5 in one call (at least 3 must be cookable with the stock, at most 2 may need up to 2 products that are not in stock). Do not include calories or protein.",
    parameters: obj({ recipes: { type: "array", items: recipeShape } }, ["recipes"]),
  },
  { name: "save_recipe", description: "Save a recipe to the person's recipe book. Only when they ask.", parameters: obj({ recipe: recipeShape }, ["recipe"]) },
  {
    name: "cook_recipe",
    description: "Open the cooking confirmation for a saved recipe (by its id). The person confirms amounts there; nothing is removed before.",
    parameters: obj({ recipe_id: { type: "string" } }, ["recipe_id"]),
  },
].map((t) => ({ type: "function" as const, ...t }));
