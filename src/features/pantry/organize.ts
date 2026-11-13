import { accepts, locationPath, placesAccepting } from "./locations";
import type { PantryItem, PantryLocation } from "./model";

export type Move = { item: PantryItem; from: PantryLocation | null; to: PantryLocation };

/**
 * Proposed moves for items that sit in a place that does not accept their category, when another place does.
 * Nothing is moved by this; a person accepts the moves one by one. Items with no place are proposed too.
 * Places that accept nothing in particular (a plain "Fridge") count as not accepting.
 */
export function proposeMoves(items: readonly PantryItem[], locations: readonly PantryLocation[]): Move[] {
  const byId = new Map(locations.map((l) => [l.id, l]));
  const out: Move[] = [];
  for (const item of items) {
    const from = item.location_id ? (byId.get(item.location_id) ?? null) : null;
    if (from && accepts(from, item.category)) continue;
    // A place that states no preference is left alone, unless it is a plain parent such as "Fridge".
    if (from && !(from.accepts ?? []).length && !locations.some((l) => l.parent_id === from.id)) continue;
    const to = placesAccepting(locations, item.category).find((l) => l.id !== from?.id);
    if (to) out.push({ item, from, to });
  }
  return out;
}

export const describeMove = (m: Move, locations: readonly PantryLocation[]) => ({
  from: m.from ? locationPath(locations, m.from.id) : "No place",
  to: locationPath(locations, m.to.id),
});
