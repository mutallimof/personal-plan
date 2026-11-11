import { describe, expect, it } from "vitest";
import { MAX_COMPARTMENTS, readLayout, type Layout } from "./layout";
import { DEFAULT_LAYOUT } from "./legacy";
import { upgradeLayout } from "./upgrade";

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
