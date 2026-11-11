import { describe, expect, it } from "vitest";
import { item, loc } from "./fixtures";
import { proposeMoves } from "./organize";
import { parseReceiptText } from "./receipt";
import { buildReview, editLine } from "./review";

const fridge = loc({ id: "f", name: "Fridge", kind: "fridge" });
const meat = loc({ id: "m", name: "Meat and fish", kind: "shelf", parent_id: "f", accepts: ["meat", "poultry", "fish"] });
const veg = loc({ id: "v", name: "Vegetable drawer", kind: "drawer", parent_id: "f", accepts: ["vegetables"] });
const dairy = loc({ id: "d", name: "Dairy and eggs", kind: "shelf", parent_id: "f", accepts: ["dairy", "eggs"] });
const spice = loc({ id: "sp", name: "Spice shelf", kind: "shelf", accepts: [] });
const places = [fridge, meat, veg, dairy, spice];

describe("proposeMoves", () => {
  it("proposes moving salmon out of the vegetable drawer", () => {
    const salmon = item({ id: "a", name: "Salmon", category: "fish", location_id: "v" });
    const [move] = proposeMoves([salmon], places);
    expect(move?.item.id).toBe("a");
    expect(move?.to.id).toBe("m");
  });

  it("leaves items that are already in an accepting place", () => {
    expect(proposeMoves([item({ category: "vegetables", location_id: "v" })], places)).toEqual([]);
  });

  it("proposes a place for items with none, and for items in a plain parent like the fridge", () => {
    expect(proposeMoves([item({ id: "x", category: "dairy", location_id: null })], places)[0]?.to.id).toBe("d");
    expect(proposeMoves([item({ id: "y", category: "dairy", location_id: "f" })], places)[0]?.to.id).toBe("d");
  });

  it("leaves items in a place with no preference, and categories nobody accepts", () => {
    expect(proposeMoves([item({ category: "spices", location_id: "sp" })], places)).toEqual([]);
    expect(proposeMoves([item({ category: "other", location_id: "f" })], places)).toEqual([]);
  });

  it("does not change anything itself", () => {
    const salmon = item({ name: "Salmon", category: "fish", location_id: "v" });
    proposeMoves([salmon], places);
    expect(salmon.location_id).toBe("v");
  });
});

describe("review: category and place", () => {
  const line = () =>
    buildReview(parseReceiptText("Lachsfilet XY   5,00 B").lines, [], null, places)[0]!;

  it("puts a guessed fish in the meat and fish place", () => {
    expect(line()).toMatchObject({ category: "fish", locationId: "m" });
  });

  it("moves to a place that accepts the new category when the category changes", () => {
    const next = editLine(line(), { category: "vegetables" }, places);
    expect(next).toMatchObject({ category: "vegetables", locationId: "v", edited: true });
  });

  it("keeps a place that accepts the new category", () => {
    const next = editLine(line(), { category: "meat" }, places);
    expect(next.locationId).toBe("m");
  });

  it("leaves non-food behind when the category changes", () => {
    const toipa = buildReview(parseReceiptText("Toipa   2,00 A").lines, [], null, places)[0]!;
    expect(toipa).toMatchObject({ category: "household", skip: true, autoSkip: true });
    expect(editLine(toipa, { category: "other" }, places)).toMatchObject({ skip: false, autoSkip: false });
  });
});
