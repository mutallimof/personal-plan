import { placesAccepting } from "@/features/pantry/locations";
import type { PantryItem, PantryLocation } from "@/features/pantry/model";
import { LAYOUT_REV, MAX_COMPARTMENTS, type Compartment, type Decor, type Layout, type Rect } from "./layout";
import { DEFAULT_LAYOUT } from "./legacy";

const same = (a: string | null, b: string | null) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

const overlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** A plant that stands on the cooker or inside a cabinet goes to a free spot on the worktop. */
function movePlants(layout: Layout): { decor: Decor[]; moved: boolean } {
  let moved = false;
  const decor = layout.decor.map((d) => {
    if (d.type !== "plant") return d;
    const blockers: Rect[] = [...layout.decor.filter((o) => o.type === "cooker" || o.type === "hood"), ...layout.hotspots];
    if (!blockers.some((b) => overlap(d, b))) return d;
    const y = layout.room.worktopY - d.height;
    for (let x = 4; x + d.width < layout.room.width; x += 2) {
      const spot = { x, y, width: d.width, height: d.height };
      if (!blockers.some((b) => overlap(spot, b)) && !layout.decor.some((o) => o !== d && overlap(spot, o))) {
        moved = true;
        return { ...d, x, y };
      }
    }
    return d;
  });
  return { decor, moved };
}

/**
 * Brings a saved layout up to date with the default one without removing or renaming anything: the fridge and
 * the freezer get the default compartments they do not have yet (matched by the pantry place they show).
 * Existing compartments, and the items in them, stay where they are. A plant that overlaps the cooker is moved.
 */
export function upgradeLayout(layout: Layout): { layout: Layout; added: string[] } {
  const added: string[] = [];
  const hotspots = layout.hotspots.map((h) => {
    if (h.kind !== "fridge" && h.kind !== "freezer") return h;
    const wanted = DEFAULT_LAYOUT.hotspots.find((d) => d.kind === h.kind);
    if (!wanted) return h;
    const taken = new Set(h.compartments.map((c) => c.key));
    const compartments: Compartment[] = [...h.compartments];
    for (const c of wanted.compartments) {
      if (compartments.length >= MAX_COMPARTMENTS) break;
      if (compartments.some((x) => same(x.location, c.location) || same(x.name, c.name))) continue;
      let key = c.key;
      while (taken.has(key)) key += "x";
      taken.add(key);
      compartments.push({ ...c, key });
      added.push(c.location ?? c.name);
    }
    return compartments.length === h.compartments.length ? h : { ...h, compartments };
  });
  const plants = movePlants(layout);
  if (plants.moved) added.push("Plant moved off the cooker");
  const next = added.length ? { ...layout, hotspots, decor: plants.decor } : layout;
  return { layout: next, added };
}

/** Compartments named by position, left over from the first flat map: they say nothing about what goes in them. */
const BY_POSITION = /^(top|middle|bottom) drawer$/i;
const isMeatAndFish = (c: Pick<Compartment, "name">) => c.name.trim().toLowerCase() === "meat and fish";

/**
 * One-time tidy-up of the fridge and the freezer (layout revision 2): the Top, Middle and Bottom drawers are removed,
 * Meat and fish is the only drawer, and every other drawer becomes an open shelf. The pantry places of removed
 * compartments are returned in `removed` so their items can be moved. Nothing else changes; a layout that already
 * has this revision comes back as the very same object.
 */
export function tidyColdStorage(layout: Layout): { layout: Layout; removed: string[] } {
  if (layout.rev >= LAYOUT_REV) return { layout, removed: [] };
  const removed: string[] = [];
  const hotspots = layout.hotspots.map((h) => {
    if (h.kind !== "fridge" && h.kind !== "freezer") return h;
    const compartments: Compartment[] = [];
    for (const c of h.compartments) {
      if (BY_POSITION.test(c.name.trim()) || BY_POSITION.test((c.location ?? "").trim())) {
        if (c.location) removed.push(c.location);
        continue;
      }
      compartments.push(isMeatAndFish(c) ? { ...c, kind: "drawer" } : c.kind === "drawer" ? { ...c, kind: "shelf" } : c);
    }
    return { ...h, compartments };
  });
  return { layout: { ...layout, rev: LAYOUT_REV, hotspots }, removed };
}

const lower = (s: string) => s.trim().toLowerCase();

/**
 * Where the items of removed places go: a place that accepts their category and sits in the same cabinet, else
 * one that accepts it anywhere, else the cabinet's own place. Items that find nothing stay where they are.
 */
export function moveOutOfRemoved(
  items: readonly Pick<PantryItem, "id" | "category" | "location_id">[],
  locations: readonly PantryLocation[],
  removed: readonly string[],
): { id: string; location_id: string }[] {
  const gone = locations.filter((l) => removed.some((r) => lower(r) === lower(l.name)));
  const goneIds = new Set(gone.map((l) => l.id));
  const keep = locations.filter((l) => !goneIds.has(l.id));
  const out: { id: string; location_id: string }[] = [];
  for (const item of items) {
    const from = gone.find((l) => l.id === item.location_id);
    if (!from) continue;
    const accepting = placesAccepting(keep, item.category);
    const parent = keep.find((l) => l.id === from.parent_id);
    const target =
      accepting.find((l) => from.parent_id && l.parent_id === from.parent_id) ?? accepting[0] ?? parent;
    if (target) out.push({ id: item.id, location_id: target.id });
  }
  return out;
}
