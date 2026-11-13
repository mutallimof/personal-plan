import { describe, expect, it } from "vitest";
import { item } from "@/features/pantry/fixtures";
import {
  CHAT_TOOLS,
  MAX_CARDS,
  MAX_PROPOSED,
  MAX_SUMMARY_LINES,
  MAX_TURNS,
  SYSTEM_PROMPT,
  chatSummary,
  cleanRecipes,
  cleanTurns,
  contextPrompt,
  parseArguments,
  recipesFromText,
  searchSummary,
  validateToolCall,
} from "./chat";

const recipe = {
  title: "Chicken and potatoes",
  servings: 2,
  minutes: 30,
  ingredients: [
    { name: "Chicken breast", quantity: 400, unit: "g" },
    { name: "Potatoes", quantity: 600, unit: "g" },
  ],
  steps: ["Roast the potatoes.", "Fry the chicken."],
};

describe("chatSummary", () => {
  it("sends name, quantity and unit only", () => {
    const out = chatSummary([
      item({ name: "Chicken breast", quantity: 500, unit: "g", expires_on: "2026-05-12", location_id: "secret-place", note: "private note", added_at: "2026-04-01T00:00:00Z" }),
    ]);
    expect(out).toEqual([{ name: "Chicken breast", quantity: 500, unit: "g" }]);
    const text = contextPrompt(out, []);
    expect(text).not.toMatch(/secret|private|2026-04|2026-05-12/);
  });

  it("is one short line per item, so the request stays small", () => {
    const out = chatSummary([item({ name: "Rice", quantity: 1, unit: "kg" }), item({ name: "Milk", quantity: 0.5, unit: "l" })]);
    expect(contextPrompt(out, [])).toBe("Stock: Rice 1 kg; Milk 0.5 l");
    expect(contextPrompt([], [])).toBe("Stock: nothing");
    expect(contextPrompt(out, [{ id: "r1", title: "Soup" }])).toContain("Saved recipes (id: title): r1: Soup");
    expect(contextPrompt(out, [])).not.toContain("{");
  });

  it("merges the same food in the same unit", () => {
    const out = chatSummary([item({ name: "Milk", quantity: 1, unit: "l" }), item({ name: "milk", quantity: 0.5, unit: "l" }), item({ name: "Milk", quantity: 200, unit: "ml" })]);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ name: "Milk", quantity: 1.5, unit: "l" });
  });

  it("leaves out empty items and unknown units, and caps the list", () => {
    expect(chatSummary([item({ quantity: 0 }), item({ unit: "cups" })])).toEqual([]);
    const many = Array.from({ length: MAX_SUMMARY_LINES + 20 }, (_, i) => item({ name: `Food ${i}`, quantity: 1, unit: "g" }));
    expect(chatSummary(many)).toHaveLength(MAX_SUMMARY_LINES);
  });
});

describe("what the browser sends", () => {
  it("keeps well-formed turns, the latest few, starting with the user", () => {
    const turns = Array.from({ length: 14 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` }));
    const out = cleanTurns([{ role: "system", content: "hack" }, { role: "user" }, null, "x", ...turns]);
    expect(out.length).toBeLessThanOrEqual(MAX_TURNS);
    expect(out[0]?.role).toBe("user");
    expect(out.at(-1)?.content).toBe("m13");
    expect(out.some((t) => t.content === "hack")).toBe(false);
  });

  it("cuts long messages and drops empty ones", () => {
    const out = cleanTurns([{ role: "user", content: "a".repeat(5000) }, { role: "assistant", content: "   " }]);
    expect(out).toHaveLength(1);
    expect(out[0]?.content.length).toBeLessThanOrEqual(1000);
    expect(cleanTurns("nope")).toEqual([]);
  });

  it("keeps only id and title of saved recipes", () => {
    expect(cleanRecipes([{ id: "r1", title: " Soup ", steps: "secret" }, { id: 3, title: "x" }, { id: "r2", title: "" }])).toEqual([{ id: "r1", title: "Soup" }]);
    expect(cleanRecipes(undefined)).toEqual([]);
  });
});

describe("parseArguments", () => {
  it("reads a JSON object, treats empty text as no arguments, and rejects everything else", () => {
    expect(parseArguments('{"query":"rice"}')).toEqual({ query: "rice" });
    expect(parseArguments("")).toEqual({});
    expect(parseArguments(undefined)).toEqual({});
    expect(parseArguments("[1]")).toBeNull();
    expect(parseArguments("{broken")).toBeNull();
    expect(parseArguments('"text"')).toBeNull();
  });
});

describe("validateToolCall", () => {
  it("accepts search_pantry with and without arguments", () => {
    expect(validateToolCall("search_pantry", {})).toEqual({ ok: true, call: { name: "search_pantry", query: "" } });
    expect(validateToolCall("search_pantry", { query: " rice " })).toEqual({ ok: true, call: { name: "search_pantry", query: "rice" } });
    expect(validateToolCall("search_pantry", { query: 5 }).ok).toBe(false);
  });

  it("accepts valid recipes in suggest_recipes, drops invalid ones and reads at most MAX_PROPOSED", () => {
    const few = validateToolCall("suggest_recipes", { recipes: [recipe, { title: "No ingredients", servings: 2, ingredients: [], steps: ["x"] }, recipe] });
    expect(few.ok && few.call.name === "suggest_recipes" && few.call.recipes).toHaveLength(2);
    const many = validateToolCall("suggest_recipes", { recipes: Array.from({ length: 10 }, () => recipe) });
    expect(many.ok && many.call.name === "suggest_recipes" && many.call.recipes).toHaveLength(MAX_PROPOSED);
    expect(MAX_CARDS).toBe(5);
  });

  it("rejects suggest_recipes when nothing is usable", () => {
    expect(validateToolCall("suggest_recipes", { recipes: [{ title: "x" }] }).ok).toBe(false);
    expect(validateToolCall("suggest_recipes", { recipes: [] }).ok).toBe(false);
    expect(validateToolCall("suggest_recipes", {}).ok).toBe(false);
  });

  it("rejects recipes with units, amounts or steps that do not fit", () => {
    const wrongUnit = { ...recipe, ingredients: [{ name: "Flour", quantity: 2, unit: "cups" }] };
    const zero = { ...recipe, ingredients: [{ name: "Flour", quantity: 0, unit: "g" }] };
    const noSteps = { ...recipe, steps: [] };
    for (const r of [wrongUnit, zero, noSteps]) expect(validateToolCall("save_recipe", { recipe: r }).ok).toBe(false);
    expect(validateToolCall("save_recipe", { recipe }).ok).toBe(true);
  });

  it("drops nutrition numbers the model adds", () => {
    const r = validateToolCall("save_recipe", { recipe: { ...recipe, calories: 99999, protein: 500 } });
    expect(r.ok).toBe(true);
    expect(r.ok && r.call.name === "save_recipe" && Object.keys(r.call.recipe)).not.toContain("calories");
    expect(r.ok && r.call.name === "save_recipe" && Object.keys(r.call.recipe)).not.toContain("protein");
  });

  it("checks cook_recipe", () => {
    expect(validateToolCall("cook_recipe", { recipe_id: "abc" })).toEqual({ ok: true, call: { name: "cook_recipe", recipeId: "abc" } });
    expect(validateToolCall("cook_recipe", {}).ok).toBe(false);
    expect(validateToolCall("cook_recipe", { recipe_id: 5 }).ok).toBe(false);
  });

  it("rejects tools that do not exist, so the model cannot reach anything else", () => {
    for (const name of ["delete_item", "remove_pantry_item", "update_pantry", "", "__proto__"]) expect(validateToolCall(name, {}).ok).toBe(false);
  });

  it("offers exactly four tools: none removes anything from the pantry and none touches the shopping list", () => {
    expect(CHAT_TOOLS.map((t) => t.name)).toEqual(["search_pantry", "suggest_recipes", "save_recipe", "cook_recipe"]);
    expect(validateToolCall("add_to_shopping_list", { items: [{ name: "Milk" }] }).ok).toBe(false);
    expect(SYSTEM_PROMPT).not.toMatch(/add_to_shopping_list/);
  });
});

describe("searchSummary", () => {
  const lines = chatSummary([
    item({ name: "Chicken breast", quantity: 500, unit: "g" }),
    item({ name: "Kartoffeln", quantity: 1, unit: "kg" }),
    item({ name: "Schlagsahne", quantity: 200, unit: "ml" }),
    item({ name: "Rice", quantity: 1, unit: "kg" }),
  ]);

  it("finds by word, including plurals and German names", () => {
    expect(searchSummary(lines, "potato").map((l) => l.name)).toEqual(["Kartoffeln"]);
    expect(searchSummary(lines, "Sahne").map((l) => l.name)).toEqual(["Schlagsahne"]);
    expect(searchSummary(lines, "chicken").map((l) => l.name)).toEqual(["Chicken breast"]);
    expect(searchSummary(lines, "")).toHaveLength(4);
  });

  it("finds nothing for food that is not there", () => {
    expect(searchSummary(lines, "saffron")).toEqual([]);
  });
});

describe("recipesFromText", () => {
  it("reads recipes from a reply that ignored the tools, with or without fences", () => {
    const json = JSON.stringify({ recipes: [recipe] });
    expect(recipesFromText(json)).toHaveLength(1);
    expect(recipesFromText("Sure!\n```json\n" + json + "\n```\nEnjoy")).toHaveLength(1);
  });

  it("returns nothing for prose, broken JSON or the wrong shape", () => {
    expect(recipesFromText("Just cook pasta.")).toEqual([]);
    expect(recipesFromText('{"recipes": [{"title": ')).toEqual([]);
    expect(recipesFromText('{"recipes": "none"}')).toEqual([]);
    expect(recipesFromText('{"recipes": [{"title": "x"}]}')).toEqual([]);
  });
});
