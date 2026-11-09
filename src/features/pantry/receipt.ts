import type { Unit } from "./model";

/** One purchased line of a receipt, as read from its text. */
export type ParsedLine = {
  /** Index of the first source line, so OCR confidence can be attached to it. */
  lineNo: number;
  /** The product text as printed, without prices. */
  raw_text: string;
  /** How many were bought, or the weight when `unit` is set. */
  quantity: number;
  /** Set only when the receipt gives a weight (kg or g). */
  unit: Unit | null;
  unit_price: number | null;
  total_price: number | null;
};

export type ReceiptParser = {
  /** Reads the purchased lines out of the receipt text. */
  parse(text: string): ParsedLine[];
};

const NUM = String.raw`\d{1,5}[.,]\d{2}`;
const toNumber = (s: string) => Number(s.replace(",", "."));

// "BANANEN 1,89 A"  /  "BUTTER 2,19 EUR B"  /  "PFAND -0,25"
const ITEM = new RegExp(String.raw`^(?<name>.*\S)\s+(?<total>-?${NUM})\s*(?:EUR|€)?\s*[A-D*]?$`, "i");
// "TOMATEN 3 x 1,29 3,87 B"  (name, count, unit price, total on one line)
const ITEM_WITH_COUNT = new RegExp(
  String.raw`^(?<name>.*\S)\s+(?<count>\d{1,3})\s*(?:Stk\.?|ST)?\s*[x*]\s*(?<unit>${NUM})\s+(?<total>-?${NUM})\s*(?:EUR|€)?\s*[A-D*]?$`,
  "i",
);
// "2 x 0,99" on the line after an item (a total may follow)
const COUNT_LINE = new RegExp(
  String.raw`^(?<count>\d{1,3})\s*(?:Stk\.?|ST)?\s*[x*]\s*(?<unit>${NUM})\s*(?:EUR|€)?(?:\s+-?${NUM})?\s*[A-D*]?$`,
  "i",
);
// "0,532 kg x 2,99 EUR/kg" on the line after an item
const WEIGHT_LINE = new RegExp(
  String.raw`^(?<weight>\d{1,3}[.,]\d{1,3})\s*(?<u>kg|g)\s*[x*]\s*(?<unit>${NUM})\s*(?:EUR|€)?\s*(?:/\s*(?:kg|g))?(?:\s+-?${NUM})?\s*[A-D*]?$`,
  "i",
);

// Lines about the payment, taxes or discounts: never products.
const NOT_PRODUCT =
  /^(zwischensumme|rabatt|coupon|gutschein|payback|bonus|preisvorteil|pfand|leergut|einweg|mehrweg|rückgabe|rueckgabe|ersparnis|tüte|tuete|tragetasche)/i;
// First line after the last product.
const END = /^(summe|total|gesamt|zu zahlen|zahlbetrag|betrag)\b/i;

export function parseGenericReceipt(text: string): ParsedLine[] {
  const rows = text.split(/\r?\n/);
  const out: ParsedLine[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = (rows[i] ?? "").replace(/\s+/g, " ").trim();
    if (!row) continue;
    if (END.test(row)) break;

    const last = out.at(-1);
    const weight = WEIGHT_LINE.exec(row)?.groups;
    if (weight && last) {
      last.quantity = toNumber(weight["weight"] ?? "0");
      last.unit = (weight["u"] ?? "kg").toLowerCase() === "g" ? "g" : "kg";
      last.unit_price = toNumber(weight["unit"] ?? "0");
      continue;
    }
    const count = COUNT_LINE.exec(row)?.groups;
    if (count && last) {
      last.quantity = Number(count["count"]);
      last.unit_price = toNumber(count["unit"] ?? "0");
      continue;
    }

    const withCount = ITEM_WITH_COUNT.exec(row)?.groups;
    const plain = withCount ? undefined : ITEM.exec(row)?.groups;
    const g = withCount ?? plain;
    if (!g) continue;

    const name = (g["name"] ?? "").trim();
    const total = toNumber(g["total"] ?? "0");
    if (!/[a-zäöüß]{2}/i.test(name) || NOT_PRODUCT.test(name) || total < 0) continue;
    out.push({
      lineNo: i,
      raw_text: name,
      quantity: withCount ? Number(g["count"]) : 1,
      unit: null,
      unit_price: withCount ? toNumber(g["unit"] ?? "0") : null,
      total_price: total,
    });
  }
  return out;
}

const STORES: readonly (readonly [id: string, pattern: RegExp])[] = [
  ["rewe", /\brewe\b/i],
  ["edeka", /\bedeka\b/i],
  ["lidl", /\blidl\b/i],
  ["aldi", /\baldi\b/i],
  ["kaufland", /\bkaufland\b/i],
  ["netto", /\bnetto\b/i],
  ["penny", /\bpenny\b/i],
  ["dm", /\bdm[- ]drogerie|\bdm-markt\b/i],
  ["rossmann", /\brossmann\b/i],
  ["norma", /\bnorma\b/i],
  ["denns", /\bdenn'?s\b/i],
  ["alnatura", /\balnatura\b/i],
];

/** Store id from the receipt header (its first lines), or null when none is recognized. */
export function detectStore(text: string): string | null {
  const header = text.split(/\r?\n/).slice(0, 15).join("\n");
  return STORES.find(([, re]) => re.test(header))?.[0] ?? null;
}

/**
 * Parsers written for one store's layout, keyed by the id from `detectStore`. Empty until sample receipts
 * exist (see MANUAL_STEPS.md); every store without one uses the generic parser.
 */
export const STORE_PARSERS = new Map<string, ReceiptParser>();

export function parseReceipt(text: string): { store: string | null; lines: ParsedLine[] } {
  const store = detectStore(text);
  const parser = (store && STORE_PARSERS.get(store)) || { parse: parseGenericReceipt };
  return { store, lines: parser.parse(text) };
}
