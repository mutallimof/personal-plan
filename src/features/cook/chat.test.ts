import { describe, expect, it } from "vitest";
import { item } from "@/features/pantry/fixtures";
import {
  CHAT_TOOLS,
  MAX_CARDS,
  MAX_SUMMARY_LINES,
  MAX_TURNS,
  chatSummary,
  cleanRecipes,
  cleanTurns,
  contextPrompt,
  parseArguments,
  recipesFromText,
  searchSummary,
  validateToolCall,
} from "./chat";

const today = new Date("2026-05-10T12:00:00");

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
  it("sends names, quantities, units and days until expiry only", () => {
    const out = chatSummary(
      [item({ name: "Chicken breast", quantity: 500, unit: "g", expires_on: "2026-05-12", location_id: "secret-place", note: "private note", added_at: "2026-04-01T00:00:00Z" })],
      today,
    );
    expect(out).toEqual([{ name: "Chicken breast", quantity: 500, unit: "g", expires_in_days: 2 }]);
    const text = contextPrompt(out, [], today);
    expect(text).not.toMatch(/secret|private|2026-04|2026-05-12/);
  });

  it("leaves the expiry out when the item has none, and gives negative days for expired food", () => {
    const [a, b] = chatSummary([item({ name: "Rice", quantity: 1, unit: "kg" }), item({ name: "Milk", quantity: 1, unit: "l", expires_on: "2026-05-08" })], today);
    expect(a).toEqual({ name: "Rice", quantity: 1, unit: "kg" });
    expect(a).not.toHaveProperty("expires_in_days");
    expect(b?.expires_in_days).toBe(-2);
  });

  it("merges the same food in the same unit and keeps the earliest expiry", () => {
    const out = chatSummary(
      [
        item({ name: "Milk", quantity: 1, unit: "l", expires_on: "2026-05-14" }),
        item({ name: "milk", quantity: 0.5, unit: "l", expires_on: "2026-05-11" }),
        item({ name: "Milk", quantity: 200, unit: "ml" }),
      ],
      today,
    );
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ name: "Milk", quantity: 1.5, unit: "l", expires_in_days: 1 });
  });

  it("leaves out empty items and unknown units, and caps the list", () => {
    expect(chatSummary([item({ quantity: 0 }), item({ unit: "cups" })], today)).toEqual([]);
    const many = Array.from({ length: MAX_SUMMARY_LINES + 20 }, (_, i) => item({ name: `Food ${i}`, quantity: 1, unit: "g" }));
    expect(chatSummary(many, today)).toHaveLength(MAX_SUMMARY_LINES);
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
    expect(validateToolCall("search_pantry", {})).toEqual({ ok: true, call: { name: "search_pantry", query: "", expiringWithinDays: null } });
    expect(validateToolCall("search_pantry", { query: " rice ", expiring_within_days: 3 })).toEqual({
      ok: true,
      call: { name: "search_pantry", query: "rice", expiringWithinDays: 3 },
    });
    expect(validateToolCall("search_pantry", { query: 5 }).ok).toBe(false);
    expect(validateToolCall("search_pantry", { expiring_within_days: -1 }).ok).toBe(false);
  });

  it("accepts valid recipes in suggest_recipes, drops invalid ones and keeps at most three", () => {
    const r = validateToolCall("suggest_recipes", {
      recipes: [recipe, { title: "No ingredients", servings: 2, ingredients: [], steps: ["x"] }, recipe, recipe, recipe],
    });
    expect(r.ok && r.call.name === "suggest_recipes" && r.call.recipes).toHaveLength(MAX_CARDS);
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

  it("checks cook_recipe and add_to_shopping_list", () => {
    expect(validateToolCall("cook_recipe", { recipe_id: "abc" })).toEqual({ ok: true, call: { name: "cook_recipe", recipeId: "abc" } });
    expect(validateToolCall("cook_recipe", {}).ok).toBe(false);
    expect(validateToolCall("cook_recipe", { recipe_id: 5 }).ok).toBe(false);
    const list = validateToolCall("add_to_shopping_list", { items: [{ name: "Milk", quantity: 1, unit: "l" }, { name: "Salt" }] });
    expect(list.ok && list.call.name === "add_to_shopping_list" && list.call.items).toHaveLength(2);
    expect(validateToolCall("add_to_shopping_list", { items: [{ name: "" }] }).ok).toBe(false);
    expect(validateToolCall("add_to_shopping_list", { items: [{ name: "Milk", unit: "cups" }] }).ok).toBe(false);
    expect(validateToolCall("add_to_shopping_list", { items: "milk" }).ok).toBe(false);
  });

  it("rejects tools that do not exist, so the model cannot reach anything else", () => {
    for (const name of ["delete_item", "remove_pantry_item", "update_pantry", "", "__proto__"]) expect(validateToolCall(name, {}).ok).toBe(false);
  });

  it("offers exactly the five tools, none of which removes anything from the pantry", () => {
    expect(CHAT_TOOLS.map((t) => t.name)).toEqual(["search_pantry", "suggest_recipes", "save_recipe", "cook_recipe", "add_to_shopping_list"]);
  });
});

describe("searchSummary", () => {
  const lines = chatSummary(
    [
      item({ name: "Chicken breast", quantity: 500, unit: "g", expires_on: "2026-05-11" }),
      item({ name: "Potatoes", quantity: 1, unit: "kg", expires_on: "2026-05-30" }),
      item({ name: "Rice", quantity: 1, unit: "kg" }),
    ],
    today,
  );

  it("finds by word, including plurals", () => {
    expect(searchSummary(lines, "potato", null).map((l) => l.name)).toEqual(["Potatoes"]);
    expect(searchSummary(lines, "", null)).toHaveLength(3);
  });

  it("finds what expires soon and leaves out what has no date", () => {
    expect(searchSummary(lines, "", 3).map((l) => l.name)).toEqual(["Chicken breast"]);
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
