import type { PantryItem, Unit } from "@/features/pantry/model";
import { lineStatus, type LineStatus } from "./can-cook";
import { sameIngredient } from "./names";

/** Something to put on the shopping list. */
export type ShoppingCandidate = { name: string; quantity: number | null; unit: Unit | null };

export type SkipReason = "in-stock" | "on-list" | "duplicate";
export type Skipped = { name: string; reason: SkipReason };

/** An entry already on the list. Entries ticked as bought do not count: you can need the food again. */
export type ListEntry = { name: string; done: boolean };

const REASON_TEXT: Record<SkipReason, string> = {
  "in-stock": "in stock",
  "on-list": "already on the list",
  duplicate: "listed twice",
};

/**
 * What "Add selected to shopping list" really adds. Each ticked ingredient is checked against the pantry as it is now
 * and against the list as it is now, by normalized name and synonyms (Sahne = Schlagsahne, Zitrone = Zitronen):
 * - in stock (enough, or in a unit that cannot be compared) -> skipped;
 * - already on the list (not yet bought) -> skipped;
 * - the same food ticked twice -> added once.
 * An ingredient that is only partly in stock is added with the amount that is still short.
 * This is the only way anything is added by the app: the list is otherwise typed in by hand.
 */
export function planShoppingAdd(
  selected: readonly LineStatus[],
  stock: readonly PantryItem[],
  list: readonly ListEntry[],
): { add: ShoppingCandidate[]; skipped: Skipped[] } {
  const add: ShoppingCandidate[] = [];
  const skipped: Skipped[] = [];
  for (const line of selected) {
    const name = line.need.name.trim();
    if (!name) continue;
    const now = lineStatus(line.need, stock);
    if (now.state === "ok") skipped.push({ name, reason: "in-stock" });
    else if (list.some((e) => !e.done && sameIngredient(e.name, name))) skipped.push({ name, reason: "on-list" });
    else if (add.some((a) => sameIngredient(a.name, name))) skipped.push({ name, reason: "duplicate" });
    else add.push({ name, quantity: round(now.state === "short" ? now.short : line.need.quantity), unit: line.need.unit });
  }
  return { add, skipped };
}

const round = (n: number): number | null => (n > 0 ? Math.round(n * 1000) / 1000 : null);

/** "Added 2. Skipped Dill (already on the list), Mehl (in stock)." */
export function describeAdd(added: number, skipped: readonly Skipped[]): string {
  const head = added ? `Added ${added} to your shopping list.` : "Nothing added.";
  if (!skipped.length) return head;
  return `${head} Skipped ${skipped.map((s) => `${s.name} (${REASON_TEXT[s.reason]})`).join(", ")}.`;
}
