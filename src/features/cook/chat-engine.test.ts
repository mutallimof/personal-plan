import { describe, expect, it, vi } from "vitest";
import type { ChatMessage, ModelReply, ToolCall } from "@/features/gym/ai-provider.server";
import { runChat, MAX_BAD_STEPS, MAX_STEPS, type ChatDeps } from "./chat-engine";

const recipe = {
  title: "Chicken and potatoes",
  servings: 2,
  ingredients: [{ name: "Chicken breast", quantity: 400, unit: "g" }],
  steps: ["Cook."],
};

const call = (name: string, args: unknown, id = "c1"): ToolCall => ({
  id,
  type: "function",
  function: { name, arguments: typeof args === "string" ? args : JSON.stringify(args) },
});
const toolReply = (...toolCalls: ToolCall[]): ModelReply => ({
  message: { role: "assistant", content: null, tool_calls: toolCalls },
  text: "",
  toolCalls,
});
const textReply = (text: string): ModelReply => ({ message: { role: "assistant", content: text }, text, toolCalls: [] });

function setup(replies: (ModelReply | Error)[], over: Partial<ChatDeps> = {}) {
  const queue = [...replies];
  const seen: ChatMessage[][] = [];
  const deps: ChatDeps = {
    complete: vi.fn(async (messages: ChatMessage[]) => {
      seen.push(structuredClone(messages));
      const next = queue.shift() ?? textReply("done");
      if (next instanceof Error) throw next;
      return next;
    }),
    pantry: [{ name: "Chicken breast", quantity: 500, unit: "g" }],
    recipes: [{ id: "r1", title: "Soup" }],
    saveRecipe: vi.fn(async () => "new-id"),
    recipeExists: vi.fn(async (id: string) => id === "r1" || id === "new-id"),
    ...over,
  };
  return { deps, seen };
}
const ask = [{ role: "user" as const, content: "what can I cook" }];
const toolResults = (messages: ChatMessage[]) =>
  messages.filter((m) => m.role === "tool").map((m) => JSON.parse((m as { content: string }).content) as Record<string, unknown>);

describe("runChat", () => {
  it("sends the summary and the saved titles, never more", async () => {
    const { deps, seen } = setup([textReply("Hi")]);
    await runChat(deps, ask);
    const [system, context, user] = seen[0] ?? [];
    expect(system?.role).toBe("system");
    expect(context?.content).toContain("Chicken breast 500 g");
    expect(context?.content).toContain("Soup");
    expect(user).toEqual({ role: "user", content: "what can I cook" });
    expect(seen[0]).toHaveLength(3);
  });

  it("turns suggest_recipes into cards and ends with the model's text", async () => {
    const { deps } = setup([toolReply(call("suggest_recipes", { recipes: [recipe] })), textReply("Here you go")]);
    const out = await runChat(deps, ask);
    expect(out.cards).toHaveLength(1);
    expect(out.cards[0]?.title).toBe("Chicken and potatoes");
    expect(out.reply).toBe("Here you go");
  });

  it("answers search_pantry from the summary", async () => {
    const { deps, seen } = setup([toolReply(call("search_pantry", { query: "chicken" })), textReply("You have chicken.")]);
    const out = await runChat(deps, ask);
    expect(out.reply).toBe("You have chicken.");
    expect(toolResults(seen[1] ?? [])[0]).toEqual({ items: [{ name: "Chicken breast", quantity: 500, unit: "g" }] });
  });

  it("saves a recipe through a valid call", async () => {
    const { deps } = setup([toolReply(call("save_recipe", { recipe }, "a")), textReply("Done")]);
    const out = await runChat(deps, ask);
    expect(deps.saveRecipe).toHaveBeenCalledTimes(1);
    expect(out.saved).toEqual([{ id: "new-id", title: "Chicken and potatoes" }]);
  });

  it("cannot touch the shopping list: a call to add_to_shopping_list is an unknown tool and changes nothing", async () => {
    const { deps, seen } = setup([
      toolReply(call("add_to_shopping_list", { items: [{ name: "Lachsfilet" }, { name: "Dill" }] }, "a")),
      textReply("I can only suggest; the list is yours."),
    ]);
    const out = await runChat(deps, ask);
    expect(toolResults(seen[1] ?? [])[0]).toHaveProperty("error");
    expect(out).not.toHaveProperty("shopping");
    expect(out.reply).toBe("I can only suggest; the list is yours.");
  });

  it("only opens the confirmation for cook_recipe; nothing is removed", async () => {
    const { deps } = setup([toolReply(call("cook_recipe", { recipe_id: "r1" })), textReply("Check the amounts.")]);
    const out = await runChat(deps, ask);
    expect(out.cook).toBe("r1");
    // the engine has no way to change the pantry at all
    expect(Object.keys(deps).some((k) => /remove|delete|consume|cookRecipe/i.test(k))).toBe(false);
  });

  it("refuses cook_recipe for an id it does not know", async () => {
    const { deps, seen } = setup([toolReply(call("cook_recipe", { recipe_id: "someone-elses" })), textReply("Sorry")]);
    const out = await runChat(deps, ask);
    expect(out.cook).toBeNull();
    expect(toolResults(seen[1] ?? [])[0]).toHaveProperty("error");
  });

  it("can cook a recipe it just saved", async () => {
    const { deps } = setup([toolReply(call("save_recipe", { recipe }, "a")), toolReply(call("cook_recipe", { recipe_id: "new-id" }, "b")), textReply("")]);
    expect((await runChat(deps, ask)).cook).toBe("new-id");
  });

  describe("malformed model output", () => {
    it("tells the model about broken arguments and carries on", async () => {
      const { deps, seen } = setup([toolReply(call("suggest_recipes", "{not json")), toolReply(call("suggest_recipes", { recipes: [recipe] })), textReply("ok")]);
      const out = await runChat(deps, ask);
      expect(toolResults(seen[1] ?? [])[0]).toHaveProperty("error");
      expect(out.cards).toHaveLength(1);
    });

    it("does not save or add anything for invalid calls", async () => {
      const { deps } = setup([
        toolReply(call("save_recipe", { recipe: { title: "x" } }, "a"), call("delete_everything", {}, "c")),
        textReply("sorry"),
      ]);
      const out = await runChat(deps, ask);
      expect(deps.saveRecipe).not.toHaveBeenCalled();
      expect(out.saved).toEqual([]);
      expect(out.reply).toBe("sorry");
    });

    it("gives up politely after repeated bad calls", async () => {
      const { deps } = setup(Array.from({ length: 10 }, () => toolReply(call("suggest_recipes", "[[["))));
      const out = await runChat(deps, ask);
      expect(out.cards).toEqual([]);
      expect(out.reply).toMatch(/couldn't understand/i);
      expect(vi.mocked(deps.complete).mock.calls.length).toBeLessThanOrEqual(MAX_BAD_STEPS);
    });

    it("stops after a fixed number of steps even when the model keeps calling tools", async () => {
      const { deps } = setup(Array.from({ length: 20 }, (_, i) => toolReply(call("search_pantry", {}, `s${i}`))));
      const out = await runChat(deps, ask);
      expect(vi.mocked(deps.complete).mock.calls.length).toBe(MAX_STEPS);
      expect(out.reply).not.toBe("");
    });

    it("accepts recipes written as JSON text instead of a tool call", async () => {
      const { deps } = setup([textReply("```json\n" + JSON.stringify({ recipes: [recipe] }) + "\n```")]);
      const out = await runChat(deps, ask);
      expect(out.cards).toHaveLength(1);
      expect(out.reply).toBe("Here is an idea.");
    });

    it("never crashes on garbage text and always returns a reply", async () => {
      for (const text of ["", "{", '{"recipes": 5}', "null", "```"]) {
        const { deps } = setup([textReply(text)]);
        const out = await runChat(deps, ask);
        expect(out.cards).toEqual([]);
        expect(out.reply.length).toBeGreaterThan(0);
      }
    });

    it("survives a failing save and tells the model", async () => {
      const { deps, seen } = setup([toolReply(call("save_recipe", { recipe })), textReply("Could not save")], {
        saveRecipe: vi.fn(async () => {
          throw new Error("db down");
        }),
      });
      vi.spyOn(console, "error").mockImplementation(() => {});
      const out = await runChat(deps, ask);
      expect(out.saved).toEqual([]);
      expect(toolResults(seen[1] ?? [])[0]).toEqual({ error: "That did not work." });
    });
  });

  it("shows at most five cards and does not repeat a title", async () => {
    const many = Array.from({ length: 4 }, (_, i) => ({ ...recipe, title: `R${i}` }));
    const { deps } = setup([
      toolReply(call("suggest_recipes", { recipes: many }, "a")),
      toolReply(call("suggest_recipes", { recipes: [recipe, many[0], { ...recipe, title: "R5" }, { ...recipe, title: "R6" }] }, "b")),
      textReply("x"),
    ]);
    const out = await runChat(deps, ask);
    expect(out.cards.map((c) => c.title)).toEqual(["R0", "R1", "R2", "R3", "Chicken and potatoes"]);
  });

  // the rule from suggestions.ts, end to end: the stock is 500 g chicken breast
  const fine = (n: number) => ({ ...recipe, title: `Fine ${n}` }); // 400 g chicken: cookable
  const needs = (n: number, ...extra: string[]) => ({ ...recipe, title: `Needs ${n}`, ingredients: [...recipe.ingredients, ...extra.map((name) => ({ name, quantity: 1, unit: "pieces" as const }))] });

  it("sends a set with too few cookable recipes back to the model, and shows the corrected set", async () => {
    const bad = [fine(1), needs(1, "Lemon"), needs(2, "Dill"), needs(3, "Cream"), needs(4, "Leek")];
    const { deps, seen } = setup([
      toolReply(call("suggest_recipes", { recipes: bad }, "a")),
      toolReply(call("suggest_recipes", { recipes: [fine(2), fine(3)] }, "b")),
      textReply("Here you go"),
    ]);
    const out = await runChat(deps, ask);
    const first = toolResults(seen[1] ?? [])[0];
    expect(first).toHaveProperty("error");
    expect(String(first?.["error"])).toMatch(/Only 1 of the 5 recipes can be cooked/);
    expect(out.cards.map((c) => c.title)).toEqual(["Fine 1", "Fine 2", "Fine 3", "Needs 1", "Needs 2"]);
    expect(out.reply).toBe("Here you go");
  });

  it("applies the rule even when the model never fixes it, and tells the person", async () => {
    const bad = [fine(1), needs(1, "Lemon"), needs(2, "Dill"), needs(3, "Cream"), needs(4, "Leek")];
    const { deps } = setup([
      toolReply(call("suggest_recipes", { recipes: bad }, "a")),
      toolReply(call("suggest_recipes", { recipes: bad }, "b")),
      toolReply(call("suggest_recipes", { recipes: bad }, "c")),
      textReply("Here are some ideas."),
    ]);
    const out = await runChat(deps, ask);
    // one cookable, and at most two that need products: never four that do
    expect(out.cards.map((c) => c.title)).toEqual(["Fine 1", "Needs 1", "Needs 2"]);
    expect(out.reply).toMatch(/Only 1 of these is cookable/);
  });

  it("drops a recipe that misses more than two products", async () => {
    const set = [fine(1), fine(2), fine(3), needs(1, "A1", "A2", "A3"), needs(2, "Lemon")];
    const { deps } = setup([toolReply(call("suggest_recipes", { recipes: set }, "a")), textReply("ok")]);
    const out = await runChat(deps, ask);
    expect(out.cards.map((c) => c.title)).toEqual(["Fine 1", "Fine 2", "Fine 3", "Needs 2"]);
  });

  it("checks against the whole stock, not only the part the model was shown", async () => {
    const set = [fine(1), fine(2), fine(3), needs(1, "Lemon"), needs(2, "Dill")];
    const { deps } = setup([toolReply(call("suggest_recipes", { recipes: set }, "a")), textReply("ok")], {
      pantry: [],
      stock: [{ name: "Chicken breast", quantity: 500, unit: "g" }],
    });
    const out = await runChat(deps, ask);
    expect(out.cards).toHaveLength(5);
  });

  it("applies the rule to recipes found in a plain text reply too", async () => {
    const json = JSON.stringify({ recipes: [fine(1), fine(2), fine(3), needs(1, "A1", "A2", "A3"), needs(2, "Lemon")] });
    const { deps } = setup([textReply(json)]);
    const out = await runChat(deps, ask);
    expect(out.cards.map((c) => c.title)).toEqual(["Fine 1", "Fine 2", "Fine 3", "Needs 2"]);
  });

  it("lets provider errors through for the caller to show", async () => {
    const { deps } = setup([new Error("I'm a bit busy right now — try again in a moment.")]);
    await expect(runChat(deps, ask)).rejects.toThrow(/busy/);
  });
});

describe("streaming", () => {
  const streamingDeps = (pieces: string[][], replies: ModelReply[]) => {
    const queue = [...replies];
    const stream = [...pieces];
    return setup([], {
      complete: vi.fn(async (_m: ChatMessage[], _t: unknown, onText?: (d: string) => void) => {
        for (const p of stream.shift() ?? []) onText?.(p);
        return queue.shift() ?? textReply("");
      }) as unknown as ChatDeps["complete"],
    }).deps;
  };

  it("hands the model's words on as they come", async () => {
    const deps = streamingDeps([["Here ", "are ", "ideas."]], [textReply("Here are ideas.")]);
    const got: string[] = [];
    const out = await runChat(deps, ask, (d) => got.push(d));
    expect(got.join("")).toBe("Here are ideas.");
    expect(got.length).toBeGreaterThan(1);
    expect(out.reply).toBe("Here are ideas.");
  });

  it("streams the words said before a tool call too", async () => {
    const deps = streamingDeps([["Let me look."], ["Found it."]], [toolReply(call("search_pantry", {})), textReply("Found it.")]);
    const got: string[] = [];
    await runChat(deps, ask, (d) => got.push(d));
    expect(got.join("")).toBe("Let me look.Found it.");
  });

  it("does not stream a reply that is only JSON or a code fence", async () => {
    for (const first of ["{", "```json\n", "  {"]) {
      const json = JSON.stringify({ recipes: [recipe] });
      const deps = streamingDeps([[first, json.slice(1)]], [textReply(first.trim().startsWith("{") ? json : "```json\n" + json + "\n```")]);
      const got: string[] = [];
      const out = await runChat(deps, ask, (d) => got.push(d));
      expect(got).toEqual([]);
      expect(out.cards).toHaveLength(1);
    }
  });

  it("works the same without a listener", async () => {
    const deps = streamingDeps([["Hi"]], [textReply("Hi")]);
    expect((await runChat(deps, ask)).reply).toBe("Hi");
  });
});
