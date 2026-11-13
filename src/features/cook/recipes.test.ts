import { describe, expect, it } from "vitest";
import { item } from "@/features/pantry/fixtures";
import { cleanIngredients, draftProblems, emptyDraft, groupByRecipe, linkIngredients, scaleIngredients, searchRecipes, steps, toDrafts, type RecipeDraft } from "./recipes";

const good = (): RecipeDraft => ({
  title: "Rice and eggs",
  servings: 2,
  steps: "Cook the rice.\n\nFry the eggs.",
  source: "manual",
  ingredients: [
    { name: "Rice", quantity: 200, unit: "g" },
    { name: "Eggs", quantity: 2, unit: "pieces" },
  ],
});

describe("draftProblems", () => {
  it("accepts a complete recipe", () => {
    expect(draftProblems(good())).toEqual([]);
  });

  it("asks for a name, servings and an ingredient", () => {
    expect(draftProblems(emptyDraft())).toEqual(["Give the recipe a name.", "Add at least one ingredient."]);
    expect(draftProblems({ ...good(), servings: 0 })).toContain("Servings must be more than 0.");
  });

  it("asks for an amount on every named ingredient, and ignores blank rows", () => {
    const d = good();
    d.ingredients.push({ name: "", quantity: 0, unit: "g" });
    expect(draftProblems(d)).toEqual([]);
    d.ingredients.push({ name: "Salt", quantity: 0, unit: "g" });
    expect(draftProblems(d)).toEqual(["Every ingredient needs an amount above 0."]);
  });
});

describe("cleanIngredients / steps", () => {
  it("drops blank rows and trims names", () => {
    expect(
      cleanIngredients([
        { name: " Rice ", quantity: 1, unit: "g" },
        { name: "  ", quantity: 1, unit: "g" },
      ]),
    ).toEqual([{ name: "Rice", quantity: 1, unit: "g" }]);
  });

  it("splits steps by line", () => {
    expect(steps(good().steps)).toEqual(["Cook the rice.", "Fry the eggs."]);
  });
});

describe("searchRecipes", () => {
  const recipes = [
    { id: "a", title: "Rice and eggs" },
    { id: "b", title: "Tomato soup" },
  ];
  const names = new Map([
    ["a", ["Rice", "Eggs"]],
    ["b", ["Tomatoes", "Onion"]],
  ]);

  it("finds by title or ingredient", () => {
    expect(searchRecipes(recipes, names, "soup").map((r) => r.id)).toEqual(["b"]);
    expect(searchRecipes(recipes, names, "egg").map((r) => r.id)).toEqual(["a"]);
    expect(searchRecipes(recipes, names, "tomato").map((r) => r.id)).toEqual(["b"]);
  });

  it("needs every word", () => {
    expect(searchRecipes(recipes, names, "rice onion")).toEqual([]);
    expect(searchRecipes(recipes, names, "rice eggs").map((r) => r.id)).toEqual(["a"]);
  });

  it("returns everything for an empty query", () => {
    expect(searchRecipes(recipes, names, "  ")).toHaveLength(2);
  });
});

describe("scaleIngredients", () => {
  it("multiplies quantities", () => {
    expect(scaleIngredients([{ quantity: 200 }, { quantity: 1 }], 1.5)).toEqual([{ quantity: 300 }, { quantity: 1.5 }]);
  });
});

describe("groupByRecipe", () => {
  it("groups by recipe in saved order", () => {
    const g = groupByRecipe([
      { recipe_id: "a", position: 1, name: "second" },
      { recipe_id: "b", position: 0, name: "other" },
      { recipe_id: "a", position: 0, name: "first" },
    ]);
    expect(g.get("a")?.map((r) => r.name)).toEqual(["first", "second"]);
    expect(g.get("b")).toHaveLength(1);
  });
});

describe("toDrafts", () => {
  it("keeps valid rows and drops unknown units", () => {
    const rows = [
      { name: "Rice", quantity: 1, unit: "kg", pantry_item_id: null },
      { name: "Odd", quantity: 1, unit: "bunch", pantry_item_id: null },
    ];
    expect(toDrafts(rows).map((r) => r.name)).toEqual(["Rice"]);
  });
});

describe("linkIngredients", () => {
  const rice = item({ id: "rice", name: "Rice", unit: "kg" });

  it("links by name", () => {
    expect(linkIngredients([{ name: "rice", quantity: 1, unit: "g" }], [rice])[0]?.pantry_item_id).toBe("rice");
  });

  it("clears a link when the name changed", () => {
    expect(linkIngredients([{ name: "Flour", quantity: 1, unit: "g", pantry_item_id: "rice" }], [rice])[0]?.pantry_item_id).toBeNull();
  });

  it("keeps a link that still matches and leaves unknown foods unlinked", () => {
    expect(linkIngredients([{ name: "Rice", quantity: 1, unit: "g", pantry_item_id: "rice" }], [rice])[0]?.pantry_item_id).toBe("rice");
    expect(linkIngredients([{ name: "Saffron", quantity: 1, unit: "g" }], [rice])[0]?.pantry_item_id).toBeNull();
  });
});
