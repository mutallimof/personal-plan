import { BUILTIN_CATEGORIES, isBuiltinCategory } from "./categories";

/** A saved category name: either a new category, or a new label for a built-in one. */
export type CategoryRow = { key: string; label: string };

export type CategoryOption = { value: string; label: string; builtin: boolean };

const titled = (key: string) => key.charAt(0).toUpperCase() + key.slice(1);

/** All categories in display order: the built-in ones first (renamed where the person did), then their own. */
export function categoryOptions(rows: readonly CategoryRow[]): CategoryOption[] {
  const labels = new Map(rows.map((r) => [r.key, r.label]));
  const builtin = BUILTIN_CATEGORIES.map((key) => ({ value: key, label: labels.get(key) ?? titled(key), builtin: true }));
  const custom = rows
    .filter((r) => !isBuiltinCategory(r.key))
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((r) => ({ value: r.key, label: r.label, builtin: false }));
  return [...builtin, ...custom];
}

/** The text to show for a category key. */
export function categoryLabel(key: string, rows: readonly CategoryRow[]): string {
  return categoryOptions(rows).find((o) => o.value === key)?.label ?? titled(key);
}

/** The key stored on items for a typed name: lower case letters and digits with single spaces. */
export function keyFromLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 40)
    .trim();
}

/** Why a new category name cannot be used, or null. */
export function newCategoryProblem(label: string, rows: readonly CategoryRow[]): string | null {
  const key = keyFromLabel(label);
  if (!label.trim() || !key) return "Enter a name";
  if (label.trim().length > 40) return "At most 40 characters";
  const taken = categoryOptions(rows).some((o) => o.value === key || o.label.toLowerCase() === label.trim().toLowerCase());
  return taken ? "That category exists" : null;
}

/** Why a new label cannot be used for an existing category, or null. */
export function renameProblem(key: string, label: string, rows: readonly CategoryRow[]): string | null {
  if (!label.trim()) return "Enter a name";
  if (label.trim().length > 40) return "At most 40 characters";
  const clash = categoryOptions(rows).some((o) => o.value !== key && o.label.toLowerCase() === label.trim().toLowerCase());
  return clash ? "That name is used" : null;
}
