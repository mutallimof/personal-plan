import { describe, expect, it } from "vitest";
import { item, loc } from "@/features/pantry/fixtures";
import { contentsOf } from "./contents";
import { LOOSE_ID } from "./interior";
import { DEFAULT_LAYOUT } from "./legacy";
import { itemsOfPlace, placeByName, searchItems, spotFinder } from "./locate";

const fridge = loc({ id: "p-fridge", name: "Fridge" });
const veg = loc({ id: "p-veg", name: "Vegetable drawer", kind: "drawer", parent_id: "p-fridge" });
const crisper = loc({ id: "p-crisper", name: "Crisper", kind: "drawer", parent_id: "p-veg" });
const dry = loc({ id: "p-dry", name: "Dry-goods shelf", kind: "shelf" });
const garage = loc({ id: "p-garage", name: "Garage", kind: "other" });
const places = [fridge, veg, crisper, dry, garage];

const milk = item({ id: "milk", name: "Milk", location_id: "p-fridge" });
const carrots = item({ id: "carrots", name: "Carrots", location_id: "p-veg" });
const spinach = item({ id: "spinach", name: "Spinach", location_id: "p-crisper" });
const rice = item({ id: "rice", name: "Basmati rice", location_id: "p-dry" });
const beans = item({ id: "beans", name: "Black beans", location_id: "p-dry", shelf: 1 });
const water = item({ id: "water", name: "Water", location_id: "p-garage" });
const lost = item({ id: "lost", name: "Lost thing", location_id: null });
const all = [milk, carrots, spinach, rice, beans, water, lost];

describe("spotFinder", () => {
  const find = spotFinder(DEFAULT_LAYOUT, places);
  it("finds the cabinet and compartment of a place", () => {
    expect(find("p-veg")).toMatchObject({
      hotspot: { key: "fridge" },
      compartment: { key: "veg" },
    });
    expect(find("p-dry")).toMatchObject({ hotspot: { key: "wall-shelf" }, compartment: null });
    expect(find("p-fridge")).toMatchObject({ hotspot: { key: "fridge" }, compartment: null });
  });
  it("treats a place inside a shown place as part of it", () => {
    expect(find("p-crisper")).toMatchObject({
      hotspot: { key: "fridge" },
      compartment: { key: "veg" },
    });
  });
  it("gives null for places that are not on the kitchen, and for no place", () => {
    expect(find("p-garage")).toBeNull();
    expect(find(null)).toBeNull();
  });
  it("matches place names without regard to case", () => {
    expect(placeByName(places, "fridge")?.id).toBe("p-fridge");
    expect(placeByName(places, null)).toBeUndefined();
  });
});

describe("searchItems", () => {
  it("finds an item and says which cabinet and compartment to zoom to", () => {
    const [hit] = searchItems(all, places, DEFAULT_LAYOUT, "carrot");
    expect(hit?.item.id).toBe("carrots");
    expect(hit?.spot?.hotspot.key).toBe("fridge");
    expect(hit?.spot?.compartment?.key).toBe("veg");
    expect(hit?.path).toBe("Fridge › Vegetable drawer");
  });

  it("needs every word, in any order, ignoring case", () => {
    expect(searchItems(all, places, DEFAULT_LAYOUT, "RICE basmati").map((h) => h.item.id)).toEqual([
      "rice",
    ]);
    expect(searchItems(all, places, DEFAULT_LAYOUT, "rice pasta")).toEqual([]);
  });

  it("puts names that start with the text first", () => {
    const hits = searchItems(
      [item({ id: "x", name: "Brown rice" }), item({ id: "y", name: "Rice cakes" })],
      places,
      DEFAULT_LAYOUT,
      "rice",
    );
    expect(hits.map((h) => h.item.id)).toEqual(["y", "x"]);
  });

  it("still finds items that are not on the kitchen, without a spot", () => {
    const [hit] = searchItems(all, places, DEFAULT_LAYOUT, "water");
    expect(hit?.spot).toBeNull();
    expect(hit?.path).toBe("Garage");
    expect(searchItems(all, places, DEFAULT_LAYOUT, "lost")[0]?.path).toBe("No place");
  });

  it("returns nothing for an empty search and caps the list", () => {
    expect(searchItems(all, places, DEFAULT_LAYOUT, "  ")).toEqual([]);
    const many = Array.from({ length: 20 }, (_, i) =>
      item({ name: `Rice ${i}`, location_id: "p-dry" }),
    );
    expect(searchItems(many, places, DEFAULT_LAYOUT, "rice")).toHaveLength(8);
  });
});

describe("contentsOf", () => {
  const contents = contentsOf(DEFAULT_LAYOUT, all, places);
  const ids = (key: string, row: string) =>
    contents
      .get(key)
      ?.get(row)
      ?.map((i) => i.id);

  it("puts compartment items in their compartment and loose fridge items in the last row", () => {
    expect(ids("fridge", "veg")).toEqual(["carrots", "spinach"]);
    expect(ids("fridge", LOOSE_ID)).toEqual(["milk"]);
  });

  it("puts plain cabinet items on their saved shelf, or from the top", () => {
    expect(ids("wall-shelf", "shelf-1")).toEqual(["beans"]);
    expect(ids("wall-shelf", "shelf-0")).toEqual(["rice"]);
  });

  it("leaves out items whose place is not on the kitchen", () => {
    const flat = [...contents.values()]
      .flatMap((rows) => [...rows.values()].flat())
      .map((i) => i.id);
    expect(flat).not.toContain("water");
    expect(flat).not.toContain("lost");
  });

  it("agrees with itemsOfPlace", () => {
    const h = DEFAULT_LAYOUT.hotspots.find((x) => x.key === "fridge")!;
    const veg = h.compartments.find((c) => c.key === "veg")!;
    expect(itemsOfPlace(all, places, DEFAULT_LAYOUT, h, veg).map((i) => i.id)).toEqual([
      "carrots",
      "spinach",
    ]);
  });
});
