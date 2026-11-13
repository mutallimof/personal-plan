import { describe, expect, it } from "vitest";
import { loc } from "@/features/pantry/fixtures";
import { readLayout } from "./layout";
import { DEFAULT_LAYOUT, fromLegacyZones, type LegacyZone } from "./legacy";
import { missingPlaces } from "./places";

const zone = (
  key: string,
  name: string,
  kind: string,
  location: string | null,
  parent: string | null = null,
): LegacyZone => ({ key, name, kind, parent, location });

describe("fromLegacyZones", () => {
  const old = [
    zone("f", "Big fridge", "fridge", "Fridge"),
    zone("f1", "Salad", "drawer", "Salad drawer", "f"),
    zone("f2", "Cheese", "shelf", "Cheese shelf", "f"),
    zone("z", "Deep freeze", "freezer", "Freezer"),
    zone("s1", "Pantry shelf", "shelf", "Dry-goods shelf"),
    zone("s2", "Spices", "shelf", "Spice shelf"),
    zone("d", "Cutlery", "drawer", "Cutlery drawer"),
    zone("c", "Cupboard", "cupboard", "Cupboard"),
  ];

  it("always produces a layout the app accepts", () => {
    expect(readLayout(fromLegacyZones(old).layout).errors).toEqual([]);
    expect(readLayout(fromLegacyZones([]).layout).errors).toEqual([]);
  });

  it("with no old zones gives exactly the default", () => {
    expect(fromLegacyZones([])).toEqual({ layout: DEFAULT_LAYOUT, unplaced: [] });
  });

  it("keeps every place of the old map somewhere on the new one", () => {
    const { layout, unplaced } = fromLegacyZones(old);
    const shown = layout.hotspots.flatMap((h) => [
      h.location,
      ...h.compartments.map((c) => c.location),
    ]);
    for (const place of [
      "Fridge",
      "Salad drawer",
      "Cheese shelf",
      "Freezer",
      "Dry-goods shelf",
      "Spice shelf",
      "Cutlery drawer",
      "Cupboard",
    ]) {
      expect(shown).toContain(place);
    }
    expect(unplaced).toEqual([]);
  });

  it("turns inner zones of the fridge into its compartments, in order", () => {
    const fridge = fromLegacyZones(old).layout.hotspots.find((h) => h.kind === "fridge")!;
    expect(fridge.name).toBe("Big fridge");
    expect(fridge.compartments.map((c) => [c.name, c.kind])).toEqual([
      ["Salad", "drawer"],
      ["Cheese", "shelf"],
    ]);
  });

  it("keeps the default compartments when the old fridge had none", () => {
    const fridge = fromLegacyZones([zone("f", "Fridge", "fridge", "Fridge")]).layout.hotspots.find(
      (h) => h.kind === "fridge",
    )!;
    expect(fridge.compartments.length).toBe(5);
  });

  it("reports zones that find no free spot and never invents places for them", () => {
    const shelves = ["a", "b", "c", "d"].map((k) => zone(k, `Shelf ${k}`, "shelf", `Place ${k}`));
    const { layout, unplaced } = fromLegacyZones(shelves);
    expect(unplaced).toEqual(["Shelf c", "Shelf d"]);
    expect(layout.hotspots.map((h) => h.location)).toContain("Place a");
    expect(layout.hotspots.map((h) => h.location)).not.toContain("Place c");
  });
});

describe("missingPlaces", () => {
  it("lists what the default layout needs on top of the default pantry places", () => {
    const have = [
      "Fridge",
      "Vegetable drawer",
      "Fruit drawer",
      "Freezer",
      "Dry-goods shelf",
      "Spice shelf",
    ].map((name) => loc({ name }));
    const names = missingPlaces(DEFAULT_LAYOUT, have).map((p) => p.name);
    expect(names).toContain("Meat and fish");
    expect(names).toContain("Frozen ready meals");
    expect(names).toContain("Base cabinet");
    expect(names).not.toContain("Fridge");
    expect(names).not.toContain("Vegetable drawer");
  });

  it("puts compartment places inside the place of their cabinet and lists parents first", () => {
    const missing = missingPlaces(DEFAULT_LAYOUT, []);
    const meat = missing.find((p) => p.name === "Meat and fish");
    expect(meat?.parent).toBe("Fridge");
    expect(missing.findIndex((p) => p.name === "Fridge")).toBeLessThan(
      missing.findIndex((p) => p.name === "Meat and fish"),
    );
  });

  it("matches existing names ignoring case and creates a shared name once", () => {
    const layout = readLayout({
      version: 2,
      room: { width: 100, height: 80, worktopY: 50, floorY: 70 },
      hotspots: [
        {
          key: "a",
          name: "A",
          door: "double",
          x: 5,
          y: 5,
          width: 20,
          height: 20,
          location: "Shelf",
        },
        {
          key: "b",
          name: "B",
          door: "double",
          x: 30,
          y: 5,
          width: 20,
          height: 20,
          location: "shelf",
        },
      ],
    }).layout!;
    expect(missingPlaces(layout, [])).toHaveLength(1);
    expect(missingPlaces(layout, [loc({ name: "SHELF" })])).toEqual([]);
  });
});
