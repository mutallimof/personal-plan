import { describe, expect, it } from "vitest";
import { BUILTIN_CATEGORIES, DEFAULT_ACCEPTS, defaultAmount, guessCategory, kindForCategory, legacyCategory } from "./categories";
import { categoryOptions, keyFromLabel, newCategoryProblem, renameProblem } from "./category-labels";
import { DEFAULT_LOCATIONS, pickPlace } from "./locations";
import { loc } from "./fixtures";

describe("category list", () => {
  it("has the new list and no broad produce", () => {
    expect(BUILTIN_CATEGORIES).toEqual([
      "vegetables",
      "fruit",
      "meat",
      "poultry",
      "fish",
      "dairy",
      "eggs",
      "bakery",
      "dry goods",
      "canned",
      "sauces and condiments",
      "spices",
      "oils and fats",
      "snacks and sweets",
      "drinks",
      "frozen",
      "household",
      "other",
    ]);
    expect(BUILTIN_CATEGORIES).not.toContain("produce");
  });

  it("maps old names onto the new list", () => {
    expect(legacyCategory("produce")).toBe("other");
    expect(legacyCategory("snacks")).toBe("snacks and sweets");
    expect(legacyCategory("meat")).toBe("meat");
  });

  it("gives every category a kind of place", () => {
    for (const c of BUILTIN_CATEGORIES) expect(kindForCategory(c)).toBeTruthy();
    expect(kindForCategory("my own")).toBe("shelf");
  });
});

describe("guessCategory", () => {
  it.each([
    ["Hähnchenbrustfilet", "poultry"],
    ["Lachsfilet", "fish"],
    ["Bratwurst", "meat"],
    ["Butter", "dairy"],
    ["Eier", "eggs"],
    ["Apfelsaft", "drinks"],
    ["Äpfel", "fruit"],
    ["Kartoffelchips", "snacks and sweets"],
    ["Kartoffeln", "vegetables"],
    ["Tomatenmark", "canned"],
    ["Ketchup", "sauces and condiments"],
    ["Olivenöl", "oils and fats"],
    ["Toipa", "household"],
    ["TK Spinat", "frozen"],
  ])("%s is %s", (text, category) => {
    expect(guessCategory(text)).toBe(category);
  });

  it("does not guess for unknown text", () => {
    expect(guessCategory("KLC Papr. edels.")).toBeNull();
    expect(guessCategory("bev.Flüssigs.NFB")).toBeNull();
  });

  it("uses the tax letter only as a help for weak words", () => {
    expect(guessCategory("Backfolie extra", "A")).toBe("household");
    expect(guessCategory("Backfolie extra", "B")).toBeNull();
    expect(guessCategory("Backfolie extra")).toBeNull();
    expect(guessCategory("Nudeln", "A")).toBe("dry goods");
  });
});

describe("defaultAmount", () => {
  it("follows the unit rules", () => {
    expect(defaultAmount("Milk", "dairy")).toEqual({ unit: "l", quantity: 1 });
    expect(defaultAmount("Mineral water", "drinks")).toEqual({ unit: "l", quantity: 1 });
    expect(defaultAmount("Butter", "dairy").unit).toBe("g");
    expect(defaultAmount("Eggs", "eggs")).toEqual({ unit: "pieces", quantity: 10 });
    expect(defaultAmount("Salmon", "fish").unit).toBe("g");
    expect(defaultAmount("Apples", "fruit")).toEqual({ unit: "pieces", quantity: 1 });
  });
});

describe("places follow categories", () => {
  const fridge = loc({ id: "f", name: "Fridge", kind: "fridge" });
  const veg = loc({ id: "v", name: "Vegetable drawer", kind: "drawer", parent_id: "f", accepts: ["vegetables"] });
  const meat = loc({ id: "m", name: "Meat and fish", kind: "shelf", parent_id: "f", accepts: ["meat", "poultry", "fish"] });
  const shelf = loc({ id: "s", name: "Dry-goods shelf", kind: "shelf", accepts: ["dry goods", "canned"] });
  const all = [shelf, veg, meat, fridge];

  it("picks the first place that accepts the category", () => {
    expect(pickPlace(all, "fish")?.id).toBe("m");
    expect(pickPlace(all, "poultry")?.id).toBe("m");
    expect(pickPlace(all, "vegetables")?.id).toBe("v");
    expect(pickPlace(all, "canned")?.id).toBe("s");
  });

  it("falls back to a place of the usual kind when nothing accepts it", () => {
    expect(pickPlace(all, "dairy", null, "fridge")?.id).toBe("f");
    expect(pickPlace([], "dairy", null, "fridge")).toBeNull();
  });

  it("prefers the wanted kind when several places accept the category", () => {
    const drawer = loc({ id: "d", name: "Extra", kind: "drawer", accepts: ["fish"] });
    expect(pickPlace([meat, drawer], "fish", "drawer")?.id).toBe("d");
  });

  it("has defaults for the places named in the plan", () => {
    const byName = Object.fromEntries(DEFAULT_LOCATIONS.map((l) => [l.name, l.accepts]));
    expect(byName["Meat and fish"]).toEqual(["meat", "poultry", "fish"]);
    expect(byName["Dairy and eggs"]).toEqual(["dairy", "eggs"]);
    expect(byName["Vegetable drawer"]).toEqual(["vegetables"]);
    expect(byName["Fruit drawer"]).toEqual(["fruit"]);
    expect(byName["Drinks and sauces"]).toEqual(["drinks", "sauces and condiments"]);
    expect(byName["Dry-goods shelf"]).toEqual(["dry goods", "canned", "spices", "oils and fats", "snacks and sweets", "bakery"]);
    expect(Object.keys(DEFAULT_ACCEPTS)).toContain("Freezer");
  });

  it("never lists the same category twice for fridge places", () => {
    const seen = new Set<string>();
    for (const l of DEFAULT_LOCATIONS.filter((x) => x.parent === "Fridge"))
      for (const c of l.accepts ?? []) {
        expect(seen.has(c)).toBe(false);
        seen.add(c);
      }
  });
});

describe("editable categories", () => {
  it("lists built-in categories, renamed ones and own ones", () => {
    const opts = categoryOptions([
      { key: "fruit", label: "Fresh fruit" },
      { key: "baby food", label: "Baby food" },
    ]);
    expect(opts.find((o) => o.value === "fruit")?.label).toBe("Fresh fruit");
    expect(opts.find((o) => o.value === "meat")?.label).toBe("Meat");
    expect(opts.at(-1)).toEqual({ value: "baby food", label: "Baby food", builtin: false });
    expect(opts).toHaveLength(19);
  });

  it("makes a stable key from a name", () => {
    expect(keyFromLabel("Käse & Co")).toBe("kaese co");
    expect(keyFromLabel("  Baby   food! ")).toBe("baby food");
  });

  it("rejects empty and repeated names", () => {
    expect(newCategoryProblem("", [])).toBe("Enter a name");
    expect(newCategoryProblem("Fruit", [])).toBe("That category exists");
    expect(newCategoryProblem("Baby food", [])).toBeNull();
    expect(renameProblem("fruit", "Meat", [])).toBe("That name is used");
    expect(renameProblem("fruit", "Fresh fruit", [])).toBeNull();
  });
});
