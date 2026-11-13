import { expiryState } from "@/features/pantry/items";
import type { PantryItem, Unit } from "@/features/pantry/model";
import { sameIngredient } from "./names";
import { comparable, fromBase, toBase } from "./units";

/** One ingredient a recipe asks for. */
export type Need = { name: string; quantity: number; unit: Unit; pantry_item_id?: string | null };

/** Pantry items that can supply this ingredient: the linked item, or any item with the same name. */
export function matchingItems(need: Need, items: readonly PantryItem[]): PantryItem[] {
  return items.filter((i) => i.id === need.pantry_item_id || sameIngredient(i.name, need.name));
}

export type LineState =
  | "ok" // in the pantry: enough, or in a unit that cannot be compared (see `loose`)
  | "short" // some, but not enough
  | "missing"; // nothing with that name (or only used-up entries)

export type LineStatus = {
  need: Need;
  state: LineState;
  /** In the unit of the ingredient; 0 for "missing" and "unit". */
  have: number;
  /** Still needed, in the unit of the ingredient; 0 when enough. */
  short: number;
  /** The items that supply it. */
  items: PantryItem[];
  /**
   * True when it is in the pantry but in a unit that cannot be compared with the recipe's (2 pieces of salmon against
   * 500 g, 1 bunch of dill against a pack). Such an ingredient counts as in stock: it is never reported missing
   * because of its unit, and nothing is taken out of the pantry for it automatically.
   */
  loose: boolean;
};

const EPSILON = 1e-6;

export function lineStatus(need: Need, items: readonly PantryItem[], factor = 1): LineStatus {
  // used-up entries do not count as stock
  const named = matchingItems(need, items).filter((i) => i.quantity > 0);
  const usable = named.filter((i) => comparable(i.unit, need.unit));
  const wanted = need.quantity * factor;
  if (!usable.length) {
    // something with that name exists, but in a unit that cannot be compared: in stock, amount unknown
    if (named.length) return { need, state: "ok", have: 0, short: 0, items: [], loose: true };
    return { need, state: "missing", have: 0, short: wanted, items: [], loose: false };
  }
  const have = fromBase(
    usable.reduce((sum, i) => sum + toBase(i.quantity, i.unit), 0),
    need.unit,
  );
  const enough = have + EPSILON >= wanted;
  return { need, state: enough ? "ok" : "short", have, short: enough ? 0 : wanted - have, items: usable, loose: false };
}

/** What to show for an ingredient that is not fully covered: "Flour" or "Eggs (4 pieces more)". */
export function missingText(line: LineStatus): string {
  if (line.state === "short") return `${line.need.name} (${Math.round(line.short * 1000) / 1000} ${line.need.unit} more)`;
  return line.need.name;
}

export type RecipeLike = { id: string; title: string };

export type Candidate<R extends RecipeLike> = {
  recipe: R;
  lines: LineStatus[];
  /** The lines that are not fully covered. */
  missing: LineStatus[];
  /** How many ingredients are supplied by an item that expires soon. */
  expiringUsed: number;
  /** The earliest "soon" expiry date among the items used, if any. */
  firstExpiry: string | null;
};

/** Most missing ingredients a recipe may have to be suggested. */
export const MAX_MISSING = 2;

/**
 * Recipes you can cook now or with one or two ingredients missing. Complete ones come first, then "missing 1", then
 * "missing 2"; inside each group, recipes that use items expiring soon come first.
 */
export function rankRecipes<R extends RecipeLike>(
  recipes: readonly R[],
  needs: ReadonlyMap<string, readonly Need[]>,
  items: readonly PantryItem[],
  today: Date,
): Candidate<R>[] {
  const out: Candidate<R>[] = [];
  for (const recipe of recipes) {
    const list = needs.get(recipe.id) ?? [];
    if (!list.length) continue;
    const lines = list.map((n) => lineStatus(n, items));
    const missing = lines.filter((l) => l.state !== "ok");
    if (missing.length > MAX_MISSING) continue;
    const soon = lines.map((l) => l.items.filter((i) => expiryState(i.expires_on, today) === "soon"));
    const dates = soon.flat().flatMap((i) => (i.expires_on ? [i.expires_on] : [])).sort();
    out.push({
      recipe,
      lines,
      missing,
      expiringUsed: soon.filter((s) => s.length > 0).length,
      firstExpiry: dates[0] ?? null,
    });
  }
  return out.sort(
    (a, b) =>
      a.missing.length - b.missing.length ||
      b.expiringUsed - a.expiringUsed ||
      (a.firstExpiry ?? "9999").localeCompare(b.firstExpiry ?? "9999") ||
      a.recipe.title.localeCompare(b.recipe.title),
  );
}
