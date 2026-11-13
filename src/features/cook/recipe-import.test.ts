import { describe, expect, it } from "vitest";
import { parseRecipeImport } from "./recipe-import";

const soup = { title: "Soup", servings: 4, ingredients: [{ name: "Carrots", quantity: 500, unit: "g" }], steps: ["Boil.", "Blend."] };

describe("parseRecipeImport", () => {
  it("reads a list and an object with a recipes list", () => {
    for (const text of [JSON.stringify([soup]), JSON.stringify({ recipes: [soup] })]) {
      const r = parseRecipeImport(text);
      expect("drafts" in r && r.drafts[0]).toMatchObject({ title: "Soup", servings: 4, source: "manual", steps: "Boil.\nBlend." });
    }
  });

  it("takes steps as text, defaults servings to 2 and skips what does not fit", () => {
    const r = parseRecipeImport(
      JSON.stringify([
        { title: "Toast", ingredients: [{ name: "Bread", quantity: 2, unit: "pieces" }], steps: "Toast it." },
        { title: "Bad" },
        { title: "Cups", ingredients: [{ name: "Flour", quantity: 1, unit: "cups" }] },
      ]),
    );
    expect("drafts" in r && r.drafts).toHaveLength(1);
    expect("drafts" in r && r.drafts[0]).toMatchObject({ servings: 2, steps: "Toast it." });
    expect("skipped" in r && r.skipped).toBe(2);
  });

  it("reports unreadable files and files without usable recipes", () => {
    expect(parseRecipeImport("not json")).toEqual({ error: "That file is not valid JSON." });
    expect("error" in parseRecipeImport('{"foo":1}')).toBe(true);
    expect("error" in parseRecipeImport("[]")).toBe(true);
    expect("error" in parseRecipeImport('[{"title":"x"}]')).toBe(true);
  });
});
