import type { LocationKind, PantryLocation } from "./model";

/** A place in the default template. Children list their parent by name. */
export type DefaultLocation = { name: string; kind: LocationKind; parent?: string };

export const DEFAULT_LOCATIONS: readonly DefaultLocation[] = [
  { name: "Fridge", kind: "fridge" },
  { name: "Vegetable drawer", kind: "drawer", parent: "Fridge" },
  { name: "Fruit drawer", kind: "drawer", parent: "Fridge" },
  { name: "Freezer", kind: "freezer" },
  { name: "Dry-goods shelf", kind: "shelf" },
  { name: "Spice shelf", kind: "shelf" },
];

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
