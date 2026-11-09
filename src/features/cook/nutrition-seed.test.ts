import { describe, expect, it } from "vitest";
import { ingredientKey } from "./names";
import { BASIS_LABEL } from "./nutrition";
import { NUTRITION_SEED } from "./nutrition-seed";

describe("NUTRITION_SEED", () => {
  it("has a valid basis and plausible numbers in every row", () => {
    for (const r of NUTRITION_SEED) {
      expect(Object.keys(BASIS_LABEL)).toContain(r.basis);
      expect(r.kcal).toBeGreaterThanOrEqual(0);
      expect(r.kcal).toBeLessThanOrEqual(900); // fat has about 9 kcal per gram
      expect(r.protein_g).toBeGreaterThanOrEqual(0);
    }
  });

  it("has one row per food and basis", () => {
    const keys = NUTRITION_SEED.map((r) => `${ingredientKey(r.name)}|${r.basis}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("names the source record of every row", () => {
    for (const r of NUTRITION_SEED) expect(r.source).toMatch(/^USDA FoodData Central .+, \d+: /);
  });

  it("covers the basics", () => {
    const names = new Set(NUTRITION_SEED.map((r) => r.name));
    for (const n of ["Eggs", "Butter", "Long-grain rice", "Chicken breast", "Whole milk", "Olive oil"]) expect(names).toContain(n);
  });
});
