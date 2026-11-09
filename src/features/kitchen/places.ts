import type { LocationKind, PantryLocation } from "@/features/pantry/model";
import type { Layout } from "./layout";

/** A pantry place a layout needs that does not exist yet. Parents are listed before their children. */
export type NewPlace = { name: string; kind: LocationKind; parent: string | null };

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Places named by a layout that are missing from the pantry. A compartment's place goes inside its cabinet's
 * place when the cabinet has one. A name used twice is created once.
 */
export function missingPlaces(
  layout: Layout,
  existing: readonly Pick<PantryLocation, "name">[],
): NewPlace[] {
  const out: NewPlace[] = [];
  const known = (name: string) =>
    existing.some((l) => same(l.name, name)) || out.some((p) => same(p.name, name));
  for (const h of layout.hotspots) {
    if (h.location && !known(h.location))
      out.push({ name: h.location, kind: h.kind, parent: null });
    for (const c of h.compartments) {
      if (c.location && !known(c.location)) {
        out.push({
          name: c.location,
          kind: c.kind === "drawer" ? "drawer" : "shelf",
          parent: h.location,
        });
      }
    }
  }
  return out;
}
