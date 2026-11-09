import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATEGORIES } from "../model";
import {
  aliasIconMap,
  categoryIcon,
  fold,
  ICONS,
  iconForItem,
  iconUrl,
  isIconKey,
  matchIcon,
  resolveIcon,
  searchIcons,
} from "./registry";

describe("icon files", () => {
  it("has a file in public/icons/food for every icon, so nothing is loaded from outside", () => {
    const missing = ICONS.filter((i) => !existsSync(join(process.cwd(), "public", iconUrl(i.key))));
    expect(missing.map((i) => i.key)).toEqual([]);
  });
  it("has unique keys and gives every category a real icon", () => {
    expect(new Set(ICONS.map((i) => i.key)).size).toBe(ICONS.length);
    for (const c of CATEGORIES) expect(isIconKey(categoryIcon(c))).toBe(true);
  });
});

describe("fold", () => {
  it("removes case and accents", () => {
    expect(fold("Käse")).toBe("kase");
    expect(fold("Süßkartoffel")).toBe("susskartoffel");
    expect(fold("  Crème  fraîche! ")).toBe("creme fraiche");
  });
});

describe("matchIcon", () => {
  it.each([
    ["Milk", "milk"],
    ["Vollmilch 3,5%", "milk"],
    ["Eggs", "egg"],
    ["Eier", "egg"],
    ["Bio Tomaten", "tomato"],
    ["Tomatoes", "tomato"],
    ["Vollkornbrot", "bread"],
    ["Käse", "cheese"],
    ["Joghurt", "yogurt"],
    ["Süßkartoffel", "sweetpotato"],
    ["Orangensaft", "juice"],
    ["Orange", "orange"],
    ["Apple juice", "juice"],
    ["Tomato soup", "soup"],
    ["Chocolate", "chocolate"],
    ["Buttermilk", "milk"],
    ["Milchreis", "rice"],
    ["Hundefutter", "dog"],
    ["Öl", "olive"],
  ])("%s gets %s", (name, key) => {
    expect(matchIcon(name)).toBe(key);
  });

  it("only lets short words match whole words", () => {
    expect(matchIcon("Hamburger")).toBe("burger");
    expect(matchIcon("Schmuck")).toBeNull();
    expect(matchIcon("Gingerbread")).toBe("bread");
  });

  it("gives nothing for unknown or empty names", () => {
    expect(matchIcon("Xyzzy")).toBeNull();
    expect(matchIcon("   ")).toBeNull();
  });
});

describe("resolveIcon", () => {
  it("prefers the item's own icon, then the dictionary's, then the name, then the category", () => {
    expect(resolveIcon({ icon: "cheese", aliasIcon: "egg", name: "Milk", category: "dairy" })).toBe(
      "cheese",
    );
    expect(resolveIcon({ icon: null, aliasIcon: "egg", name: "Milk", category: "dairy" })).toBe(
      "egg",
    );
    expect(resolveIcon({ icon: null, aliasIcon: null, name: "Milk", category: "dairy" })).toBe(
      "milk",
    );
    expect(resolveIcon({ icon: null, name: "Mystery", category: "frozen" })).toBe("ice");
  });
  it("ignores icon keys that do not exist (for example from an old file)", () => {
    expect(
      resolveIcon({ icon: "dragon", aliasIcon: "nope", name: "Milk", category: "dairy" }),
    ).toBe("milk");
  });
  it("falls back to the box for an unknown category", () => {
    expect(resolveIcon({ name: "Mystery", category: "weird" })).toBe("box");
  });
});

describe("dictionary icons", () => {
  const map = aliasIconMap([
    { product_name: "Oat drink", icon: "milk" },
    { product_name: "Bad", icon: "dragon" },
    { product_name: "None", icon: null },
  ]);
  it("keeps only real icons, by lower-case product name", () => {
    expect([...map.entries()]).toEqual([["oat drink", "milk"]]);
  });
  it("is used for items with no icon of their own", () => {
    expect(iconForItem({ name: "Oat Drink", category: "drinks", icon: null }, map)).toBe("milk");
    expect(iconForItem({ name: "Oat Drink", category: "drinks", icon: "coffee" }, map)).toBe(
      "coffee",
    );
  });
});

describe("searchIcons", () => {
  it("lists everything for an empty search", () => {
    expect(searchIcons("")).toHaveLength(ICONS.length);
  });
  it("finds by label, key and keyword in English and German", () => {
    expect(searchIcons("milk").map((i) => i.key)).toContain("milk");
    expect(searchIcons("kase").map((i) => i.key)).toContain("cheese");
    expect(searchIcons("KÄSE").map((i) => i.key)).toContain("cheese");
    expect(searchIcons("zzzz")).toEqual([]);
  });
});
