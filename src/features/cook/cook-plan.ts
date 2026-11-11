import { roundQty } from "@/features/pantry/items";
import type { PantryItem, Unit } from "@/features/pantry/model";
import { lineStatus, type Need } from "./can-cook";
import { fromBase, toBase } from "./units";

/** One row of the "Cook this" confirmation: how much of an ingredient to take out of the pantry. */
export type PlanLine = {
  id: string;
  name: string;
  unit: Unit;
  /** What the recipe asks for, for the chosen number of servings. */
  wanted: number;
  /** What the pantry has of it, in `unit`. */
  available: number;
  /** What will be removed. Editable, never more than `available`. */
  amount: number;
  skip: boolean;
  /** The pantry items it is taken from. */
  itemIds: string[];
  /** In the pantry, but in a unit that cannot be compared with the recipe's: nothing is taken out unless you enter an amount. */
  loose: boolean;
};

/** Rows for the confirmation screen. Each starts at the amount the recipe needs, or all there is if that is less. */
export function planLines(needs: readonly Need[], items: readonly PantryItem[], factor: number): PlanLine[] {
  return needs.map((need, index) => {
    const status = lineStatus(need, items, factor);
    const wanted = roundQty(need.quantity * factor);
    const available = roundQty(status.have);
    return {
      id: `${index}`,
      name: need.name,
      unit: need.unit,
      wanted,
      available,
      amount: Math.min(wanted, available),
      skip: available <= 0,
      itemIds: status.items.map((i) => i.id),
      loose: status.loose,
    };
  });
}

/** Sets the amount of a row, kept between 0 and what the pantry has. */
export function withAmount(line: PlanLine, amount: number): PlanLine {
  const value = Number.isFinite(amount) ? Math.max(0, Math.min(amount, line.available)) : 0;
  return { ...line, amount: roundQty(value) };
}

/** What happens to one pantry item. `after` is the new quantity; 0 means the item is removed. */
export type Change = { id: string; name: string; unit: Unit; before: number; after: number };

/** Soonest expiry first (items with no date last), then the oldest. */
function useOrder(a: PantryItem, b: PantryItem): number {
  return (a.expires_on ?? "9999").localeCompare(b.expires_on ?? "9999") || a.added_at.localeCompare(b.added_at);
}

/** Turns the confirmed rows into changes to pantry items, taking from items that expire first. Rows that skip or have 0 are ignored. */
export function changesFor(lines: readonly PlanLine[], items: readonly PantryItem[]): Change[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const left = new Map<string, number>(items.map((i) => [i.id, i.quantity]));
  for (const line of lines) {
    if (line.skip || line.amount <= 0) continue;
    let remaining = toBase(line.amount, line.unit);
    const sources = line.itemIds
      .flatMap((id) => (byId.has(id) ? [byId.get(id) as PantryItem] : []))
      .sort(useOrder);
    for (const item of sources) {
      if (remaining <= 1e-9) break;
      const inItem = toBase(left.get(item.id) ?? 0, item.unit);
      const take = Math.min(remaining, inItem);
      if (take <= 0) continue;
      const after = roundQty((left.get(item.id) ?? 0) - fromBase(take, item.unit));
      left.set(item.id, after < 0.0005 ? 0 : after);
      remaining -= take;
    }
  }
  return items
    .filter((i) => (left.get(i.id) ?? i.quantity) !== i.quantity)
    .map((i) => ({ id: i.id, name: i.name, unit: i.unit as Unit, before: i.quantity, after: left.get(i.id) ?? i.quantity }));
}
