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
    pantry: [{ name: "Chicken breast", quantity: 500, unit: "g", expires_in_days: 2 }],
    recipes: [{ id: "r1", title: "Soup" }],
    today: new Date("2026-05-10T12:00:00"),
    saveRecipe: vi.fn(async () => "new-id"),
    addToShoppingList: vi.fn(async () => {}),
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
    expect(context?.content).toContain("Chicken breast");
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
    expect(toolResults(seen[1] ?? [])[0]).toEqual({ items: [{ name: "Chicken breast", quantity: 500, unit: "g", expires_in_days: 2 }] });
  });

  it("saves a recipe and adds to the shopping list only through valid calls", async () => {
    const { deps } = setup([
      toolReply(call("save_recipe", { recipe }, "a"), call("add_to_shopping_list", { items: [{ name: "Milk", quantity: 1, unit: "l" }] }, "b")),
      textReply("Done"),
    ]);
    const out = await runChat(deps, ask);
    expect(deps.saveRecipe).toHaveBeenCalledTimes(1);
    expect(deps.addToShoppingList).toHaveBeenCalledWith([{ name: "Milk", quantity: 1, unit: "l" }]);
    expect(out.saved).toEqual([{ id: "new-id", title: "Chicken and potatoes" }]);
    expect(out.shopping).toEqual(["Milk"]);
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
        toolReply(call("save_recipe", { recipe: { title: "x" } }, "a"), call("add_to_shopping_list", { items: [{ name: "" }] }, "b"), call("delete_everything", {}, "c")),
        textReply("sorry"),
      ]);
      const out = await runChat(deps, ask);
      expect(deps.saveRecipe).not.toHaveBeenCalled();
      expect(deps.addToShoppingList).not.toHaveBeenCalled();
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

  it("limits the cards to three and does not repeat a title", async () => {
    const many = Array.from({ length: 3 }, (_, i) => ({ ...recipe, title: `R${i}` }));
    const { deps } = setup([
      toolReply(call("suggest_recipes", { recipes: many }, "a")),
      toolReply(call("suggest_recipes", { recipes: [recipe, many[0]] }, "b")),
      textReply("x"),
    ]);
    const out = await runChat(deps, ask);
    expect(out.cards.map((c) => c.title)).toEqual(["R0", "R1", "R2"]);
  });

  it("lets provider errors through for the caller to show", async () => {
    const { deps } = setup([new Error("I'm a bit busy right now — try again in a moment.")]);
    await expect(runChat(deps, ask)).rejects.toThrow(/busy/);
  });
});
