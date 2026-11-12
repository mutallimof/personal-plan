import { describe, expect, it } from "vitest";
import { approxLabel, basisFor, formatAmounts, formatKcal, formatProtein, ingredientNutrition, recipeNutrition, toNutritionRows, type NutritionRow } from "./nutrition";

const rows: NutritionRow[] = [
  { name: "Rice", basis: "100g", kcal: 360, protein_g: 7 },
  { name: "Milk", basis: "100ml", kcal: 60, protein_g: 3.2 },
  { name: "Eggs", basis: "piece", kcal: 72, protein_g: 6.3 },
  { name: "Eggs", basis: "100g", kcal: 143, protein_g: 12.6 },
];

describe("basisFor", () => {
  it("picks the basis a unit needs", () => {
    expect(basisFor("g")).toBe("100g");
    expect(basisFor("kg")).toBe("100g");
    expect(basisFor("ml")).toBe("100ml");
    expect(basisFor("l")).toBe("100ml");
    expect(basisFor("pieces")).toBe("piece");
    expect(basisFor("pack")).toBeNull();
  });
});

describe("ingredientNutrition", () => {
  it("scales per 100 g, also from kg", () => {
    expect(ingredientNutrition({ name: "Rice", quantity: 200, unit: "g" }, rows)).toEqual({ kcal: 720, protein_g: 14, carbs_g: null, fat_g: null });
    expect(ingredientNutrition({ name: "rice", quantity: 0.1, unit: "kg" }, rows)).toEqual({ kcal: 360, protein_g: 7, carbs_g: null, fat_g: null });
  });

  it("scales per 100 ml, also from litres", () => {
    const n = ingredientNutrition({ name: "Milk", quantity: 0.25, unit: "l" }, rows);
    expect(n?.kcal).toBeCloseTo(150);
    expect(n?.protein_g).toBeCloseTo(8);
  });

  it("uses the per-piece row for pieces and the per-100-g row for grams", () => {
    const pieces = ingredientNutrition({ name: "Egg", quantity: 2, unit: "pieces" }, rows);
    expect(pieces?.kcal).toBeCloseTo(144);
    expect(pieces?.protein_g).toBeCloseTo(12.6);
    expect(ingredientNutrition({ name: "Eggs", quantity: 100, unit: "g" }, rows)?.kcal).toBe(143);
  });

  it("does not guess across kinds of unit", () => {
    expect(ingredientNutrition({ name: "Rice", quantity: 2, unit: "pieces" }, rows)).toBeNull();
    expect(ingredientNutrition({ name: "Milk", quantity: 200, unit: "g" }, rows)).toBeNull();
    expect(ingredientNutrition({ name: "Rice", quantity: 1, unit: "pack" }, rows)).toBeNull();
  });

  it("returns null for an unknown food", () => {
    expect(ingredientNutrition({ name: "Saffron", quantity: 1, unit: "g" }, rows)).toBeNull();
  });
});

describe("recipeNutrition", () => {
  const ingredients = [
    { name: "Rice", quantity: 200, unit: "g" as const },
    { name: "Eggs", quantity: 2, unit: "pieces" as const },
    { name: "Saffron", quantity: 1, unit: "g" as const },
    { name: "Mystery sauce", quantity: 1, unit: "pack" as const },
  ];

  it("sums what is known and lists what is not", () => {
    const n = recipeNutrition(ingredients, rows, 2);
    expect(n.total.kcal).toBeCloseTo(864);
    expect(n.perServing.kcal).toBeCloseTo(432);
    expect(n.perServing.protein_g).toBeCloseTo(13.3);
    expect(n.missing).toEqual(["Saffron", "Mystery sauce"]);
  });

  it("has nothing missing when every ingredient is known", () => {
    expect(recipeNutrition(ingredients.slice(0, 2), rows, 1).missing).toEqual([]);
  });

  it("treats a bad serving count as one", () => {
    expect(recipeNutrition(ingredients.slice(0, 1), rows, 0).perServing.kcal).toBe(720);
  });
});

describe("labels", () => {
  it("says how rough the numbers are", () => {
    expect(approxLabel(0)).toBe("approx.");
    expect(approxLabel(1)).toBe("approx., 1 ingredient missing");
    expect(approxLabel(2)).toBe("approx., 2 ingredients missing");
  });

  it("formats numbers", () => {
    expect(formatKcal(432.4)).toBe("432 kcal");
    expect(formatProtein(6.34)).toBe("6.3 g protein");
    expect(formatProtein(24.6)).toBe("25 g protein");
  });
});

describe("toNutritionRows", () => {
  it("keeps valid rows and drops an unknown basis", () => {
    const out = toNutritionRows([
      { name: "Rice", basis: "100g", kcal: 360, protein_g: 7 },
      { name: "Odd", basis: "cup", kcal: 1, protein_g: 1 },
    ]);
    expect(out.map((r) => r.name)).toEqual(["Rice"]);
  });
});

describe("carbs and fat", () => {
  const withMacros: NutritionRow[] = [
    { name: "Rice", basis: "100g", kcal: 360, protein_g: 7, carbs_g: 78, fat_g: 0.6 },
    { name: "Oil", basis: "100ml", kcal: 880, protein_g: 0, carbs_g: 0, fat_g: 100 },
    { name: "Salt", basis: "100g", kcal: 0, protein_g: 0 },
  ];

  it("come from the table row, scaled by the amount", () => {
    expect(ingredientNutrition({ name: "Rice", quantity: 200, unit: "g" }, withMacros)).toEqual({ kcal: 720, protein_g: 14, carbs_g: 156, fat_g: 1.2 });
  });

  it("are summed per recipe and per serving when every found ingredient has them", () => {
    const n = recipeNutrition([{ name: "Rice", quantity: 200, unit: "g" }, { name: "Oil", quantity: 20, unit: "ml" }], withMacros, 2);
    expect(n.total).toEqual({ kcal: 896, protein_g: 14, carbs_g: 156, fat_g: 21.2 });
    expect(n.perServing).toEqual({ kcal: 448, protein_g: 7, carbs_g: 78, fat_g: 10.6 });
  });

  it("are left out (null) rather than half-summed when one found ingredient has no carbs or fat", () => {
    const n = recipeNutrition([{ name: "Rice", quantity: 200, unit: "g" }, { name: "Salt", quantity: 5, unit: "g" }], withMacros, 1);
    expect(n.total.kcal).toBe(720);
    expect(n.total.carbs_g).toBeNull();
    expect(n.total.fat_g).toBeNull();
  });

  it("are null when nothing was found, and ingredients without a row still count as missing", () => {
    const n = recipeNutrition([{ name: "Saffron", quantity: 1, unit: "g" }], withMacros, 1);
    expect(n.total).toEqual({ kcal: 0, protein_g: 0, carbs_g: null, fat_g: null });
    expect(n.missing).toEqual(["Saffron"]);
  });

  it("show in the text only when known", () => {
    expect(formatAmounts({ kcal: 450.4, protein_g: 12.34, carbs_g: null, fat_g: null })).toBe("450 kcal · 12 g protein");
    expect(formatAmounts({ kcal: 450, protein_g: 12, carbs_g: 55.5, fat_g: 8 })).toBe("450 kcal · 12 g protein · 56 g carbs · 8 g fat");
  });
});
