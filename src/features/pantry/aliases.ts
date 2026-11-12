import type { Tables } from "@/integrations/supabase/types";
import { normalizeReceiptText } from "./normalize";
import { isIconKey } from "./icons/registry";
import { legacyCategory } from "./categories";
import { isCategory, isLocationKind, isUnit, type Category, type LocationKind, type Unit } from "./model";

export type Alias = Tables<"product_aliases">;

/** An alias before it has a database row. `raw_text` is always normalized. */
export type AliasDraft = {
  raw_text: string;
  store: string | null;
  product_name: string;
  category: Category;
  default_location_kind: LocationKind | null;
  default_unit: Unit;
  default_quantity: number | null;
  /** Picture for the product (see pantry/icons). Left out when the entry says nothing about it. */
  icon?: string | null;
};

/** Identity of an alias: normalized text plus store (a missing store is its own value). */
export const aliasKey = (a: { raw_text: string; store: string | null }) => `${a.store ?? ""}|${a.raw_text}`;

export const cleanStore = (s: unknown): string | null => {
  const t = typeof s === "string" ? s.trim().toLowerCase().slice(0, 60) : "";
  return t || null;
};

/** Checks one hand-written or imported entry. Returns the draft, or a short reason it was rejected. */
export function toDraft(input: unknown): AliasDraft | string {
  if (!input || typeof input !== "object") return "not an object";
  const o = input as Record<string, unknown>;
  const raw_text = normalizeReceiptText(typeof o["raw_text"] === "string" ? o["raw_text"] : "");
  if (!raw_text) return "raw_text is empty";
  const product_name = typeof o["product_name"] === "string" ? o["product_name"].trim().slice(0, 120) : "";
  if (!product_name) return "product_name is empty";

  const rawCategory = o["category"] ?? "other";
  const category = typeof rawCategory === "string" ? legacyCategory(rawCategory) : rawCategory;
  if (!isCategory(category)) return `unknown category "${String(category)}"`;
  const kind = o["default_location_kind"] ?? null;
  if (kind !== null && !isLocationKind(kind)) return `unknown default_location_kind "${String(kind)}"`;
  const unit = o["default_unit"] ?? "pieces";
  if (!isUnit(unit)) return `unknown default_unit "${String(unit)}"`;
  const qty = o["default_quantity"] ?? null;
  if (qty !== null && !(typeof qty === "number" && Number.isFinite(qty) && qty > 0)) return "default_quantity must be a number above 0";

  const icon = o["icon"];
  if (icon !== undefined && icon !== null && !isIconKey(icon)) return `unknown icon "${String(icon)}"`;

  return {
    raw_text,
    store: cleanStore(o["store"]),
    product_name,
    category,
    default_location_kind: kind,
    default_unit: unit,
    default_quantity: qty,
    ...(icon === undefined ? {} : { icon }),
  };
}

/** Reads an exported file: `{ "aliases": [...] }` or a bare array. Bad entries are reported, good ones kept. */
export function parseAliasFile(text: string): { drafts: AliasDraft[]; errors: string[] } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { drafts: [], errors: ["The file is not valid JSON."] };
  }
  const list = Array.isArray(json) ? json : (json as { aliases?: unknown } | null)?.aliases;
  if (!Array.isArray(list)) return { drafts: [], errors: ['Expected a list, or an object with an "aliases" list.'] };

  const byKey = new Map<string, AliasDraft>();
  const errors: string[] = [];
  list.forEach((entry, i) => {
    const d = toDraft(entry);
    if (typeof d === "string") errors.push(`Entry ${i + 1}: ${d}`);
    else byKey.set(aliasKey(d), d);
  });
  return { drafts: [...byKey.values()], errors };
}

export function exportAliases(aliases: readonly Alias[]): string {
  const rows = [...aliases]
    .sort((a, b) => a.raw_text.localeCompare(b.raw_text) || (a.store ?? "").localeCompare(b.store ?? ""))
    .map((a) => ({
      raw_text: a.raw_text,
      store: a.store,
      product_name: a.product_name,
      category: a.category,
      default_location_kind: a.default_location_kind,
      default_unit: a.default_unit,
      default_quantity: a.default_quantity,
      ...(a.icon ? { icon: a.icon } : {}),
    }));
  return JSON.stringify({ version: 1, aliases: rows }, null, 2) + "\n";
}

/** Splits drafts into new rows and updates of existing ones (same text and store). Later drafts win. */
export function planAliasWrites(
  existing: readonly Alias[],
  drafts: readonly AliasDraft[],
): { inserts: AliasDraft[]; updates: { id: string; draft: AliasDraft }[] } {
  const byKey = new Map(existing.map((a) => [aliasKey(a), a.id]));
  const latest = new Map<string, AliasDraft>();
  for (const d of drafts) latest.set(aliasKey(d), d);

  const inserts: AliasDraft[] = [];
  const updates: { id: string; draft: AliasDraft }[] = [];
  for (const [key, draft] of latest) {
    const id = byKey.get(key);
    if (id) updates.push({ id, draft });
    else inserts.push(draft);
  }
  return { inserts, updates };
}
