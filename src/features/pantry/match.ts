import type { Alias } from "./aliases";
import { normalizeReceiptText } from "./normalize";

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length] ?? 0;
}

/** 1 for equal strings, 0 for nothing in common. */
export function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  return longest === 0 ? 1 : 1 - levenshtein(a, b) / longest;
}

export type Match =
  | { kind: "exact"; alias: Alias }
  | { kind: "uncertain"; alias: Alias; score: number }
  | { kind: "none" };

/** Fuzzy matches below this similarity are ignored. */
export const FUZZY_MIN = 0.85;
/** Short texts differ by one letter too easily to be compared loosely. */
export const FUZZY_MIN_LENGTH = 6;
/** A runner-up for a different product this close to the best makes the match ambiguous. */
export const FUZZY_MARGIN = 0.05;

const numbers = (s: string) => (s.match(/\d+(?:\.\d+)?%?/g) ?? []).join(" ");

/**
 * Finds the dictionary entry for a receipt text.
 * - exact: the normalized text is equal (an entry for this store wins over a store-less one);
 * - uncertain: a close spelling, never accepted without a person confirming it. Numbers must be identical,
 *   so "MILCH 1.5%" never matches "MILCH 3.5%";
 * - none: nothing close enough, or two different products are equally close.
 */
export function matchAlias(aliases: readonly Alias[], rawText: string, store: string | null): Match {
  const text = normalizeReceiptText(rawText);
  if (!text) return { kind: "none" };
  const usable = aliases.filter((a) => a.store === null || a.store === store);

  const exact = usable.filter((a) => a.raw_text === text);
  const best = exact.find((a) => a.store !== null) ?? exact[0];
  if (best) return { kind: "exact", alias: best };

  if (text.length < FUZZY_MIN_LENGTH) return { kind: "none" };
  const wanted = numbers(text);
  const scored = usable
    .filter((a) => numbers(a.raw_text) === wanted)
    .map((alias) => ({ alias, score: similarity(text, alias.raw_text) }))
    .filter((c) => c.score >= FUZZY_MIN)
    .sort((a, b) => b.score - a.score);

  const first = scored[0];
  if (!first) return { kind: "none" };
  const rival = scored.find((c) => c.alias.product_name !== first.alias.product_name);
  if (rival && first.score - rival.score < FUZZY_MARGIN) return { kind: "none" };
  return { kind: "uncertain", alias: first.alias, score: first.score };
}
