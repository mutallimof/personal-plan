import { describe, expect, it } from "vitest";
import { item } from "@/features/pantry/fixtures";
import { MAX_IDEAS, MAX_PANTRY_LINES, SYSTEM_PROMPT, aiDraft, pantrySummary, parseAiRecipes, userPrompt } from "./ai-recipes";

const valid = {
  title: "Rice and eggs",
  servings: 2,
  ingredients: [
    { name: "rice", quantity: 200, unit: "g" },
    { name: "Eggs", quantity: 2, unit: "pieces" },
    { name: "Soy sauce", quantity: 1, unit: "pack" },
  ],
  steps: ["Cook the rice.", "Fry the eggs."],
};

describe("pantrySummary", () => {
  it("sends names, quantities and units only", () => {
    const out = pantrySummary([
      item({ name: "Rice", quantity: 1, unit: "kg", location_id: "secret-place", expires_on: "2026-01-01", note: "private note" }),
    ]);
    expect(out).toEqual([{ name: "Rice", quantity: 1, unit: "kg" }]);
    expect(userPrompt(out)).not.toMatch(/secret|private|2026/);
  });

  it("merges the same food in the same unit and leaves out empty items", () => {
    const out = pantrySummary([
      item({ name: "Milk", quantity: 1, unit: "l" }),
      item({ name: "milk", quantity: 0.5, unit: "l" }),
      item({ name: "Milk", quantity: 200, unit: "ml" }),
      item({ name: "Gone", quantity: 0, unit: "g" }),
    ]);
    expect(out).toEqual([
      { name: "Milk", quantity: 1.5, unit: "l" },
      { name: "Milk", quantity: 200, unit: "ml" },
    ]);
  });

  it("limits the list", () => {
    const many = Array.from({ length: 200 }, (_, i) => item({ name: `Food ${i}`, quantity: 1, unit: "pieces" }));
    expect(pantrySummary(many)).toHaveLength(MAX_PANTRY_LINES);
  });
});

describe("prompt", () => {
  it("asks for strict JSON and no nutrition numbers", () => {
    expect(SYSTEM_PROMPT).toMatch(/ONLY a JSON object/);
    expect(SYSTEM_PROMPT).toMatch(/Do not give nutrition numbers/);
  });
});

describe("parseAiRecipes", () => {
  it("accepts a well-formed answer", () => {
    expect(parseAiRecipes({ recipes: [valid] })).toHaveLength(1);
  });

  it("drops recipes that do not fit the format", () => {
    const bad = [
      { ...valid, title: "" },
      { ...valid, servings: 0 },
      { ...valid, ingredients: [] },
      { ...valid, ingredients: [{ name: "x", quantity: -1, unit: "g" }] },
      { ...valid, ingredients: [{ name: "x", quantity: 1, unit: "cups" }] },
      { ...valid, steps: [] },
      "not a recipe",
      null,
    ];
    expect(parseAiRecipes({ recipes: [...bad, valid] })).toHaveLength(1);
  });

  it("returns nothing for the wrong shape", () => {
    expect(parseAiRecipes(null)).toEqual([]);
    expect(parseAiRecipes({ recipes: "x" })).toEqual([]);
    expect(parseAiRecipes([valid])).toEqual([]);
  });

  it("keeps at most three", () => {
    expect(parseAiRecipes({ recipes: [valid, valid, valid, valid, valid] })).toHaveLength(MAX_IDEAS);
  });

  it("ignores numbers the model adds on its own", () => {
    const [r] = parseAiRecipes({ recipes: [{ ...valid, kcal: 99999, protein: 1 }] });
    expect(r).not.toHaveProperty("kcal");
  });
});

describe("aiDraft", () => {
  const items = [
    item({ id: "rice", name: "Basmati Rice", quantity: 1, unit: "kg" }),
    item({ id: "eggs", name: "Eggs", quantity: 6, unit: "pieces" }),
  ];

  it("links ingredients to pantry items by name and takes the pantry wording", () => {
    const [recipe] = parseAiRecipes({ recipes: [valid] });
    const draft = aiDraft(recipe as NonNullable<typeof recipe>, items);
    expect(draft.source).toBe("ai");
    expect(draft.steps).toBe("Cook the rice.\nFry the eggs.");
    expect(draft.ingredients[1]).toEqual({ name: "Eggs", quantity: 2, unit: "pieces", pantry_item_id: "eggs" });
    // "rice" is not the same name as "Basmati Rice": no guess.
    expect(draft.ingredients[0]).toEqual({ name: "rice", quantity: 200, unit: "g", pantry_item_id: null });
    expect(draft.ingredients[2]?.pantry_item_id).toBeNull();
  });
});
