import type { PantryItem } from "@/features/pantry/model";
import type { AiRecipe } from "./ai-recipes";
import { lineStatus, type LineStatus } from "./can-cook";
import { sameIngredient } from "./names";

/** How many recipes the AI proposes at a time. */
export const SUGGESTION_COUNT = 5;
/** At least this many of them must be cookable with what is in the pantry. */
export const MIN_COOKABLE = 3;
/** At most this many may need extra products ... */
export const MAX_NEAR = SUGGESTION_COUNT - MIN_COOKABLE;
/** ... and each of those at most this many. */
export const MAX_MISSING_PRODUCTS = 2;

/** Water, salt and pepper are assumed to be at home: they never make a recipe "not cookable" (the prompt says so too). */
const STAPLES = ["water", "salt", "pepper"];
export const isStaple = (name: string): boolean => STAPLES.some((s) => sameIngredient(name, s));

/** What the check needs of a pantry entry: the chat only sends name, quantity and unit. */
export type StockLine = Pick<PantryItem, "name" | "quantity" | "unit">;

/** Stock lines as pantry items for `lineStatus`: only name, quantity and unit are read, the rest is filler. */
function asItems(stock: readonly StockLine[]): PantryItem[] {
  return stock.map(
    (s, i) =>
      ({
        id: `stock-${i}`,
        user_id: "",
        name: s.name,
        quantity: s.quantity,
        unit: s.unit,
        category: "other",
        location_id: null,
        added_at: "",
        expires_on: null,
        note: null,
        icon: null,
        shelf: null,
      }) as PantryItem,
  );
}

/** The ingredients of a recipe that the stock does not cover (water, salt and pepper are not counted). */
export function missingFor(recipe: AiRecipe, stock: readonly StockLine[]): LineStatus[] {
  const items = asItems(stock);
  return recipe.ingredients
    .filter((i) => !isStaple(i.name))
    .map((i) => lineStatus({ name: i.name, quantity: i.quantity, unit: i.unit }, items))
    .filter((l) => l.state !== "ok");
}

export type Rated = { recipe: AiRecipe; missing: LineStatus[] };

export type Selection = {
  /** What to show, cookable ones first. At most 5, at most 2 that need extra products. */
  cards: AiRecipe[];
  cookable: number;
  /** Shown recipes that need products: 1 or 2 of them at most, each missing at most 2. */
  near: number;
  /** Recipes left out because they miss more than 2 products, or there was no room. */
  dropped: Rated[];
  /** True when the rule holds: with 5 proposed, at least 3 are cookable. Fewer than 5 proposed is always fine. */
  satisfied: boolean;
};

/**
 * Applies the rule to what the AI proposed, in code (the prompt asks for it too, but a model can ignore a prompt):
 * of 5 recipes at least 3 must be cookable with the stock; 1 or 2 may miss at most 2 products. Recipes missing more
 * are dropped. When fewer than 5 are proposed nothing is held back except recipes missing more than 2 products
 * once there are 5 or more to choose from.
 */
export function selectSuggestions(proposed: readonly AiRecipe[], stock: readonly StockLine[]): Selection {
  const rated: Rated[] = proposed.map((recipe) => ({ recipe, missing: missingFor(recipe, stock) }));
  if (proposed.length < SUGGESTION_COUNT) {
    // not a full set: show what the AI sent (the cards label what is missing), nothing to enforce
    return { cards: rated.map((r) => r.recipe), cookable: rated.filter((r) => !r.missing.length).length, near: rated.filter((r) => r.missing.length).length, dropped: [], satisfied: true };
  }
  const cookable = rated.filter((r) => r.missing.length === 0);
  const near = rated.filter((r) => r.missing.length > 0 && r.missing.length <= MAX_MISSING_PRODUCTS).sort((a, b) => a.missing.length - b.missing.length);
  const tooFar = rated.filter((r) => r.missing.length > MAX_MISSING_PRODUCTS);

  // all cookable ones first (up to 5); the rest of the 5 slots, at most 2, go to the ones that need extra products
  const cookTake = Math.min(cookable.length, SUGGESTION_COUNT);
  const nearTake = Math.min(near.length, MAX_NEAR, SUGGESTION_COUNT - cookTake);
  const shownCook = cookable.slice(0, cookTake);
  const shownNear = near.slice(0, nearTake);
  const dropped = [...cookable.slice(cookTake), ...near.slice(nearTake), ...tooFar];
  return {
    cards: [...shownCook, ...shownNear].map((r) => r.recipe),
    cookable: shownCook.length,
    near: shownNear.length,
    dropped,
    satisfied: cookable.length >= MIN_COOKABLE,
  };
}

const names = (lines: readonly LineStatus[]) => lines.map((l) => l.need.name).join(", ");

/** What to tell the model when the set breaks the rule, so it can send better ones. */
export function feedbackFor(sel: Selection, proposedCount: number): string {
  const bad = sel.dropped.filter((d) => d.missing.length > 0);
  const lines = bad.slice(0, 6).map((d) => `"${d.recipe.title}" misses ${names(d.missing)}`);
  return (
    `Only ${sel.cookable} of the ${proposedCount} recipes can be cooked with the stock. At least ${MIN_COOKABLE} of ${SUGGESTION_COUNT} must use only items from the stock ` +
    `(use the stock's names, and never more than the stock has), and at most ${MAX_NEAR} may need up to ${MAX_MISSING_PRODUCTS} products that are not in stock. ` +
    (lines.length ? `Not cookable: ${lines.join("; ")}. ` : "") +
    "Call suggest_recipes again with replacements that fit (the recipes that are fine are kept)."
  );
}

/** A short note for the person when, after retries, fewer than 3 recipes could be cooked from the stock. */
export function shortfallNote(sel: Selection): string {
  return sel.cookable === 0
    ? "I couldn't find a recipe you can cook with what you have right now."
    : `Only ${sel.cookable} of these ${sel.cookable === 1 ? "is" : "are"} cookable with what you have; the others need extra products.`;
}
