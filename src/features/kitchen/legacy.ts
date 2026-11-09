import { isLocationKind, type LocationKind } from "@/features/pantry/model";
import defaultLayoutJson from "./default-layout.json";
import { readLayout, type Compartment, type Hotspot, type Layout } from "./layout";

/** The layout new users start with. */
export const DEFAULT_LAYOUT: Layout = (() => {
  const { layout, errors } = readLayout(defaultLayoutJson);
  if (!layout) throw new Error(`default-layout.json is not valid: ${errors.join("; ")}`);
  return layout;
})();

/** A zone of the earlier flat kitchen map (table `kitchen_zones`, or a version 1 layout file). */
export type LegacyZone = {
  key: string;
  name: string;
  kind: string;
  parent: string | null;
  /** Name of the pantry place it showed. */
  location: string | null;
};

const kindOf = (k: string): LocationKind => (isLocationKind(k) ? k : "other");

const compartmentOf = (z: LegacyZone, taken: Set<string>): Compartment => {
  let key = z.key.replace(/[^A-Za-z0-9_-]+/g, "-").slice(0, 36) || "part";
  while (taken.has(key)) key += "x";
  taken.add(key);
  return {
    key,
    name: z.name,
    kind: z.kind === "drawer" ? "drawer" : "shelf",
    location: z.location,
  };
};

/**
 * Puts the zones of the old map onto the new default kitchen without losing any place:
 * - the first fridge and freezer keep their name and place, and their inner zones become compartments;
 * - shelves go to the open shelves, drawers to the drawers, everything else to the cabinets;
 * - cabinets that nobody claims keep the default places;
 * - zones that do not fit anywhere are returned in `unplaced`. Their places and items are untouched and
 *   stay in the All items list.
 */
export function fromLegacyZones(zones: readonly LegacyZone[]): {
  layout: Layout;
  unplaced: string[];
} {
  const hotspots: Hotspot[] = DEFAULT_LAYOUT.hotspots.map((h) => ({
    ...h,
    compartments: [...h.compartments],
  }));
  const slot = (pick: (h: Hotspot) => boolean) => hotspots.filter(pick);
  const used = new Set<string>();
  const unplaced: string[] = [];
  const tops = zones.filter((z) => !z.parent);

  const claim = (z: LegacyZone, h: Hotspot | undefined) => {
    if (!h) {
      unplaced.push(z.name);
      return;
    }
    used.add(h.key);
    h.name = z.name;
    h.location = z.location;
    h.kind = kindOf(z.kind);
    const inner = zones.filter((c) => c.parent === z.key);
    if (inner.length && (h.kind === "fridge" || h.kind === "freezer")) {
      const taken = new Set<string>();
      h.compartments = inner.map((c) => compartmentOf(c, taken));
    }
  };
  const next = (list: Hotspot[]) => list.find((h) => !used.has(h.key));

  for (const z of tops) {
    const kind = kindOf(z.kind);
    if (kind === "fridge") claim(z, next(slot((h) => h.kind === "fridge")));
    else if (kind === "freezer") claim(z, next(slot((h) => h.kind === "freezer")));
    else if (kind === "shelf") claim(z, next(slot((h) => h.door === "open-shelf")));
    else if (kind === "drawer")
      claim(
        z,
        next(slot((h) => h.door === "drawer")) ??
          next(slot((h) => h.kind === "cupboard" && h.door !== "glass")),
      );
    else claim(z, next(slot((h) => h.kind === "cupboard")));
  }
  return { layout: { ...DEFAULT_LAYOUT, hotspots }, unplaced };
}
