import type { PantryItem, PantryLocation } from "@/features/pantry/model";
import { assignShelves, interiorRows, LOOSE_ID, spriteSize } from "./interior";
import type { Layout } from "./layout";
import { spotFinder } from "./locate";

/** Which products stand on which row of which cabinet: cabinet key, then row id. */
export type Contents = Map<string, Map<string, PantryItem[]>>;

const byName = (a: PantryItem, b: PantryItem) => a.name.localeCompare(b.name);

/** Sorts every item of the pantry into the rows of the cabinets that show its place. Items in places not on the kitchen are left out. */
export function contentsOf(
  layout: Layout,
  items: readonly PantryItem[],
  locations: readonly PantryLocation[],
): Contents {
  const find = spotFinder(layout, locations);
  const out: Contents = new Map();
  const loose = new Map<string, PantryItem[]>();

  for (const h of layout.hotspots) out.set(h.key, new Map(interiorRows(h).map((r) => [r.id, []])));

  for (const item of items) {
    const spot = find(item.location_id);
    if (!spot) continue;
    const rows = out.get(spot.hotspot.key);
    if (!rows) continue;
    if (spot.compartment) rows.get(spot.compartment.key)?.push(item);
    else if (spot.hotspot.compartments.length) rows.get(LOOSE_ID)?.push(item);
    else loose.set(spot.hotspot.key, [...(loose.get(spot.hotspot.key) ?? []), item]);
  }

  for (const h of layout.hotspots) {
    const rows = out.get(h.key);
    const mine = loose.get(h.key);
    if (!rows || !mine) continue;
    const shelfRows = interiorRows(h);
    const first = shelfRows[0];
    const perShelf = first
      ? Math.max(3, Math.floor((first.rect.width - 2) / (spriteSize(first.rect) * 1.2)))
      : 3;
    const shelfOf = assignShelves(mine, h.shelves, perShelf);
    for (const item of mine) rows.get(`shelf-${shelfOf.get(item.id) ?? 0}`)?.push(item);
  }

  for (const rows of out.values()) for (const list of rows.values()) list.sort(byName);
  return out;
}
