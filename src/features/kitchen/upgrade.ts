import { MAX_COMPARTMENTS, type Compartment, type Layout } from "./layout";
import { DEFAULT_LAYOUT } from "./legacy";

const same = (a: string | null, b: string | null) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

/**
 * Brings a saved layout up to date with the default one without removing or renaming anything: the fridge and
 * the freezer get the default compartments they do not have yet (matched by the pantry place they show).
 * Existing compartments, and the items in them, stay where they are.
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
  return { layout: added.length ? { ...layout, hotspots } : layout, added };
}
