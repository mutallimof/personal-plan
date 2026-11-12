import type { ChatMessage, ModelReply, ToolDef } from "@/features/gym/ai-provider.server";
import type { AiRecipe } from "./ai-recipes";
import {
  CHAT_TOOLS,
  MAX_CARDS,
  SYSTEM_PROMPT,
  contextPrompt,
  parseArguments,
  recipesFromText,
  searchSummary,
  validateToolCall,
  type ChatTurn,
  type SavedRecipe,
  type SummaryLine,
  type ToolCallData,
} from "./chat";

/** Everything the engine needs from outside, so it can be tested without a model or a database. */
export type ChatDeps = {
  /** Asks the model. `onText` gets the answer text piece by piece when the provider streams it. */
  complete: (messages: ChatMessage[], tools: ToolDef[], onText?: (delta: string) => void) => Promise<ModelReply>;
  pantry: readonly SummaryLine[];
  recipes: readonly SavedRecipe[];
  /** Saves a recipe to the book; returns its id. */
  saveRecipe: (recipe: AiRecipe) => Promise<string>;
  /** Whether this saved recipe exists for this person. */
  recipeExists: (id: string) => Promise<boolean>;
};

export type ChatOutcome = {
  reply: string;
  /** Recipe ideas to show as cards (no numbers from the model; the app adds nutrition from the table). */
  cards: AiRecipe[];
  /** A saved recipe the person wants to cook: the screen opens the confirmation, nothing is removed here. */
  cook: string | null;
  saved: SavedRecipe[];
};

export const MAX_STEPS = 6;
/** Steps with a malformed or invalid tool call after which the turn ends. */
export const MAX_BAD_STEPS = 3;

/**
 * One chat turn: asks the model, runs the tool calls it makes after checking each one, and collects what the screen
 * should show. Malformed arguments, unknown tools and invalid recipes go back to the model as an error (so it can try
 * again) and are counted; after a few the turn ends with a plain message. A reply that ignored the tools but contains
 * a recipes object is accepted too. Provider failures are thrown for the caller to turn into a short message.
 */
export async function runChat(deps: ChatDeps, history: readonly ChatTurn[], onText?: (delta: string) => void): Promise<ChatOutcome> {
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: contextPrompt(deps.pantry, deps.recipes) },
    ...history.map((t): ChatMessage => ({ role: t.role, content: t.content })),
  ];
  const out: ChatOutcome = { reply: "", cards: [], cook: null, saved: [] };
  let badSteps = 0;
  let gaveUp = false;

  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await deps.complete(messages, CHAT_TOOLS, onText && streamingFilter(onText));
    if (!res.toolCalls.length) {
      out.reply = res.text;
      break;
    }
    messages.push(res.message);
    let bad = false;
    for (const c of res.toolCalls) {
      let result: unknown;
      const args = parseArguments(c.function.arguments);
      const checked = args === null ? null : validateToolCall(c.function.name, args);
      if (!checked || !checked.ok) {
        bad = true;
        result = { error: checked ? checked.error : "Arguments were not a valid JSON object. Call the tool again with valid JSON." };
      } else {
        try {
          result = await execute(deps, out, checked.call);
        } catch (e) {
          console.error(e);
          result = { error: "That did not work." };
        }
      }
      messages.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(result) });
    }
    if (bad) badSteps++;
    if (badSteps >= MAX_BAD_STEPS) {
      gaveUp = true;
      break;
    }
  }

  if (!out.cards.length) out.cards = recipesFromText(out.reply);
  if (out.cards.length && /^\s*[`{]/.test(out.reply)) out.reply = ""; // the reply was only the JSON
  if (!out.reply) {
    if (gaveUp && !out.cards.length && !out.cook) out.reply = "I couldn't understand the AI's answer — please try again.";
    else if (out.cards.length) out.reply = out.cards.length === 1 ? "Here is an idea." : "Here are some ideas.";
    else if (out.cook) out.reply = "Check the amounts, then cook.";
    else if (out.saved.length) out.reply = "Saved.";
    else out.reply = "I couldn't come up with an answer — try asking another way.";
  }
  return out;
}

async function execute(deps: ChatDeps, out: ChatOutcome, call: ToolCallData): Promise<unknown> {
  switch (call.name) {
    case "search_pantry":
      return { items: searchSummary(deps.pantry, call.query) };
    case "suggest_recipes": {
      for (const r of call.recipes) if (out.cards.length < MAX_CARDS && !out.cards.some((c) => c.title === r.title)) out.cards.push(r);
      return { ok: true, shown: call.recipes.length };
    }
    case "save_recipe": {
      const id = await deps.saveRecipe(call.recipe);
      out.saved.push({ id, title: call.recipe.title });
      return { ok: true, recipe_id: id };
    }
    case "cook_recipe": {
      const known = deps.recipes.some((r) => r.id === call.recipeId) || out.saved.some((r) => r.id === call.recipeId);
      if (!known || !(await deps.recipeExists(call.recipeId))) return { error: "No saved recipe with that id. Save it first." };
      out.cook = call.recipeId;
      return { ok: true, note: "The person will check the amounts on screen and confirm." };
    }
  }
}

/**
 * Passes streamed text on, except when the model starts with JSON or a code fence (a reply that ignores the tools and
 * is turned into cards afterwards): that would only show as clutter.
 */
function streamingFilter(onText: (delta: string) => void): (delta: string) => void {
  let seen = "";
  let allowed: boolean | null = null;
  return (delta) => {
    if (allowed === null) {
      seen += delta;
      const first = seen.trimStart()[0];
      if (!first) return;
      allowed = first !== "{" && first !== "`";
      if (allowed) onText(seen);
      return;
    }
    if (allowed) onText(delta);
  };
}
