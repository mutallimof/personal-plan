import { describe, expect, it } from "vitest";
import { counterEnd, LAYOUT_REV, MAX_COMPARTMENTS, readLayout, WORKTOP_TOP, type Decor, type Layout } from "./layout";
import { DEFAULT_LAYOUT } from "./legacy";
import { groundPlants, moveOutOfRemoved, tidyLayout, upgradeLayout } from "./upgrade";

const withFridge = (compartments: { key: string; name: string; kind: "shelf" | "drawer" | "door"; location: string | null }[]): Layout => ({
  ...DEFAULT_LAYOUT,
  hotspots: DEFAULT_LAYOUT.hotspots.map((h) => (h.kind === "fridge" ? { ...h, compartments } : h)),
});

describe("default layout", () => {
  it("names the freezer compartments by what goes in them, not by position", () => {
    const names = DEFAULT_LAYOUT.hotspots.flatMap((h) => h.compartments.map((c) => c.name));
    expect(names.join("|")).not.toMatch(/top drawer|middle drawer|bottom drawer/i);
  });

  it("is already up to date", () => {
    expect(upgradeLayout(DEFAULT_LAYOUT).added).toEqual([]);
  });
});

describe("upgradeLayout", () => {
  const old = withFridge([
    { key: "t", name: "Top drawer", kind: "drawer", location: "Top drawer" },
    { key: "m", name: "Middle drawer", kind: "drawer", location: "Middle drawer" },
  ]);

  it("adds the default compartments that are missing and keeps the old ones", () => {
    const { layout, added } = upgradeLayout(old);
    const fridge = layout.hotspots.find((h) => h.kind === "fridge")!;
    expect(fridge.compartments.map((c) => c.name)).toEqual([
      "Top drawer",
      "Middle drawer",
      "Meat and fish",
      "Dairy and eggs",
      "Vegetables",
      "Fruit",
      "Drinks and sauces",
    ]);
    expect(added).toContain("Vegetable drawer");
    expect(readLayout(layout).errors).toEqual([]);
  });

  it("does not add a compartment whose place is already shown", () => {
    const l = withFridge([{ key: "x", name: "Salad", kind: "drawer", location: "Vegetable drawer" }]);
    const fridge = upgradeLayout(l).layout.hotspots.find((h) => h.kind === "fridge")!;
    expect(fridge.compartments.filter((c) => c.location === "Vegetable drawer")).toHaveLength(1);
  });

  it("gives new compartments unused keys and never exceeds the limit", () => {
    const full = withFridge(Array.from({ length: MAX_COMPARTMENTS - 1 }, (_, i) => ({ key: `k${i}`, name: `Part ${i}`, kind: "shelf" as const, location: `Place ${i}` })));
    const fridge = upgradeLayout(full).layout.hotspots.find((h) => h.kind === "fridge")!;
    expect(fridge.compartments).toHaveLength(MAX_COMPARTMENTS);
    expect(new Set(fridge.compartments.map((c) => c.key)).size).toBe(MAX_COMPARTMENTS);
  });

  it("returns the same layout when nothing is added", () => {
    expect(upgradeLayout(DEFAULT_LAYOUT).layout).toBe(DEFAULT_LAYOUT);
  });
});

describe("tidyLayout", () => {
  const loc = (id: string, name: string, parent: string | null, accepts: string[]) =>
    ({ id, name, parent_id: parent, accepts, kind: "shelf", position: 0, user_id: "u", created_at: "" }) as unknown as import("@/features/pantry/model").PantryLocation;

  const old: Layout = {
    ...DEFAULT_LAYOUT,
    rev: 0,
    hotspots: DEFAULT_LAYOUT.hotspots.map((h) =>
      h.kind === "freezer"
        ? {
            ...h,
            compartments: [
              { key: "t", name: "Top drawer", kind: "drawer" as const, location: "Top drawer" },
              { key: "m", name: "Middle drawer", kind: "drawer" as const, location: "Middle drawer" },
              { key: "b", name: "Bottom drawer", kind: "drawer" as const, location: "Bottom drawer" },
              { key: "vf", name: "Vegetables and fruit", kind: "drawer" as const, location: "Frozen vegetables and fruit" },
              { key: "mf", name: "Meat and fish", kind: "shelf" as const, location: "Frozen meat and fish" },
              { key: "rm", name: "Ready meals", kind: "drawer" as const, location: "Frozen ready meals" },
            ],
          }
        : h,
    ),
  };

  it("removes Top/Middle/Bottom drawers, keeps Meat and fish as the only drawer and lists the removed places", () => {
    const { layout, removed } = tidyLayout(old);
    const freezer = layout.hotspots.find((h) => h.kind === "freezer")!;
    expect(freezer.compartments.map((c) => `${c.name}:${c.kind}`)).toEqual([
      "Meat and fish:drawer",
      "Ready meals:shelf",
    ]);
    expect(removed).toEqual(["Top drawer", "Middle drawer", "Bottom drawer", "Frozen vegetables and fruit"]);
    expect(layout.rev).toBe(LAYOUT_REV);
    expect(readLayout(layout).errors).toEqual([]);
  });

  it("runs once: a layout with the revision comes back unchanged", () => {
    const once = tidyLayout(old).layout;
    expect(tidyLayout(once).layout).toBe(once);
    expect(tidyLayout(DEFAULT_LAYOUT).layout).toBe(DEFAULT_LAYOUT);
  });

  it("takes the Vegetables and fruit shelf out of the freezer once (rev 3 -> 4), and only there", () => {
    const vf = { key: "vf", name: "Vegetables and fruit", kind: "shelf" as const, location: "Frozen vegetables and fruit" };
    const saved: Layout = {
      ...DEFAULT_LAYOUT,
      rev: 3,
      hotspots: DEFAULT_LAYOUT.hotspots.map((h) =>
        h.kind === "freezer" ? { ...h, compartments: [vf, ...h.compartments] } : h.kind === "fridge" ? { ...h, compartments: [...h.compartments, { ...vf, key: "fv" }] } : h,
      ),
    };
    const { layout, removed, stayInCabinet } = tidyLayout(saved);
    expect(layout.hotspots.find((h) => h.kind === "freezer")!.compartments.map((c) => c.name)).toEqual(["Meat and fish", "Ready meals"]);
    expect(layout.hotspots.find((h) => h.kind === "fridge")!.compartments.some((c) => c.key === "fv")).toBe(true);
    expect(removed).toEqual(["Frozen vegetables and fruit"]);
    expect(stayInCabinet).toEqual(removed);
  });

  it("moves frozen vegetables to the freezer's own place, not to the fridge's vegetable drawer", () => {
    const places = [
      loc("fz", "Freezer", null, []),
      loc("vf", "Frozen vegetables and fruit", "fz", ["frozen"]),
      loc("fr", "Fridge", null, []),
      loc("vd", "Vegetable drawer", "fr", ["vegetables", "frozen"]),
    ];
    const items = [{ id: "1", category: "vegetables", location_id: "vf" }];
    expect(moveOutOfRemoved(items, places, ["Frozen vegetables and fruit"], ["Frozen vegetables and fruit"])).toEqual([{ id: "1", location_id: "fz" }]);
  });

  it("moves items of removed drawers to a shelf of the same cabinet that accepts them", () => {
    const places = [
      loc("fz", "Freezer", null, []),
      loc("top", "Top drawer", "fz", []),
      loc("mf", "Frozen meat and fish", "fz", ["meat", "fish"]),
      loc("vf", "Frozen vegetables and fruit", "fz", ["vegetables", "fruit"]),
      loc("other", "Dairy and eggs", "fr", ["dairy"]),
    ];
    const items = [
      { id: "1", category: "meat", location_id: "top" },
      { id: "2", category: "fruit", location_id: "top" },
      { id: "3", category: "snacks", location_id: "top" },
      { id: "4", category: "meat", location_id: "mf" },
    ];
    const moves = moveOutOfRemoved(items, places, ["Top drawer"]);
    expect(moves).toEqual([
      { id: "1", location_id: "mf" },
      { id: "2", location_id: "vf" },
      { id: "3", location_id: "fz" }, // nothing accepts it: the freezer's own place
    ]);
  });
});

describe("the plant", () => {
  const plantOf = (l: Layout) => l.decor.find((d) => d.type === "plant")!;
  const withPlant = (p: Partial<Decor>): Layout => ({
    ...DEFAULT_LAYOUT,
    rev: 2,
    decor: DEFAULT_LAYOUT.decor.map((d) => (d.type === "plant" ? { ...d, ...p } : d)),
  });
  const restY = (l: Layout, d: Decor) => l.room.worktopY - WORKTOP_TOP - d.height;

  it("stands on the top edge of the worktop in the default kitchen", () => {
    const p = plantOf(DEFAULT_LAYOUT);
    expect(p.y + p.height).toBe(DEFAULT_LAYOUT.room.worktopY - WORKTOP_TOP);
    expect(groundPlants(DEFAULT_LAYOUT).moved).toBe(false);
  });

  it("is lifted out of the worktop slab (the old position sank 2 units into it)", () => {
    const old = withPlant({ y: 46 });
    const fixed = tidyLayout({ ...old, rev: 2 }).layout;
    expect(plantOf(fixed).y + plantOf(fixed).height).toBe(old.room.worktopY - WORKTOP_TOP);
    expect(fixed.rev).toBe(LAYOUT_REV);
  });

  it("moves along the counter off the cooker, the cabinets and the hood, and never past the counter's end", () => {
    for (const x of [82, 100, 112, 118, 40, 60]) {
      const l = withPlant({ x, y: 50 });
      const { decor } = groundPlants(l);
      const p = decor.find((d) => d.type === "plant")!;
      expect(p.y).toBe(restY(l, p));
      expect(p.x).toBeGreaterThanOrEqual(1);
      expect(p.x + p.width).toBeLessThanOrEqual(counterEnd(l));
      const cooker = l.decor.find((d) => d.type === "cooker")!;
      expect(p.x + p.width <= cooker.x || p.x >= cooker.x + cooker.width).toBe(true);
      for (const h of l.hotspots)
        expect(p.x < h.x + h.width && h.x < p.x + p.width && p.y < h.y + h.height && h.y < p.y + p.height).toBe(false);
    }
  });

  it("is left alone when it already stands properly", () => {
    const l = withPlant({ x: 20 });
    const res = groundPlants(l);
    expect(res.moved).toBe(false);
    expect(res.decor.find((d) => d.type === "plant")).toBe(plantOf(l));
  });
});
