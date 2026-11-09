import { fromISO, toISO } from "@/features/gym/dates";
import { descendantIds, locationPath, sortLocations } from "./locations";
import type { PantryItem, PantryLocation, Unit } from "./model";

/** Rounds away floating point noise such as 0.1 + 0.2. */
export const roundQty = (n: number) => Math.round(n * 1000) / 1000;

export const addQty = (a: number, b: number) => roundQty(a + b);

export const nameKey = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

type Candidate = { name: string; unit: Unit | string; location_id: string | null };

/** The existing item a new one should be merged into: same name, same unit, same place. */
export function findDuplicate<T extends Candidate & { id: string }>(
  items: readonly T[],
  c: Candidate,
  ignoreId?: string,
): T | undefined {
  const key = nameKey(c.name);
  return items.find(
    (i) => i.id !== ignoreId && nameKey(i.name) === key && i.unit === c.unit && i.location_id === c.location_id,
  );
}

export type ExpiryState = "none" | "ok" | "soon" | "expired";

export const SOON_DAYS = 3;

export function daysUntil(expiresOn: string, today: Date): number {
  const start = fromISO(toISO(today)).getTime();
  const end = fromISO(expiresOn).getTime();
  return Math.round((end - start) / 86_400_000);
}

export function expiryState(expiresOn: string | null, today: Date): ExpiryState {
  if (!expiresOn) return "none";
  const d = daysUntil(expiresOn, today);
  if (d < 0) return "expired";
  return d <= SOON_DAYS ? "soon" : "ok";
}

/** Short label for the marker: "Expired", "Today", "Tomorrow", "In 3 days". Empty when not shown. */
export function expiryLabel(expiresOn: string | null, today: Date): string {
  if (expiryState(expiresOn, today) === "none" || !expiresOn) return "";
  const d = daysUntil(expiresOn, today);
  if (d < 0) return "Expired";
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  return `In ${d} days`;
}

export type ItemFilter = { query: string; category: string; locationId: string };

export const NO_FILTER: ItemFilter = { query: "", category: "", locationId: "" };

/** Filters by name, category and place. Filtering by a place includes the places inside it. */
export function filterItems(
  items: readonly PantryItem[],
  locations: readonly PantryLocation[],
  f: ItemFilter,
): PantryItem[] {
  const q = nameKey(f.query);
  const places = f.locationId ? new Set([f.locationId, ...descendantIds(locations, f.locationId)]) : null;
  return items.filter(
    (i) =>
      (!q || nameKey(i.name).includes(q)) &&
      (!f.category || i.category === f.category) &&
      (!places || (i.location_id !== null && places.has(i.location_id))),
  );
}

export type ItemGroup = { id: string | null; label: string; items: PantryItem[] };

/** Items grouped by place, in the order of the places. Items without a place come last. */
export function groupByLocation(items: readonly PantryItem[], locations: readonly PantryLocation[]): ItemGroup[] {
  const byLoc = new Map<string | null, PantryItem[]>();
  for (const i of items) {
    const known = i.location_id !== null && locations.some((l) => l.id === i.location_id);
    const key = known ? i.location_id : null;
    byLoc.set(key, [...(byLoc.get(key) ?? []), i]);
  }
  const groups: ItemGroup[] = [];
  for (const l of sortLocations(locations)) {
    const list = byLoc.get(l.id);
    if (list?.length) groups.push({ id: l.id, label: locationPath(locations, l.id), items: sortItems(list) });
  }
  const loose = byLoc.get(null);
  if (loose?.length) groups.push({ id: null, label: "No place", items: sortItems(loose) });
  return groups;
}

const sortItems = (list: PantryItem[]) => [...list].sort((a, b) => a.name.localeCompare(b.name));

/** What changes on an existing item when an equal one is added: quantities add up, the sooner expiry wins. */
export function mergePatch(
  existing: Pick<PantryItem, "quantity" | "expires_on">,
  incoming: { quantity?: number; expires_on?: string | null },
): { quantity: number; expires_on: string | null } {
  const dates = [existing.expires_on, incoming.expires_on ?? null].filter((d): d is string => !!d).sort();
  return { quantity: addQty(existing.quantity, incoming.quantity ?? 1), expires_on: dates[0] ?? null };
}
