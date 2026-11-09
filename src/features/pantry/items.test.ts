import { describe, expect, it } from "vitest";
import { addQty, expiryLabel, mergePatch, expiryState, filterItems, findDuplicate, groupByLocation, NO_FILTER } from "./items";
import { item, loc } from "./fixtures";
import { stepFor } from "./model";

const today = new Date(2026, 5, 10); // 10 June 2026

describe("quantities", () => {
  it("adds without floating point noise", () => {
    expect(addQty(0.1, 0.2)).toBe(0.3);
    expect(addQty(250, 500)).toBe(750);
  });

  it("uses a sensible step per unit", () => {
    expect(stepFor("pieces")).toBe(1);
    expect(stepFor("g")).toBe(100);
    expect(stepFor("kg")).toBe(0.5);
  });
});

describe("findDuplicate", () => {
  const milk = item({ id: "a", name: "Milk", unit: "l", location_id: "fridge" });

  it("matches the same name, unit and place, ignoring case and spacing", () => {
    expect(findDuplicate([milk], { name: "  milk ", unit: "l", location_id: "fridge" })).toBe(milk);
  });

  it("does not match another unit or place", () => {
    expect(findDuplicate([milk], { name: "Milk", unit: "ml", location_id: "fridge" })).toBeUndefined();
    expect(findDuplicate([milk], { name: "Milk", unit: "l", location_id: "shelf" })).toBeUndefined();
    expect(findDuplicate([milk], { name: "Milk", unit: "l", location_id: null })).toBeUndefined();
  });

  it("can ignore the item being edited", () => {
    expect(findDuplicate([milk], { name: "Milk", unit: "l", location_id: "fridge" }, "a")).toBeUndefined();
  });
});

describe("expiry", () => {
  it("has no state without a date", () => {
    expect(expiryState(null, today)).toBe("none");
    expect(expiryLabel(null, today)).toBe("");
  });

  it("flags expired, soon and ok", () => {
    expect(expiryState("2026-06-09", today)).toBe("expired");
    expect(expiryState("2026-06-10", today)).toBe("soon");
    expect(expiryState("2026-06-13", today)).toBe("soon");
    expect(expiryState("2026-06-14", today)).toBe("ok");
  });

  it("labels the days", () => {
    expect(expiryLabel("2026-06-08", today)).toBe("Expired");
    expect(expiryLabel("2026-06-10", today)).toBe("Today");
    expect(expiryLabel("2026-06-11", today)).toBe("Tomorrow");
    expect(expiryLabel("2026-06-13", today)).toBe("In 3 days");
  });

  it("ignores the time of day", () => {
    expect(expiryState("2026-06-10", new Date(2026, 5, 10, 23, 59))).toBe("soon");
  });
});

describe("filterItems", () => {
  const fridge = loc({ id: "f", name: "Fridge" });
  const drawer = loc({ id: "d", name: "Vegetable drawer", parent_id: "f", kind: "drawer" });
  const shelf = loc({ id: "s", name: "Shelf", kind: "shelf" });
  const places = [fridge, drawer, shelf];
  const items = [
    item({ name: "Carrots", category: "produce", location_id: "d" }),
    item({ name: "Cheddar", category: "dairy", location_id: "f" }),
    item({ name: "Rice", category: "dry goods", location_id: "s" }),
  ];
  const names = (f: Partial<typeof NO_FILTER>) => filterItems(items, places, { ...NO_FILTER, ...f }).map((i) => i.name);

  it("returns everything with no filter", () => {
    expect(names({})).toHaveLength(3);
  });

  it("searches names case-insensitively", () => {
    expect(names({ query: "CAR" })).toEqual(["Carrots"]);
  });

  it("filters by category", () => {
    expect(names({ category: "dairy" })).toEqual(["Cheddar"]);
  });

  it("includes items in places inside the chosen place", () => {
    expect(names({ locationId: "f" })).toEqual(["Carrots", "Cheddar"]);
    expect(names({ locationId: "d" })).toEqual(["Carrots"]);
  });

  it("combines filters", () => {
    expect(names({ query: "c", category: "produce", locationId: "f" })).toEqual(["Carrots"]);
  });
});

describe("groupByLocation", () => {
  const fridge = loc({ id: "f", name: "Fridge", position: 0 });
  const drawer = loc({ id: "d", name: "Vegetable drawer", parent_id: "f", kind: "drawer" });
  const shelf = loc({ id: "s", name: "Shelf", kind: "shelf", position: 1 });

  it("orders groups like the places tree and names the path", () => {
    const groups = groupByLocation(
      [item({ name: "Rice", location_id: "s" }), item({ name: "Carrots", location_id: "d" }), item({ name: "Cheese", location_id: "f" })],
      [shelf, drawer, fridge],
    );
    expect(groups.map((g) => g.label)).toEqual(["Fridge", "Fridge › Vegetable drawer", "Shelf"]);
  });

  it("sorts items by name and hides empty places", () => {
    const groups = groupByLocation([item({ name: "b", location_id: "f" }), item({ name: "a", location_id: "f" })], [fridge, shelf]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.items.map((i) => i.name)).toEqual(["a", "b"]);
  });

  it("puts items without a known place last", () => {
    const groups = groupByLocation(
      [item({ name: "x", location_id: null }), item({ name: "y", location_id: "gone" }), item({ location_id: "f" })],
      [fridge],
    );
    expect(groups.map((g) => g.label)).toEqual(["Fridge", "No place"]);
    expect(groups[1]?.items).toHaveLength(2);
  });
});

describe("mergePatch", () => {
  it("adds the quantities", () => {
    expect(mergePatch({ quantity: 2, expires_on: null }, { quantity: 3 }).quantity).toBe(5);
    expect(mergePatch({ quantity: 0.1, expires_on: null }, { quantity: 0.2 }).quantity).toBe(0.3);
  });

  it("counts a missing incoming quantity as one", () => {
    expect(mergePatch({ quantity: 2, expires_on: null }, {}).quantity).toBe(3);
  });

  it("keeps the sooner expiry date", () => {
    expect(mergePatch({ quantity: 1, expires_on: "2026-07-01" }, { expires_on: "2026-06-20" }).expires_on).toBe("2026-06-20");
    expect(mergePatch({ quantity: 1, expires_on: "2026-06-20" }, { expires_on: "2026-07-01" }).expires_on).toBe("2026-06-20");
    expect(mergePatch({ quantity: 1, expires_on: null }, { expires_on: "2026-07-01" }).expires_on).toBe("2026-07-01");
    expect(mergePatch({ quantity: 1, expires_on: "2026-07-01" }, {}).expires_on).toBe("2026-07-01");
    expect(mergePatch({ quantity: 1, expires_on: null }, {}).expires_on).toBeNull();
  });
});
