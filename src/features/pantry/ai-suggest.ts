import { BUILTIN_CATEGORIES, isBuiltinCategory } from "./categories";
import { isLocationKind, LOCATION_KINDS, type Category, type LocationKind } from "./model";
import { normalizeReceiptText } from "./normalize";

/** A guess for one receipt line. Shown on the review screen, never saved without a person accepting it. */
export type Suggestion = {
  /** The normalized receipt text it answers. */
  text: string;
  name: string;
  category: Category;
  kind: LocationKind | null;
};

/** Most lines sent in one request. */
export const MAX_AI_LINES = 40;

/**
 * The texts to send for unmatched lines: normalized (no prices or weights), deduplicated, empty ones dropped.
 * Only this text ever leaves the device for the AI check.
 */
export function textsToSend(rawTexts: readonly string[]): string[] {
  return [...new Set(rawTexts.map(normalizeReceiptText).filter(Boolean))].slice(0, MAX_AI_LINES);
}

export const SYSTEM_PROMPT =
  "You help to identify grocery products from abbreviated German supermarket receipt texts. " +
  "For each text give a short, plain English product name, a category and the place it is usually stored. " +
  `Categories: ${BUILTIN_CATEGORIES.join(", ")}. Places: ${LOCATION_KINDS.join(", ")}. ` +
  "If a text is not a grocery product or you are not sure, still answer with your best guess and category \"other\". " +
  'Reply with ONLY a JSON object: {"items":[{"text":"<the text exactly as given>","name":"...","category":"...","place":"..."}]}.';

export const userPrompt = (texts: readonly string[]) => `Receipt texts:\n${JSON.stringify(texts)}`;

/**
 * Checks the model's answer. Entries for texts we did not ask about, repeated entries and entries without a name
 * are dropped; an unknown category becomes "other" and an unknown place becomes none.
 */
export function parseSuggestions(value: unknown, asked: readonly string[]): Suggestion[] {
  const items = (value as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return [];
  const allowed = new Set(asked);
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    const text = typeof o["text"] === "string" ? normalizeReceiptText(o["text"]) : "";
    const name = typeof o["name"] === "string" ? o["name"].trim().slice(0, 120) : "";
    if (!allowed.has(text) || seen.has(text) || !name) continue;
    seen.add(text);
    const category = typeof o["category"] === "string" ? o["category"].trim().toLowerCase() : "";
    const place = typeof o["place"] === "string" ? o["place"].trim().toLowerCase() : "";
    out.push({
      text,
      name,
      category: isBuiltinCategory(category) ? category : "other",
      kind: isLocationKind(place) ? place : null,
    });
  }
  return out;
}
