import { describe, expect, it } from "vitest";
import { ingredientKey, sameIngredient } from "./names";

describe("ingredientKey", () => {
  it("ignores case, spacing and accents", () => {
    expect(ingredientKey("  Crème   Fraîche ")).toBe("creme fraiche");
  });

  it("folds a plural s", () => {
    expect(sameIngredient("Eggs", "egg")).toBe(true);
    expect(sameIngredient("Onions", "onion")).toBe(true);
    expect(sameIngredient("Tomatoes", "Tomato")).toBe(true);
    expect(sameIngredient("Potatoes", "potato")).toBe(true);
  });

  it("keeps double-s words and short words as they are", () => {
    expect(ingredientKey("Cress")).toBe("cress");
    expect(ingredientKey("Gas")).toBe("gas");
  });

  it("does not match different foods", () => {
    expect(sameIngredient("Rice", "Rice flour")).toBe(false);
    expect(sameIngredient("Milk", "Buttermilk")).toBe(false);
  });
});
