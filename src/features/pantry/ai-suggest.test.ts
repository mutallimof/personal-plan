import { describe, expect, it } from "vitest";
import { MAX_AI_LINES, SYSTEM_PROMPT, parseSuggestions, textsToSend, userPrompt } from "./ai-suggest";

describe("textsToSend", () => {
  it("sends normalized text without prices, weights or tax letters", () => {
    expect(textsToSend(["HAEHNCHENBRUSTF 400G 4,99 B", "Käse 1,99 A"])).toEqual(["HAEHNCHENBRUSTF", "KAESE"]);
  });

  it("drops duplicates and empty texts", () => {
    expect(textsToSend(["BUTTER 2,19 B", "butter 1,99", "1,99 B", ""])).toEqual(["BUTTER"]);
  });

  it("caps the number of lines", () => {
    const many = Array.from({ length: MAX_AI_LINES + 10 }, (_, i) => `PRODUKT${String.fromCharCode(65 + (i % 26))}${"X".repeat(i)}`);
    expect(textsToSend(many)).toHaveLength(MAX_AI_LINES);
  });

  it("never includes anything but the text in the prompt", () => {
    const prompt = userPrompt(textsToSend(["BUTTER 2,19 B"]));
    expect(prompt).toBe('Receipt texts:\n["BUTTER"]');
    expect(prompt).not.toMatch(/\d,\d\d/);
  });

  it("tells the model the allowed categories and places", () => {
    expect(SYSTEM_PROMPT).toContain("dry goods");
    expect(SYSTEM_PROMPT).toContain("freezer");
  });
});

describe("parseSuggestions", () => {
  const asked = ["HAEHNCHENBRUSTF", "KAESE"];

  it("reads valid items", () => {
    const out = parseSuggestions(
      { items: [{ text: "HAEHNCHENBRUSTF", name: "Chicken breast", category: "meat", place: "fridge" }] },
      asked,
    );
    expect(out).toEqual([{ text: "HAEHNCHENBRUSTF", name: "Chicken breast", category: "meat", kind: "fridge" }]);
  });

  it("is forgiving about case and spacing, strict about what it accepts", () => {
    const out = parseSuggestions({ items: [{ text: " haehnchenbrustf ", name: " Chicken ", category: "MEAT", place: "Fridge" }] }, asked);
    expect(out[0]).toMatchObject({ text: "HAEHNCHENBRUSTF", name: "Chicken", category: "meat", kind: "fridge" });
  });

  it("turns unknown categories into other and unknown places into none", () => {
    const out = parseSuggestions({ items: [{ text: "KAESE", name: "Cheese", category: "dairy products", place: "attic" }] }, asked);
    expect(out[0]).toMatchObject({ category: "other", kind: null });
  });

  it("ignores texts that were not asked about, repeats and nameless entries", () => {
    const out = parseSuggestions(
      {
        items: [
          { text: "SOMETHING ELSE", name: "X", category: "other", place: "shelf" },
          { text: "KAESE", name: "Cheese", category: "dairy", place: "fridge" },
          { text: "KAESE", name: "Other cheese", category: "dairy", place: "fridge" },
          { text: "HAEHNCHENBRUSTF", name: "  ", category: "meat", place: "fridge" },
          null,
          "text",
        ],
      },
      asked,
    );
    expect(out.map((s) => s.name)).toEqual(["Cheese"]);
  });

  it.each([[null], [undefined], [{}], [{ items: "no" }], [[]], ["text"], [5]])("returns nothing for %j", (v) => {
    expect(parseSuggestions(v, asked)).toEqual([]);
  });

  it("limits the length of names", () => {
    const out = parseSuggestions({ items: [{ text: "KAESE", name: "x".repeat(500), category: "dairy", place: "fridge" }] }, asked);
    expect(out[0]?.name).toHaveLength(120);
  });
});
