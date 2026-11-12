import { describe, expect, it } from "vitest";
import { ingredientKey, ingredientTokens, sameIngredient } from "./names";

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

describe("sameIngredient: German and English names of the same food", () => {
  it.each([
    ["Zitrone", "Zitronen"],
    ["Zitronen", "Lemons"],
    ["Sahne", "Schlagsahne"],
    ["Schlagsahne", "Whipping cream"],
    ["Dill Bund", "Dill"],
    ["Dill", "frischer Dill"],
    ["Lachsfilet", "Lachs"],
    ["Lachsfilet", "Salmon fillet"],
    ["Lachsfil", "Lachsfilet"],
    ["Kartoffeln", "Kartoffel"],
    ["Kartoffeln", "Potatoes"],
    ["Äpfel", "Apfel"],
    ["Tomaten", "Tomatoes"],
    ["Weih.Butter", "Butter"],
    ["Eier", "Eggs"],
    ["Bio Eier M", "Eier"],
    ["Hähnchenbrustfilet", "Chicken breast"],
    ["Rote Zwiebeln", "Zwiebel"],
    ["Zucchini", "Courgette"],
  ])("%s = %s", (a, b) => {
    expect(sameIngredient(a, b)).toBe(true);
    expect(sameIngredient(b, a)).toBe(true);
  });

  it.each([
    ["Sahne", "Saure Sahne"],
    ["Sahne", "Kokosmilch"],
    ["Milch", "Milchreis"],
    ["Milch", "Buttermilch"],
    ["Zitrone", "Zitronensaft"],
    ["Reis", "Reiswein"],
    ["Butter", "Erdnussbutter"],
    ["Lachs", "Thunfisch"],
    ["Mehl", "Mohn"],
    ["Kartoffel", "Süßkartoffel"],
    ["Ei", "Eiweiß"],
  ])("%s is not %s", (a, b) => {
    expect(sameIngredient(a, b)).toBe(false);
  });

  it("drops amounts, freshness words and receipt prefixes", () => {
    expect(ingredientTokens("Dill Bund")).toEqual(["dill"]);
    expect(ingredientTokens("K.H-Milch 1,5% 1L")).toEqual(["milch"]);
    expect(ingredientTokens("Zitronen")).toEqual(ingredientTokens("Zitrone"));
  });

  it("never matches a name with nothing left but noise", () => {
    expect(sameIngredient("Bio", "Dill")).toBe(false);
  });
});
