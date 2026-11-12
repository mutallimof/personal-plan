import { describe, expect, it } from "vitest";
import { DEFAULT_LOCATIONS, descendantIds, firstOfKind, locationPath, sortLocations } from "./locations";
import { loc } from "./fixtures";

describe("DEFAULT_LOCATIONS", () => {
  it("lists parents before the children that name them", () => {
    DEFAULT_LOCATIONS.forEach((l, i) => {
      if (l.parent) expect(DEFAULT_LOCATIONS.findIndex((p) => p.name === l.parent)).toBeLessThan(i);
    });
  });

  it("has the fridge drawers, a freezer and two shelves", () => {
    expect(DEFAULT_LOCATIONS.map((l) => l.name)).toEqual([
      "Fridge",
      "Meat and fish",
      "Dairy and eggs",
      "Vegetable drawer",
      "Fruit drawer",
      "Drinks and sauces",
      "Freezer",
      "Dry-goods shelf",
      "Spice shelf",
    ]);
  });
});

describe("location tree", () => {
  const fridge = loc({ id: "f", name: "Fridge", position: 0 });
  const veg = loc({ id: "v", name: "Veg", parent_id: "f", position: 0 });
  const fruit = loc({ id: "fr", name: "Fruit", parent_id: "f", position: 1 });
  const shelf = loc({ id: "s", name: "Shelf", kind: "shelf", position: 1 });
  const all = [shelf, fruit, veg, fridge];

  it("sorts parents before children", () => {
    expect(sortLocations(all).map((l) => l.id)).toEqual(["f", "v", "fr", "s"]);
  });

  it("treats a place with a missing parent as top level", () => {
    const orphan = loc({ id: "o", name: "Orphan", parent_id: "gone", position: 5 });
    expect(sortLocations([orphan, fridge]).map((l) => l.id)).toEqual(["f", "o"]);
  });

  it("builds a path", () => {
    expect(locationPath(all, "v")).toBe("Fridge › Veg");
    expect(locationPath(all, "s")).toBe("Shelf");
    expect(locationPath(all, "nope")).toBe("");
  });

  it("does not loop on a cycle", () => {
    const a = loc({ id: "a", name: "A", parent_id: "b" });
    const b = loc({ id: "b", name: "B", parent_id: "a" });
    expect(locationPath([a, b], "a")).toBe("B › A");
    expect(descendantIds([a, b], "a")).toEqual(["b"]);
  });

  it("finds descendants at any depth", () => {
    const deep = loc({ id: "x", name: "Box", parent_id: "v" });
    expect(descendantIds([...all, deep], "f").sort()).toEqual(["fr", "v", "x"]);
    expect(descendantIds(all, "s")).toEqual([]);
  });

  it("finds the first place of a kind", () => {
    expect(firstOfKind(all, "shelf")?.id).toBe("s");
    expect(firstOfKind(all, "freezer")).toBeUndefined();
  });
});
