import { describe, expect, it } from "vitest";
import { BUILTIN_CATEGORIES } from "../categories";
import { categoryIcon, iconLabel, matchIcon, resolveIcon } from "./registry";

// Product name (German or English), the category it would have, and the picture it must get.
const TABLE: readonly (readonly [name: string, category: string, icon: string])[] = [
  ["Butter", "dairy", "butter"],
  ["Weih.Butter", "dairy", "butter"],
  ["Milk", "dairy", "milk"],
  ["Milk (UHT) 1.5%", "dairy", "milk"],
  ["Vollmilch", "dairy", "milk"],
  ["Cream", "dairy", "cream"],
  ["Whipping cream", "dairy", "cream"],
  ["Schlagsahne", "dairy", "cream"],
  ["Sour cream", "dairy", "cream"],
  ["Saure Sahne", "dairy", "cream"],
  ["Schmand", "dairy", "cream"],
  ["Natural yogurt", "dairy", "yogurt"],
  ["Joghurt Natur", "dairy", "yogurt"],
  ["Quark", "dairy", "yogurt"],
  ["Magerquark", "dairy", "yogurt"],
  ["Gouda", "dairy", "cheese"],
  ["Mozzarella", "dairy", "cheese"],
  ["Cheese", "dairy", "cheese"],
  ["Frischkäse", "dairy", "cheese"],
  ["Eggs", "eggs", "egg"],
  ["Eier", "eggs", "egg"],
  ["Bio Eier M", "eggs", "egg"],
  ["Chicken breast", "poultry", "chicken"],
  ["Hähnchenbrustfilet", "poultry", "chicken"],
  ["Putenbrust", "poultry", "chicken"],
  ["Beef", "meat", "meat"],
  ["Rindfleisch", "meat", "meat"],
  ["Mixed minced meat", "meat", "meat"],
  ["Hackfleisch gemischt", "meat", "meat"],
  ["Pork chop", "meat", "ham"],
  ["Schweinefleisch", "meat", "ham"],
  ["Schinken", "meat", "ham"],
  ["Bratwurst", "meat", "sausage"],
  ["Salami", "meat", "sausage"],
  ["Salmon fillet", "fish", "fish"],
  ["Lachsfilet", "fish", "fish"],
  ["Thunfisch", "fish", "fish"],
  ["Shrimps", "fish", "shrimp"],
  ["Potatoes", "vegetables", "potato"],
  ["Kartoffeln", "vegetables", "potato"],
  ["Tomatoes", "vegetables", "tomato"],
  ["Rispentomaten", "vegetables", "tomato"],
  ["Cucumber", "vegetables", "cucumber"],
  ["Gurke", "vegetables", "cucumber"],
  ["Bell pepper", "vegetables", "bellpepper"],
  ["Paprika", "vegetables", "bellpepper"],
  ["Carrots", "vegetables", "carrot"],
  ["Karotten", "vegetables", "carrot"],
  ["Mushrooms", "vegetables", "mushroom"],
  ["Champignons", "vegetables", "mushroom"],
  ["Onions", "vegetables", "onion"],
  ["Zwiebeln", "vegetables", "onion"],
  ["Garlic", "vegetables", "garlic"],
  ["Knoblauch", "vegetables", "garlic"],
  ["Lemons", "fruit", "lemon"],
  ["Zitronen", "fruit", "lemon"],
  ["Apples", "fruit", "apple"],
  ["Äpfel", "fruit", "apple"],
  ["Grapes", "fruit", "grapes"],
  ["Trauben", "fruit", "grapes"],
  ["Nectarines", "fruit", "peach"],
  ["Nektarinen", "fruit", "peach"],
  ["Bananas", "fruit", "banana"],
  ["Orange", "fruit", "orange"],
  ["Bread", "bakery", "bread"],
  ["Toast bread", "bakery", "bread"],
  ["Rice", "dry goods", "rice"],
  ["Basmati rice", "dry goods", "rice"],
  ["Pasta", "dry goods", "pasta"],
  ["Spaghetti", "dry goods", "pasta"],
  ["Wheat flour", "dry goods", "grain"],
  ["Weizenmehl Type 405", "dry goods", "grain"],
  ["Sugar", "dry goods", "salt"],
  ["Zucker", "dry goods", "salt"],
  ["Mineral water", "drinks", "water"],
  ["Rhönsp.Miwa Natur.", "drinks", "water"],
  ["Apple juice", "drinks", "juice"],
  ["Apfelsaft", "drinks", "juice"],
  ["Ketchup", "sauces and condiments", "sauce"],
  ["Mustard", "sauces and condiments", "sauce"],
  ["Senf", "sauces and condiments", "sauce"],
  ["Mayonnaise", "sauces and condiments", "sauce"],
  ["Olive oil", "oils and fats", "olive"],
  ["Olivenöl", "oils and fats", "olive"],
  ["Toilet paper", "household", "paper"],
  ["Toilettenpapier", "household", "paper"],
];

describe("product names get fitting pictures", () => {
  it("has a table of at least 60 names", () => {
    expect(TABLE.length).toBeGreaterThanOrEqual(60);
  });

  it.each(TABLE)("%s (%s) gets %s", (name, category, icon) => {
    expect(resolveIcon({ name, category })).toBe(icon);
  });
});

describe("different products never share a picture", () => {
  const pairs: readonly (readonly [string, string])[] = [
    ["Butter", "Milk"],
    ["Eggs", "Milk"],
    ["Cream", "Milk"],
    ["Sour cream", "Yogurt"],
    ["Butter", "Cheese"],
    ["Butter", "Cream"],
    ["Eggs", "Butter"],
    ["Beef", "Pork chop"],
    ["Chicken breast", "Beef"],
    ["Salmon", "Chicken breast"],
    ["Ketchup", "Tomatoes"],
    ["Ketchup", "Olive oil"],
    ["Apples", "Bananas"],
    ["Potatoes", "Tomatoes"],
    ["Rice", "Pasta"],
    ["Water", "Apple juice"],
  ];

  it.each(pairs)("%s and %s", (a, b) => {
    const iconA = resolveIcon({ name: a, category: "other" });
    const iconB = resolveIcon({ name: b, category: "other" });
    expect(iconA).not.toBe(iconB);
  });

  it("holds for the dairy basics", () => {
    const dairy = ["Butter", "Milk", "Cream", "Natural yogurt", "Cheese", "Eggs"].map((n) => resolveIcon({ name: n, category: "dairy" }));
    expect(new Set(dairy).size).toBe(dairy.length);
  });
});

describe("category fallbacks", () => {
  it("give every category a picture that is right for it", () => {
    const expected: Record<string, string> = {
      vegetables: "broccoli",
      fruit: "apple",
      meat: "meat",
      poultry: "chicken",
      fish: "fish",
      dairy: "milk",
      eggs: "egg",
      bakery: "bread",
      "dry goods": "grain",
      canned: "canned",
      "sauces and condiments": "sauce",
      spices: "salt",
      "oils and fats": "olive",
      "snacks and sweets": "chocolate",
      drinks: "soda",
      frozen: "ice",
      household: "sponge",
      other: "box",
    };
    for (const c of BUILTIN_CATEGORIES) expect(categoryIcon(c)).toBe(expected[c]);
  });

  it("does not show broccoli for sauces or a milk glass for eggs", () => {
    expect(categoryIcon("sauces and condiments")).not.toBe("broccoli");
    expect(categoryIcon("eggs")).not.toBe("milk");
    expect(resolveIcon({ name: "Xyzzy", category: "eggs" })).toBe("egg");
  });

  it("uses the box for an unknown category and for no match", () => {
    expect(categoryIcon("baby food")).toBe("box");
    expect(matchIcon("Xyzzy")).toBeNull();
  });

  it("labels the new pictures", () => {
    expect(iconLabel("cream")).toBe("Cream");
    expect(iconLabel("sauce")).toBe("Sauce bottle");
  });
});
