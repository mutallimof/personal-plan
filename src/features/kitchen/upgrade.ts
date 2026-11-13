import { placesAccepting } from "@/features/pantry/locations";
import type { PantryItem, PantryLocation } from "@/features/pantry/model";
import { counterEnd, LAYOUT_REV, MAX_COMPARTMENTS, WORKTOP_TOP, type Compartment, type Decor, type Layout, type Rect } from "./layout";
import { DEFAULT_LAYOUT } from "./legacy";

const same = (a: string | null, b: string | null) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

const overlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/**
 * Puts every plant on the worktop, resting on its top edge, in a free spot: not over the cooker (which is
 * drawn on the worktop), not in front of a cabinet, the hood or the window, not over another plant, and not past
 * the end of the counter. A plant that already stands properly is left alone; one that does not moves along the
 * counter to the nearest free spot. When there is no free spot it stays where it is.
 */
export function groundPlants(layout: Layout): { decor: Decor[]; moved: boolean } {
  const end = counterEnd(layout);
  const rest = (d: Decor) => layout.room.worktopY - WORKTOP_TOP - d.height;
  let moved = false;
  const decor = layout.decor.map((d) => {
    if (d.type !== "plant") return d;
    const y = rest(d);
    const free = (x: number) => {
      const spot = { x, y, width: d.width, height: d.height };
      if (x < 1 || x + d.width > end) return false;
      if (layout.hotspots.some((h) => overlap(spot, h))) return false;
      return !layout.decor.some((o) => {
        if (o === d) return false;
        // the cooker stands on the worktop, so it blocks its whole width; everything else by its own box
        if (o.type === "cooker") return spot.x < o.x + o.width && o.x < spot.x + spot.width;
        return overlap(spot, o);
      });
    };
    if (d.y === y && free(d.x)) return d;
    let best: number | null = null;
    for (let x = 1; x + d.width <= end; x += 0.5) {
      if (free(x) && (best === null || Math.abs(x - d.x) < Math.abs(best - d.x))) best = x;
    }
    if (best === null) return d;
    moved = true;
    return { ...d, x: best, y };
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
  const plants = groundPlants(layout);
  if (plants.moved) added.push("Plant moved onto the worktop");
  const next = added.length ? { ...layout, hotspots, decor: plants.decor } : layout;
  return { layout: next, added };
}

/** Compartments named by position, left over from the first flat map: they say nothing about what goes in them. */
const BY_POSITION = /^(top|middle|bottom) drawer$/i;
const isFrozenVeg = (c: Pick<Compartment, "name" | "location">) =>
  c.name.trim().toLowerCase() === "vegetables and fruit" || (c.location ?? "").trim().toLowerCase() === "frozen vegetables and fruit";
const isMeatAndFish = (c: Pick<Compartment, "name">) => c.name.trim().toLowerCase() === "meat and fish";

/**
 * One-time tidy-ups of a saved layout, each by its revision (kept in the layout file, so no database change):
 * - revision 2: in the fridge and the freezer the Top, Middle and Bottom drawers are removed, Meat and fish is the
 *   only drawer, and every other drawer becomes an open shelf. The pantry places of removed compartments are
 *   returned in `removed` so their items can be moved;
 * - revision 3: plants are put on the worktop (see `groundPlants`);
 * - revision 4: the freezer has no "Vegetables and fruit" shelf any more; its place is returned in `removed` and in
 *   `stayInCabinet`, so its items go to another shelf of the freezer, never to the fridge.
 * A layout that already has the current revision comes back as the very same object.
 */
export function tidyLayout(layout: Layout): { layout: Layout; removed: string[]; stayInCabinet: string[] } {
  if (layout.rev >= LAYOUT_REV) return { layout, removed: [], stayInCabinet: [] };
  const removed: string[] = [];
  const stayInCabinet: string[] = [];
  const cold = layout.rev < 2;
  const hotspots = layout.hotspots.map((h) => {
    if (h.kind !== "fridge" && h.kind !== "freezer") return h;
    if (!cold && layout.rev >= 4) return h;
    const compartments: Compartment[] = [];
    for (const c of h.compartments) {
      if (h.kind === "freezer" && isFrozenVeg(c)) {
        if (c.location) {
          removed.push(c.location);
          stayInCabinet.push(c.location);
        }
        continue;
      }
      if (!cold) {
        compartments.push(c);
        continue;
      }
      if (BY_POSITION.test(c.name.trim()) || BY_POSITION.test((c.location ?? "").trim())) {
        if (c.location) removed.push(c.location);
        continue;
      }
      compartments.push(isMeatAndFish(c) ? { ...c, kind: "drawer" } : c.kind === "drawer" ? { ...c, kind: "shelf" } : c);
    }
    return { ...h, compartments };
  });
  const next = { ...layout, hotspots };
  return { layout: { ...next, rev: LAYOUT_REV, decor: groundPlants(next).decor }, removed, stayInCabinet };
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
  stayInCabinet: readonly string[] = [],
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
    const sameCabinet = accepting.find((l) => from.parent_id && l.parent_id === from.parent_id);
    const local = stayInCabinet.some((r) => lower(r) === lower(from.name));
    const target = sameCabinet ?? (local ? undefined : accepting[0]) ?? parent;
    if (target) out.push({ id: item.id, location_id: target.id });
  }
  return out;
}
