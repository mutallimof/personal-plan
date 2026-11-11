import { MAX_COMPARTMENTS, type Compartment, type Decor, type Layout, type Rect } from "./layout";
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
