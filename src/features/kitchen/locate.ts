import type { PantryItem, PantryLocation } from "@/features/pantry/model";
import { locationPath } from "@/features/pantry/locations";
import { nameKey } from "@/features/pantry/items";
import type { Compartment, Hotspot, Layout } from "./layout";

/** Where on the kitchen an item can be found. */
export type Spot = { hotspot: Hotspot; compartment: Compartment | null };

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The pantry place called `name`, if there is one. */
export const placeByName = (
  locations: readonly PantryLocation[],
  name: string | null,
): PantryLocation | undefined => (name ? locations.find((l) => same(l.name, name)) : undefined);

/**
 * Finds the cabinet (and compartment) that shows a pantry place. A place inside a place that is on the
 * kitchen belongs to the same spot. Places that are not on the kitchen give null.
 */
export function spotFinder(
  layout: Layout,
  locations: readonly PantryLocation[],
): (locationId: string | null) => Spot | null {
  const byPlace = new Map<string, Spot>();
  for (const h of layout.hotspots) {
    const own = placeByName(locations, h.location);
    if (own && !byPlace.has(own.id)) byPlace.set(own.id, { hotspot: h, compartment: null });
  }
  for (const h of layout.hotspots) {
    for (const c of h.compartments) {
      const p = placeByName(locations, c.location);
      if (p) byPlace.set(p.id, { hotspot: h, compartment: c });
    }
  }
  const parentOf = new Map(locations.map((l) => [l.id, l.parent_id]));
  return (locationId) => {
    const seen = new Set<string>();
    for (let cur = locationId; cur && !seen.has(cur); cur = parentOf.get(cur) ?? null) {
      const spot = byPlace.get(cur);
      if (spot) return spot;
      seen.add(cur);
    }
    return null;
  };
}

/** Items that stand on one row: those whose place is that row's place, or inside it. */
export function itemsOfPlace(
  items: readonly PantryItem[],
  locations: readonly PantryLocation[],
  layout: Layout,
  hotspot: Hotspot,
  compartment: Compartment | null,
): PantryItem[] {
  const find = spotFinder(layout, locations);
  return items.filter((i) => {
    const spot = find(i.location_id);
    return (
      spot?.hotspot.key === hotspot.key &&
      (spot.compartment?.key ?? null) === (compartment?.key ?? null)
    );
  });
}

export type SearchHit = { item: PantryItem; spot: Spot | null; path: string };

/**
 * Items whose name contains every word typed. Names that start with the text come first. `spot` says where to
 * zoom to; it is null for items in a place that is not on the kitchen.
 */
export function searchItems(
  items: readonly PantryItem[],
  locations: readonly PantryLocation[],
  layout: Layout,
  query: string,
  limit = 8,
): SearchHit[] {
  const words = nameKey(query).split(" ").filter(Boolean);
  if (!words.length) return [];
  const find = spotFinder(layout, locations);
  return items
    .filter((i) => words.every((w) => nameKey(i.name).includes(w)))
    .sort(
      (a, b) =>
        Number(!nameKey(a.name).startsWith(words[0] ?? "")) -
          Number(!nameKey(b.name).startsWith(words[0] ?? "")) || a.name.localeCompare(b.name),
    )
    .slice(0, limit)
    .map((item) => ({
      item,
      spot: find(item.location_id),
      path: item.location_id ? locationPath(locations, item.location_id) : "No place",
    }));
}
