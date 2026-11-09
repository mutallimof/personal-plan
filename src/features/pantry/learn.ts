import type { AliasDraft } from "./aliases";
import { roundQty } from "./items";
import type { Category, LocationKind, Unit } from "./model";
import { normalizeReceiptText } from "./normalize";

/** What a person settled on for one receipt line. */
export type Correction = {
  rawText: string;
  store: string | null;
  name: string;
  category: Category;
  /** Kind of the place chosen, if any. */
  placeKind: LocationKind | null;
  unit: Unit;
  quantity: number;
  /** How many were bought, as printed on the receipt (the "2" in "2 x 0,99"). */
  count: number;
  /** The receipt gave a weight, so the amount changes every time and is not worth remembering. */
  weighed: boolean;
};

/**
 * The dictionary entry that makes the same receipt text come out right next time, or null when the text
 * normalizes to nothing. The remembered quantity is per item bought, so "2 x milk = 2 l" is stored as 1 l.
 */
export function draftFromCorrection(c: Correction): AliasDraft | null {
  const raw_text = normalizeReceiptText(c.rawText);
  const product_name = c.name.trim().slice(0, 120);
  if (!raw_text || !product_name) return null;
  const each = c.count > 0 ? roundQty(c.quantity / c.count) : c.quantity;
  return {
    raw_text,
    store: c.store,
    product_name,
    category: c.category,
    default_location_kind: c.placeKind,
    default_unit: c.unit,
    default_quantity: c.weighed || !(each > 0) ? null : each,
  };
}
