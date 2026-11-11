import { NOISE_WORDS, SYNONYM_GROUPS } from "./ingredient-synonyms";

/**
 * A name reduced to what should not matter when matching: case, accents, spacing and a plural "s"
 * ("Eggs" = "egg", "Tomatoes" = "tomato"). Used to match recipe ingredients to pantry items and nutrition rows.
 */
export function ingredientKey(name: string): string {
  const folded = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
  if (folded.length > 4 && folded.endsWith("oes")) return folded.slice(0, -2);
  if (folded.length > 3 && folded.endsWith("s") && !folded.endsWith("ss")) return folded.slice(0, -1);
  return folded;
}

// ---------- matching names that mean the same food ----------

const fold = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase();

/** A word without its plural ending, German and English: Zitronen and Zitrone both give "zitron", Tomatoes "tomato". */
function stemOf(word: string): string {
  if (word.length > 5 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 5 && word.endsWith("oes")) return word.slice(0, -2);
  if (word.length > 5 && word.endsWith("en")) return word.slice(0, -2);
  if (word.length > 4 && (word.endsWith("n") || word.endsWith("e"))) return word.slice(0, -1);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

/** stem of every word in the synonym table -> stem of the first word of its group */
const SYNONYM_OF = new Map<string, string>();
/** the table's own words (not stems), for recognising receipt abbreviations such as "Lachsfil" */
const TABLE_WORDS: { word: string; head: string }[] = [];
for (const group of SYNONYM_GROUPS) {
  const head = stemOf(fold(group[0] ?? ""));
  for (const w of group) {
    const f = fold(w);
    SYNONYM_OF.set(stemOf(f), head);
    SYNONYM_OF.set(f, head);
    TABLE_WORDS.push({ word: f, head });
  }
}

const ABBREVIATION_MIN = 6;
const ABBREVIATION_RATIO = 0.7;

/** A cut-off word (receipt abbreviation) that is the start of a longer one: at least 6 letters and 70% of it. */
const isPrefixOf = (short: string, long: string): boolean =>
  short.length >= ABBREVIATION_MIN && short.length / long.length >= ABBREVIATION_RATIO && long.startsWith(short);

function canonical(word: string): string {
  const direct = SYNONYM_OF.get(word) ?? SYNONYM_OF.get(stemOf(word));
  if (direct) return direct;
  const abbreviated = TABLE_WORDS.find((t) => isPrefixOf(word, t.word));
  return abbreviated ? abbreviated.head : stemOf(word);
}

/**
 * The words of a food name that identify it: lower case, no accents, no amounts or freshness words, plural endings
 * and synonyms folded ("Dill Bund" gives ["dill"], "Zitronen" and "Zitrone" give ["zitron"], "Schlagsahne" and
 * "Sahne" give the same word).
 */
export function ingredientTokens(name: string): string[] {
  const words = fold(name)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 2 && !/\d/.test(w) && !NOISE_WORDS.has(w));
  return [...new Set(words.map(canonical))];
}

function distanceAtMostOne(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (i === a.length && i === b.length) return true;
  const restA = a.slice(a.length === b.length ? i + 1 : a.length > b.length ? i + 1 : i);
  const restB = b.slice(a.length === b.length ? i + 1 : b.length > a.length ? i + 1 : i);
  return restA === restB;
}

/** Same word, allowing one typo or a cut-off ending in longer words. */
const sameWord = (a: string, b: string): boolean =>
  a === b || (Math.min(a.length, b.length) >= ABBREVIATION_MIN && distanceAtMostOne(a, b)) || isPrefixOf(a, b) || isPrefixOf(b, a);

/**
 * Do two names mean the same food? Words are compared after dropping noise, plural endings and synonyms, so
 * "Zitronen" = "Zitrone", "Sahne" = "Schlagsahne", "Dill Bund" = "Dill" and "Lachsfil" = "Lachsfilet". Every word of
 * one name must have a partner in the other, so "Sahne" is not "Saure Sahne" and "Milch" is not "Milchreis".
 */
export function sameIngredient(a: string, b: string): boolean {
  const ta = ingredientTokens(a);
  const tb = ingredientTokens(b);
  if (!ta.length || !tb.length) return ingredientKey(a) === ingredientKey(b);
  if (ta.length !== tb.length) return false;
  const free = [...tb];
  for (const w of ta) {
    const at = free.findIndex((x) => sameWord(w, x));
    if (at < 0) return false;
    free.splice(at, 1);
  }
  return true;
}
