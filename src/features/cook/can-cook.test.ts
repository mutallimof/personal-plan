import { describe, expect, it } from "vitest";
import { item } from "@/features/pantry/fixtures";
import { lineStatus, matchingItems, missingText, rankRecipes, type Need } from "./can-cook";

const today = new Date("2026-03-10T12:00:00");
const rice = item({ id: "rice", name: "Rice", quantity: 1, unit: "kg" });
const eggs = item({ id: "eggs", name: "Eggs", quantity: 6, unit: "pieces" });
const milk = item({ id: "milk", name: "Milk", quantity: 0.5, unit: "l", expires_on: "2026-03-11" });
const need = (name: string, quantity: number, unit: Need["unit"]): Need => ({ name, quantity, unit });

describe("matchingItems", () => {
  it("matches by name, ignoring case and plural", () => {
    expect(matchingItems(need("egg", 1, "pieces"), [eggs, rice]).map((i) => i.id)).toEqual(["eggs"]);
  });

  it("matches a linked item whatever its name", () => {
    expect(matchingItems({ ...need("Grain", 1, "g"), pantry_item_id: "rice" }, [rice, eggs]).map((i) => i.id)).toEqual(["rice"]);
  });
});

describe("lineStatus", () => {
  it("converts kg to g", () => {
    const s = lineStatus(need("Rice", 400, "g"), [rice]);
    expect(s.state).toBe("ok");
    expect(s.have).toBe(1000);
  });

  it("adds up several items with the same name", () => {
    const more = item({ id: "rice2", name: "rice", quantity: 500, unit: "g" });
    expect(lineStatus(need("Rice", 1.4, "kg"), [rice, more]).state).toBe("ok");
    expect(lineStatus(need("Rice", 1.6, "kg"), [rice, more])).toMatchObject({ state: "short", have: 1.5 });
  });

  it("reports how much is missing", () => {
    expect(lineStatus(need("Eggs", 10, "pieces"), [eggs])).toMatchObject({ state: "short", have: 6, short: 4 });
  });

  it("reports an ingredient that is not there at all", () => {
    expect(lineStatus(need("Flour", 100, "g"), [rice, eggs])).toMatchObject({ state: "missing", short: 100 });
  });

  it("does not convert between pieces and grams, but counts the food as in stock", () => {
    const s = lineStatus(need("Eggs", 300, "g"), [eggs]);
    expect(s).toMatchObject({ state: "ok", loose: true, have: 0, short: 0 });
  });

  it("does not count a used-up entry as stock", () => {
    expect(lineStatus(need("Eggs", 2, "pieces"), [item({ name: "Eggs", quantity: 0, unit: "pieces" })]).state).toBe("missing");
  });

  it("scales by servings", () => {
    expect(lineStatus(need("Rice", 400, "g"), [rice], 3).state).toBe("short");
  });
});

describe("missingText", () => {
  it("says what is wrong with each kind of line", () => {
    expect(missingText(lineStatus(need("Flour", 100, "g"), [rice]))).toBe("Flour");
    expect(missingText(lineStatus(need("Eggs", 10, "pieces"), [eggs]))).toBe("Eggs (4 pieces more)");
  });
});

describe("rankRecipes", () => {
  const recipes = [
    { id: "r-rice", title: "Rice and eggs" },
    { id: "r-pancake", title: "Pancakes" },
    { id: "r-cake", title: "Cake" },
    { id: "r-empty", title: "Nothing" },
  ];
  const needs = new Map<string, Need[]>([
    ["r-rice", [need("Rice", 200, "g"), need("Eggs", 2, "pieces")]],
    ["r-pancake", [need("Milk", 300, "ml"), need("Eggs", 2, "pieces"), need("Flour", 200, "g")]],
    ["r-cake", [need("Flour", 200, "g"), need("Sugar", 100, "g"), need("Eggs", 3, "pieces"), need("Butter", 100, "g")]],
  ]);

  it("puts complete recipes first, then missing 1 and 2, and leaves out the rest", () => {
    const ranked = rankRecipes(recipes, needs, [rice, eggs, milk], today);
    // Cake lacks flour, sugar and butter (three), so it is not suggested.
    expect(ranked.map((c) => [c.recipe.id, c.missing.length])).toEqual([
      ["r-rice", 0],
      ["r-pancake", 1],
    ]);
  });

  it("includes a recipe that misses two", () => {
    const ranked = rankRecipes(recipes, needs, [eggs, rice, item({ name: "Flour", quantity: 1, unit: "kg" })], today);
    expect(ranked.find((c) => c.recipe.id === "r-cake")?.missing.map((l) => l.need.name)).toEqual(["Sugar", "Butter"]);
  });

  it("names what is missing", () => {
    const pancake = rankRecipes(recipes, needs, [rice, eggs, milk], today).find((c) => c.recipe.id === "r-pancake");
    expect(pancake?.missing.map((l) => [l.need.name, l.state])).toEqual([["Flour", "missing"]]);
  });

  it("skips a recipe without ingredients", () => {
    expect(rankRecipes(recipes, needs, [rice, eggs], today).some((c) => c.recipe.id === "r-empty")).toBe(false);
  });

  it("prefers recipes that use items expiring soon", () => {
    const two = [
      { id: "plain", title: "A plain one" },
      { id: "milky", title: "Z milky one" },
    ];
    const n = new Map<string, Need[]>([
      ["plain", [need("Rice", 100, "g")]],
      ["milky", [need("Milk", 100, "ml")]],
    ]);
    const ranked = rankRecipes(two, n, [rice, milk], today);
    expect(ranked.map((c) => c.recipe.id)).toEqual(["milky", "plain"]);
    expect(ranked[0]).toMatchObject({ expiringUsed: 1, firstExpiry: "2026-03-11" });
  });

  it("sorts equal recipes by title", () => {
    const two = [
      { id: "b", title: "Beta" },
      { id: "a", title: "Alpha" },
    ];
    const n = new Map<string, Need[]>([
      ["a", [need("Rice", 1, "g")]],
      ["b", [need("Rice", 1, "g")]],
    ]);
    expect(rankRecipes(two, n, [rice], today).map((c) => c.recipe.title)).toEqual(["Alpha", "Beta"]);
  });
});

describe("food that is in stock is not reported missing (receipt names, German names, units)", () => {
  // what the pantry holds after a receipt, and what a recipe (or the AI) asks for
  const stock = [
    item({ id: "lachs", name: "Lachsfilet", quantity: 500, unit: "g" }),
    item({ id: "dill", name: "Dill Bund", quantity: 1, unit: "pack" }),
    item({ id: "zitrone", name: "Zitronen", quantity: 3, unit: "pieces" }),
    item({ id: "sahne", name: "Schlagsahne", quantity: 200, unit: "ml" }),
  ];
  const state = (n: Need, items = stock) => lineStatus(n, items).state;

  it("Lachsfilet: 2 pieces against 500 g, and by its other names", () => {
    for (const name of ["Lachsfilet", "Lachs", "Salmon fillet", "Lachsfilets", "Lachsfil"]) expect(state(need(name, 2, "pieces"))).toBe("ok");
    expect(state(need("Lachsfilet", 400, "g"))).toBe("ok");
    expect(state(need("Lachsfilet", 900, "g"))).toBe("short");
  });

  it("Dill Bund: a bunch, a pack or just Dill", () => {
    for (const n of [need("Dill", 1, "pack"), need("Dill", 1, "pieces"), need("Dill", 20, "g"), need("Dill Bund", 1, "pieces"), need("frischer Dill", 1, "pack")]) expect(state(n)).toBe("ok");
  });

  it("Zitronen: Zitrone, lemon, lemons, in pieces", () => {
    for (const name of ["Zitrone", "Zitronen", "Lemon", "Lemons", "Bio Zitronen"]) expect(state(need(name, 2, "pieces"))).toBe("ok");
    expect(state(need("Zitronensaft", 2, "pieces"))).toBe("missing"); // juice is another product
  });

  it("Schlagsahne: Sahne, cream, whipping cream, an abbreviation", () => {
    for (const name of ["Sahne", "Schlagsahne", "Cream", "Whipping cream", "Schlagsah."]) expect(state(need(name, 200, "ml"))).toBe("ok");
    expect(state(need("Sahne", 400, "ml"))).toBe("short");
  });

  it("is missing only when truly absent", () => {
    for (const name of ["Thymian", "Saure Sahne", "Sour cream", "Milchreis", "Zitronengras", "Lachsfarbe"]) expect(state(need(name, 1, "pieces"))).toBe("missing");
  });

  it("a recipe with all four is complete, and is listed first", () => {
    const needs = new Map([
      ["r1", [need("Lachsfilet", 2, "pieces"), need("Dill", 1, "pack"), need("Zitrone", 2, "pieces"), need("Sahne", 200, "ml")]],
    ]);
    const [c] = rankRecipes([{ id: "r1", title: "Salmon" }], needs, stock, today);
    expect(c?.missing).toEqual([]);
  });
});
