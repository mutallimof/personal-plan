import type { ChatMessage, ModelReply, ToolDef } from "@/features/gym/ai-provider.server";
import type { AiRecipe } from "./ai-recipes";
import {
  CHAT_TOOLS,
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
import { feedbackFor, selectSuggestions, shortfallNote, type Selection, type StockLine } from "./suggestions";

/** Everything the engine needs from outside, so it can be tested without a model or a database. */
export type ChatDeps = {
  /** Asks the model. `onText` gets the answer text piece by piece when the provider streams it. */
  complete: (messages: ChatMessage[], tools: ToolDef[], onText?: (delta: string) => void) => Promise<ModelReply>;
  pantry: readonly SummaryLine[];
  /** The whole stock, for checking which ideas are cookable (the model only sees `pantry`, which can be cut short). Defaults to `pantry`. */
  stock?: readonly StockLine[];
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
/** Times a set of ideas that breaks the rule (see `suggestions.ts`) is sent back to the model to be replaced. */
export const MAX_SUGGEST_RETRIES = 2;
/** Most distinct ideas kept while the check picks the ones that fit. */
const MAX_CANDIDATES = 14;

/** What the engine keeps between tool calls of one turn. */
type Turn = { candidates: AiRecipe[]; retries: number; selection: Selection | null };
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
  const turn: Turn = { candidates: [], retries: 0, selection: null };
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
          result = await execute(deps, out, turn, checked.call);
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

  // a reply that ignored the tools but contains recipes counts as a proposal too
  if (!turn.candidates.length) for (const r of recipesFromText(out.reply)) addCandidate(turn, r);
  if (turn.candidates.length) {
    // the rule is applied here, whatever the model did: see `selectSuggestions`
    const sel = selectSuggestions(turn.candidates, deps.stock ?? deps.pantry);
    out.cards = sel.cards;
    turn.selection = sel;
  }
  if (out.cards.length && /^\s*[`{]/.test(out.reply)) out.reply = ""; // the reply was only the JSON
  if (!out.reply) {
    if (gaveUp && !out.cards.length && !out.cook) out.reply = "I couldn't understand the AI's answer — please try again.";
    else if (out.cards.length) out.reply = out.cards.length === 1 ? "Here is an idea." : "Here are some ideas.";
    else if (out.cook) out.reply = "Check the amounts, then cook.";
    else if (out.saved.length) out.reply = "Saved.";
    else out.reply = "I couldn't come up with an answer — try asking another way.";
  }
  if (turn.selection && out.cards.length && !turn.selection.satisfied) out.reply = `${out.reply} ${shortfallNote(turn.selection)}`.trim();
  return out;
}

function addCandidate(turn: Turn, r: AiRecipe): void {
  if (turn.candidates.length < MAX_CANDIDATES && !turn.candidates.some((c) => c.title.trim().toLowerCase() === r.title.trim().toLowerCase())) turn.candidates.push(r);
}

async function execute(deps: ChatDeps, out: ChatOutcome, turn: Turn, call: ToolCallData): Promise<unknown> {
  switch (call.name) {
    case "search_pantry":
      return { items: searchSummary(deps.pantry, call.query) };
    case "suggest_recipes": {
      for (const r of call.recipes) addCandidate(turn, r);
      const sel = selectSuggestions(turn.candidates, deps.stock ?? deps.pantry);
      out.cards = sel.cards;
      if (!sel.satisfied && turn.retries < MAX_SUGGEST_RETRIES) {
        // not enough cookable ideas: send them back with what is wrong, so the model can replace them
        turn.retries++;
        return { error: feedbackFor(sel, turn.candidates.length) };
      }
      return { ok: true, shown: sel.cards.length, cookable: sel.cookable, need_products: sel.near };
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
