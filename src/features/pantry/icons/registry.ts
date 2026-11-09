import { isCategory, type Category } from "@/features/pantry/model";
import data from "./icons.json";

export type IconDef = { key: string; code: string; label: string; words: readonly string[] };

type IconData = { source: string; categories: Record<string, string>; icons: IconDef[] };
const { source, categories, icons } = data as IconData;

/** Where the pictures come from; shown in the app's credits line. */
export const ICON_SOURCE = source;

export const ICONS: readonly IconDef[] = icons;
const byKey = new Map(ICONS.map((i) => [i.key, i]));

export const isIconKey = (v: unknown): v is string => typeof v === "string" && byKey.has(v);
export const iconLabel = (key: string) => byKey.get(key)?.label ?? key;

/** Address of an icon file. The files are in `public/icons/food`, so no outside server is involved. */
export const iconUrl = (key: string) => `/icons/food/${key}.svg`;

/** Lower case, no accents: "Käse" and "Süßkartoffel" become "kase" and "susskartoffel". */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const SHORT = 4;

/** Where a keyword ends in the name, or -1. Short words must be a whole word; longer ones may sit inside a compound ("Vollkornbrot"). */
function endOf(name: string, tokens: readonly string[], word: string): number {
  if (word.length < SHORT) {
    const i = tokens.indexOf(word);
    if (i < 0) return -1;
    return tokens.slice(0, i + 1).join(" ").length;
  }
  const at = name.lastIndexOf(word);
  return at < 0 ? -1 : at + word.length;
}

const KEYWORDS = ICONS.flatMap((i) => i.words.map((w) => ({ key: i.key, word: fold(w) }))).filter(
  (k) => k.word,
);

/**
 * The icon whose keyword fits a product name. In "Orangensaft" both "orange" and "saft" fit; the word that
 * ends last wins ("saft"), because the last part of a name says what the thing is. A longer word breaks ties.
 */
export function matchIcon(productName: string): string | null {
  const name = fold(productName);
  if (!name) return null;
  const tokens = name.split(" ");
  let best: { key: string; end: number; len: number } | null = null;
  for (const k of KEYWORDS) {
    const end = endOf(name, tokens, k.word);
    if (end < 0) continue;
    if (!best || end > best.end || (end === best.end && k.word.length > best.len))
      best = { key: k.key, end, len: k.word.length };
  }
  return best?.key ?? null;
}

export const categoryIcon = (category: string): string =>
  categories[isCategory(category) ? category : "other"] ?? "box";

export type IconInput = {
  /** Icon chosen for this very item. */
  icon?: string | null | undefined;
  /** Icon chosen for the product in the dictionary. */
  aliasIcon?: string | null | undefined;
  name: string;
  category: Category | string;
};

/** Icon key for an item: its own choice, then the dictionary's, then a name match, then the category's icon. */
export function resolveIcon(input: IconInput): string {
  if (isIconKey(input.icon)) return input.icon;
  if (isIconKey(input.aliasIcon)) return input.aliasIcon;
  return matchIcon(input.name) ?? categoryIcon(input.category);
}

/** Icons for the picker: every icon when the search is empty, else those whose name, key or keywords contain it. */
export function searchIcons(query: string): readonly IconDef[] {
  const q = fold(query);
  if (!q) return ICONS;
  return ICONS.filter(
    (i) =>
      fold(i.label).includes(q) || i.key.includes(q) || i.words.some((w) => fold(w).includes(q)),
  );
}

/** Dictionary icons by product name, for items that have no icon of their own. */
export function aliasIconMap(
  aliases: readonly { product_name: string; icon: string | null }[],
): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  for (const a of aliases)
    if (isIconKey(a.icon)) out.set(a.product_name.trim().toLowerCase(), a.icon);
  return out;
}

/** The icon key to draw for an item, using the dictionary's icons when the item has none. */
export function iconForItem(
  item: { name: string; category: string; icon: string | null },
  byName: ReadonlyMap<string, string>,
): string {
  return resolveIcon({
    icon: item.icon,
    aliasIcon: byName.get(item.name.trim().toLowerCase()),
    name: item.name,
    category: item.category,
  });
}
