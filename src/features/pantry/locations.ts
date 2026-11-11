import { DEFAULT_ACCEPTS } from "./categories";
import type { LocationKind, PantryLocation } from "./model";

/** A place in the default template. Children list their parent by name. `accepts` lists the categories it takes. */
export type DefaultLocation = { name: string; kind: LocationKind; parent?: string; accepts?: readonly string[] };

/** The categories a place of this name accepts by default (empty for places the defaults do not know). */
export const defaultAccepts = (name: string): string[] => [...(DEFAULT_ACCEPTS[name] ?? [])];

const withAccepts = (l: Omit<DefaultLocation, "accepts">): DefaultLocation => ({ ...l, accepts: defaultAccepts(l.name) });

const BASE_LOCATIONS: readonly Omit<DefaultLocation, "accepts">[] = [
  { name: "Fridge", kind: "fridge" },
  { name: "Meat and fish", kind: "shelf", parent: "Fridge" },
  { name: "Dairy and eggs", kind: "shelf", parent: "Fridge" },
  { name: "Vegetable drawer", kind: "drawer", parent: "Fridge" },
  { name: "Fruit drawer", kind: "drawer", parent: "Fridge" },
  { name: "Drinks and sauces", kind: "shelf", parent: "Fridge" },
  { name: "Freezer", kind: "freezer" },
  { name: "Dry-goods shelf", kind: "shelf" },
  { name: "Spice shelf", kind: "shelf" },
];

export const DEFAULT_LOCATIONS: readonly DefaultLocation[] = BASE_LOCATIONS.map(withAccepts);

/** True when the place lists this category. */
export const accepts = (l: Pick<PantryLocation, "accepts">, category: string): boolean => (l.accepts ?? []).includes(category);

/** Places that accept a category, in tree order. */
export function placesAccepting(locations: readonly PantryLocation[], category: string): PantryLocation[] {
  return sortLocations(locations).filter((l) => accepts(l, category));
}

/**
 * Where a new item of this category goes: the first place that accepts it (preferring one of the wanted
 * kind when several do), else the first place of the wanted kind, else null. Places follow categories, not names.
 */
export function pickPlace(
  locations: readonly PantryLocation[],
  category: string,
  wantedKind: LocationKind | null = null,
  fallbackKind: LocationKind | null = null,
): PantryLocation | null {
  const candidates = placesAccepting(locations, category);
  const first = (wantedKind && candidates.find((l) => l.kind === wantedKind)) || candidates[0];
  if (first) return first;
  return (wantedKind && firstOfKind(locations, wantedKind)) || (fallbackKind && firstOfKind(locations, fallbackKind)) || null;
}

/** Places ordered as a tree: each parent followed by its children, both by position then name. */
export function sortLocations(locations: readonly PantryLocation[]): PantryLocation[] {
  const byParent = new Map<string | null, PantryLocation[]>();
  const ids = new Set(locations.map((l) => l.id));
  for (const l of locations) {
    const key = l.parent_id && ids.has(l.parent_id) ? l.parent_id : null;
    byParent.set(key, [...(byParent.get(key) ?? []), l]);
  }
  const out: PantryLocation[] = [];
  const walk = (parent: string | null) => {
    const kids = [...(byParent.get(parent) ?? [])].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
    for (const k of kids) {
      out.push(k);
      walk(k.id);
    }
  };
  walk(null);
  return out;
}

/** "Fridge › Vegetable drawer" */
export function locationPath(locations: readonly PantryLocation[], id: string): string {
  const names: string[] = [];
  const seen = new Set<string>();
  let cur = locations.find((l) => l.id === id);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    names.unshift(cur.name);
    const parent: string | null = cur.parent_id;
    cur = parent ? locations.find((l) => l.id === parent) : undefined;
  }
  return names.join(" › ");
}

/** Ids of every place inside the given one, at any depth. */
export function descendantIds(locations: readonly PantryLocation[], id: string): string[] {
  const out: string[] = [];
  const queue = [id];
  while (queue.length) {
    const cur = queue.shift();
    for (const l of locations) {
      if (l.parent_id === cur && !out.includes(l.id) && l.id !== id) {
        out.push(l.id);
        queue.push(l.id);
      }
    }
  }
  return out;
}

/** First place of the given kind (top level first), or undefined. */
export function firstOfKind(locations: readonly PantryLocation[], kind: LocationKind): PantryLocation | undefined {
  return sortLocations(locations).find((l) => l.kind === kind);
}
