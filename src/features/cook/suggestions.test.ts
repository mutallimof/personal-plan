import { describe, expect, it } from "vitest";
import type { AiRecipe } from "./ai-recipes";
import { MAX_NEAR, MIN_COOKABLE, SUGGESTION_COUNT, feedbackFor, isStaple, missingFor, selectSuggestions, shortfallNote, type StockLine } from "./suggestions";

const stock: StockLine[] = [
  { name: "Chicken breast", quantity: 500, unit: "g" },
  { name: "Potatoes", quantity: 1000, unit: "g" },
  { name: "Schlagsahne", quantity: 200, unit: "ml" },
  { name: "Eggs", quantity: 6, unit: "pieces" },
];

const r = (title: string, ...ing: [string, number, AiRecipe["ingredients"][number]["unit"]][]): AiRecipe => ({
  title,
  servings: 2,
  ingredients: ing.map(([name, quantity, unit]) => ({ name, quantity, unit })),
  steps: ["Cook."],
});

const cookable = (n: number) => r(`Cookable ${n}`, ["Chicken breast", 200, "g"], ["Potatoes", 300, "g"]);
const near1 = (n: number) => r(`Near ${n}`, ["Chicken breast", 200, "g"], ["Lachsfilet", 2, "pieces"]);
const near2 = (n: number) => r(`Near2 ${n}`, ["Eggs", 2, "pieces"], ["Mehl", 200, "g"], ["Zucker", 100, "g"]);
const far = (n: number) => r(`Far ${n}`, ["Mehl", 200, "g"], ["Zucker", 100, "g"], ["Butter", 100, "g"], ["Milch", 1, "l"]);

describe("which ingredients are missing", () => {
  it("counts only what the stock does not cover, by name and synonyms", () => {
    expect(missingFor(r("x", ["Sahne", 100, "ml"], ["Lachsfilet", 1, "pieces"]), stock).map((l) => l.need.name)).toEqual(["Lachsfilet"]);
  });
  it("counts too little as missing, and used-up stock as absent", () => {
    expect(missingFor(r("x", ["Chicken breast", 900, "g"]), stock)).toHaveLength(1);
    expect(missingFor(r("x", ["Eggs", 1, "pieces"]), [{ name: "Eggs", quantity: 0, unit: "pieces" }])).toHaveLength(1);
  });
  it("assumes water, salt and pepper are at home", () => {
    expect(isStaple("Salz")).toBe(true);
    expect(isStaple("Pepper")).toBe(true);
    expect(isStaple("Water")).toBe(true);
    expect(isStaple("Sugar")).toBe(false);
    expect(missingFor(r("x", ["Chicken breast", 100, "g"], ["Salt", 1, "g"], ["Water", 500, "ml"]), stock)).toEqual([]);
  });
});

describe("selectSuggestions: of 5, at least 3 cookable, at most 2 needing up to 2 products", () => {
  it("keeps a good set as it is", () => {
    const set = [cookable(1), cookable(2), cookable(3), near1(1), near2(1)];
    const sel = selectSuggestions(set, stock);
    expect(sel.cards).toHaveLength(5);
    expect(sel.cookable).toBe(3);
    expect(sel.near).toBe(2);
    expect(sel.satisfied).toBe(true);
    expect(sel.dropped).toEqual([]);
  });

  it("shows only cookable ones when there are five of them", () => {
    const sel = selectSuggestions([1, 2, 3, 4, 5].map(cookable), stock);
    expect(sel.cookable).toBe(5);
    expect(sel.near).toBe(0);
  });

  it("is not satisfied with only two cookable ones, and keeps the near ones within the limits", () => {
    const sel = selectSuggestions([cookable(1), cookable(2), near1(1), near1(2), near2(1)], stock);
    expect(sel.satisfied).toBe(false);
    expect(sel.cookable).toBe(2);
    expect(sel.near).toBe(MAX_NEAR); // never more than two need products
    expect(sel.cards).toHaveLength(4);
    expect(sel.dropped).toHaveLength(1);
  });

  it("drops recipes that miss more than two products, however few cookable ones there are", () => {
    const sel = selectSuggestions([far(1), far(2), far(3), cookable(1), near1(1)], stock);
    expect(sel.cards.map((c) => c.title)).toEqual(["Cookable 1", "Near 1"]);
    expect(sel.satisfied).toBe(false);
    expect(sel.dropped.map((d) => d.recipe.title)).toEqual(["Far 1", "Far 2", "Far 3"]);
  });

  it("puts cookable ones first and the ones missing fewest products first", () => {
    const sel = selectSuggestions([near2(1), near1(1), cookable(1), cookable(2), cookable(3)], stock);
    expect(sel.cards.map((c) => c.title)).toEqual(["Cookable 1", "Cookable 2", "Cookable 3", "Near 1", "Near2 1"]);
  });

  it("shows a short list as it is (the cards label what is missing)", () => {
    const sel = selectSuggestions([near1(1), far(1)], stock);
    expect(sel.cards).toHaveLength(2);
    expect(sel.satisfied).toBe(true);
  });

  it("uses the same numbers as the prompt", () => {
    expect([SUGGESTION_COUNT, MIN_COOKABLE, MAX_NEAR]).toEqual([5, 3, 2]);
  });

  it("explains what to fix, and writes a short note for the person", () => {
    const sel = selectSuggestions([far(1), cookable(1), cookable(2), near1(1), near1(2)], stock);
    const text = feedbackFor(sel, 5);
    expect(text).toMatch(/Only 2 of the 5/);
    expect(text).toMatch(/"Far 1" misses Mehl, Zucker, Butter, Milch/);
    expect(shortfallNote(sel)).toMatch(/Only 2 of these are cookable/);
    expect(shortfallNote({ ...sel, cookable: 0 })).toMatch(/couldn't find a recipe you can cook/);
  });
});
