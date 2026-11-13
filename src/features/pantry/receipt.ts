import { tidyAmount } from "./amounts";
import { guessCategory } from "./categories";
import { kauflandParser } from "./kaufland";
import type { Unit } from "./model";
import data from "./receipt-data.json";

/** One purchased line of a receipt, as read from its text. */
export type ParsedLine = {
  /** Index of the first source line, so OCR confidence can be attached to it. */
  lineNo: number;
  /** The product text as printed (own-brand prefix kept), without prices, weights or "kg"/"St" markers. */
  raw_text: string;
  /** `raw_text` without the store's own-brand prefix and without a size; what the dictionary is asked second. */
  text?: string;
  /** How many were bought, or the amount when `unit` is set. */
  quantity: number;
  /** Set when the receipt gives a weight, a size ("500g") or pieces ("St"). The amount is then complete as it is. */
  unit: Unit | null;
  unit_price: number | null;
  /** Price after a discount line that follows the product has been taken off. */
  total_price: number | null;
  /** Tax letter after the price: A is usually non-food or drinks, B usually food. A hint, never a rule. */
  tax?: string | null;
  /** Negative amount of a discount line that belonged to this product. */
  discount?: number | null;
  /** A category the keywords suggest, or null. */
  guess?: string | null;
};

export type IgnoredReason = "deposit" | "discount" | "bag" | "total" | "tax" | "payment" | "loyalty";

/** A line that is not a product. `restore` is what it would be as a product, for the "Restore" button. */
export type IgnoredLine = {
  lineNo: number;
  text: string;
  reason: IgnoredReason;
  total_price: number | null;
  restore: ParsedLine | null;
};

export type ParseResult = { lines: ParsedLine[]; ignored: IgnoredLine[] };

export type ReceiptParser = {
  /** Reads the purchased lines out of the receipt text, and the lines that were left out. */
  parse(text: string): ParseResult;
};

export type StoreData = {
  prefixes: readonly string[];
  ignore: readonly { text: string; reason: IgnoredReason }[];
};

export type ParseOptions = { prefixes?: readonly string[]; ignore?: StoreData["ignore"] };

const NUM = String.raw`\d{1,5}[.,]\d{2}`;
const TAX = String.raw`(?:\s*(?<tax>[A-D*]))?`;
const CUR = String.raw`(?:\s*(?:EUR|€))?`;
const toNumber = (s: string) => Number(s.replace(",", "."));
const round2 = (n: number) => Math.round(n * 100) / 100;

// "BANANEN 1,89 A"  /  "BUTTER 2,19 EUR B"  /  "PFAND -0,25"
const ITEM = new RegExp(String.raw`^(?<name>.*\S)\s+(?<total>-?${NUM})${CUR}${TAX}$`, "i");
// "TOMATEN 3 x 1,29 3,87 B"  (name, count, unit price, total on one line)
const ITEM_WITH_COUNT = new RegExp(
  String.raw`^(?<name>.*\S)\s+(?<count>\d{1,3})\s*(?:Stk\.?|St\.?)?\s*[x*]\s*(?<unit>${NUM})\s+(?<total>-?${NUM})${CUR}${TAX}$`,
  "i",
);
// A line that only says how much: "0,532 kg x 2,99 EUR/kg", "0,554 kg  0,71 B", "3 x 0,49", "4 * 0,02  0,08 A".
const DETAIL_WEIGHT_X = new RegExp(
  String.raw`^(?<w>\d{1,3}[.,]\d{1,3})\s*(?<u>kg|g)\s*[x*]\s*(?<unit>${NUM})${CUR}\s*(?:/\s*(?:kg|g))?(?:\s+(?<total>-?${NUM}))?${TAX}$`,
  "i",
);
const DETAIL_WEIGHT = new RegExp(String.raw`^(?<w>\d{1,3}[.,]\d{1,3})\s*(?<u>kg|g)\s+(?<total>-?${NUM})${CUR}${TAX}$`, "i");
const DETAIL_COUNT = new RegExp(
  String.raw`^(?<n>\d{1,3})\s*(?:Stk\.?|St\.?)?\s*[x*]\s*(?<unit>${NUM})${CUR}(?:\s+(?<total>-?${NUM}))?${TAX}$`,
  "i",
);
// "Nektarinen kg 0,406 kg" / "Äpfel Waage kg 0,480 kg": the weight sits behind a unit marker (or has three decimals).
const SAME_LINE_WEIGHT = /^(?<n>.+?)\s+(?:(?:waage|kg)\s+)+(?<w>\d{1,3}[.,]\d{1,3})\s*(?<u>kg|g)$/i;
const SAME_LINE_WEIGHT_3 = /^(?<n>.+?)\s+(?<w>\d{1,3}[.,]\d{3})\s*(?<u>kg|g)$/i;
const TRAILING_MARKER = /\s+(?:(?:kg|waage|st\.?|stk\.?)(?=\s|$)\s*)+$/i;
const PIECES_MARKER = /\s(?:st\.?|stk\.?)$/i;
// Sizes inside a name: "2,5Kg", "500g", "1L", "10er"
const SIZE = /(?<![\d,.])(?<n>\d{1,4}(?:[.,]\d{1,3})?)\s?(?<u>kg|g|ml|cl|ltr|l)(?![A-Za-zÄÖÜäöü0-9])/i;
const PACK_OF = /(?<![\d,.])(?<n>\d{1,3})\s?er(?![A-Za-zÄÖÜäöü0-9])/i;

type Rule = readonly [reason: IgnoredReason, pattern: RegExp];
// First match wins, so "Pfandrückgabe" is a deposit even when its amount is negative.
const IGNORE_RULES: readonly Rule[] = [
  ["deposit", /^(?:pfand|leergut|einweg\b|mehrweg\b|r[üu]ckgabe)/i],
  ["discount", /^(?:artikelrabatt|rabatt|coupon|gutschein|preisvorteil|ersparnis|aktionsrabatt|sofortrabatt)/i],
  ["bag", /^\d+\s*cent\b.*beutel$|\b(?:ou?g|knoten|trage|plastik|papier)\s*beutel$|^beutel$|^t[üu]te\b|^trage(?:tasche|t[üu]te|tuete)/i],
  ["tax", /^(?:mwst|mehrwertsteuer|ust|steuer|netto|brutto)\b|^[A-D]\s*=?\s*\d{1,2}[.,]?\d*\s*%/i],
  [
    "payment",
    /^(?:bar|ec[ -]?karte|girocard|karte|kartenzahlung|visa|mastercard|maestro|r[üu]ckgeld|gegeben|kreditkarte|kontaktlos|terminal|ta[- ]?nr|trace|beleg|bnr|genehmigt|zahlung|emv|aid|kartennr|kartenfolge|vu[- ]?nr|ter[- ]?id|h[äa]ndlerbeleg|zahlart)\b/i,
  ],
  ["loyalty", /^(?:payback|bonus|treue|kundenkarte|\w+ ?card\b)|\bpunkte\b|\bpoints\b/i],
];
const END = /^(summe|total|gesamt|zu zahlen|zahlbetrag|betrag)\b/i;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");

/** Removes a store's own-brand prefix ("K.H-Milch" becomes "Milch"). Prefixes ending in a letter must end the word. */
export function stripPrefix(name: string, prefixes: readonly string[]): string {
  const sorted = [...prefixes].sort((a, b) => b.length - a.length);
  for (const p of sorted) {
    const endsInLetter = /[A-Za-zÄÖÜäöü]$/.test(p);
    const re = new RegExp(`^${escapeRe(p)}${endsInLetter ? "(?![A-Za-zÄÖÜäöü])" : ""}\\s*`, "i");
    const rest = name.replace(re, "");
    if (rest !== name && rest.trim()) return rest.trim();
  }
  return name;
}

type Detail = { quantity: number; unit: Unit | null; unit_price: number | null; total: number | null; tax: string | null };

const toUnit = (u: string): Unit => (u.toLowerCase() === "g" ? "g" : "kg");

/** A line that only gives weight or count (and maybe a price), or null. */
function readDetail(row: string): Detail | null {
  const wx = DETAIL_WEIGHT_X.exec(row)?.groups;
  if (wx) {
    const t = tidyAmount(toNumber(wx["w"] ?? "0"), toUnit(wx["u"] ?? "kg"));
    return {
      quantity: t.quantity,
      unit: t.unit,
      unit_price: toNumber(wx["unit"] ?? "0"),
      total: wx["total"] ? toNumber(wx["total"]) : null,
      tax: wx["tax"] ?? null,
    };
  }
  const w = DETAIL_WEIGHT.exec(row)?.groups;
  if (w) {
    const t = tidyAmount(toNumber(w["w"] ?? "0"), toUnit(w["u"] ?? "kg"));
    return { quantity: t.quantity, unit: t.unit, unit_price: null, total: toNumber(w["total"] ?? "0"), tax: w["tax"] ?? null };
  }
  const c = DETAIL_COUNT.exec(row)?.groups;
  if (c) {
    return {
      quantity: Number(c["n"]),
      unit: null,
      unit_price: toNumber(c["unit"] ?? "0"),
      total: c["total"] ? toNumber(c["total"]) : null,
      tax: c["tax"] ?? null,
    };
  }
  return null;
}

/** A size written inside the name ("2,5Kg", "500g", "1L", "10er"), multiplied by how many were bought. */
function readSize(name: string, count: number): { size: { quantity: number; unit: Unit } | null; text: string } {
  const m = SIZE.exec(name);
  if (m?.groups) {
    const n = toNumber(m.groups["n"] ?? "0");
    const u = (m.groups["u"] ?? "").toLowerCase();
    const base: { quantity: number; unit: Unit } =
      u === "cl" ? { quantity: n * 10, unit: "ml" } : u === "ltr" || u === "l" ? { quantity: n, unit: "l" } : { quantity: n, unit: u as Unit };
    return { size: tidyAmount(base.quantity * count, base.unit), text: name.replace(SIZE, " ").replace(/\s+/g, " ").trim() };
  }
  const p = PACK_OF.exec(name);
  if (p?.groups) {
    return { size: { quantity: Number(p.groups["n"]) * count, unit: "pieces" }, text: name.replace(PACK_OF, " ").replace(/\s+/g, " ").trim() };
  }
  return { size: null, text: name };
}

const HAS_LETTERS = /[a-zäöüß]{2}/i;

export function parseReceiptText(text: string, opts: ParseOptions = {}): ParseResult {
  const prefixes = opts.prefixes ?? [];
  const extraIgnore = (opts.ignore ?? []).map((i) => ({ ...i, key: i.text.toLowerCase() }));
  const rows = text.split(/\r?\n/).map((r) => r.replace(/\s+/g, " ").trim());
  const lines: ParsedLine[] = [];
  const ignored: IgnoredLine[] = [];
  let ended = false;
  /** The last thing emitted, so a discount or detail line knows what it belongs to. */
  let prev: { kind: "product"; line: ParsedLine } | { kind: "ignored" } | null = null;

  const reasonFor = (name: string): IgnoredReason | null => {
    const lower = name.toLowerCase();
    const extra = extraIgnore.find((i) => lower.includes(i.key));
    if (extra) return extra.reason;
    return IGNORE_RULES.find(([, re]) => re.test(name))?.[0] ?? null;
  };

  const nextRow = (from: number): { index: number; row: string } | null => {
    for (let j = from + 1; j < rows.length; j++) if (rows[j]) return { index: j, row: rows[j] ?? "" };
    return null;
  };

  /** Builds a product from a name and what is known about its amount and price. */
  function build(
    lineNo: number,
    rawName: string,
    count: number,
    unitPrice: number | null,
    total: number | null,
    tax: string | null,
    detail: Detail | null,
  ): ParsedLine {
    let name = rawName;
    let unit: Unit | null = null;
    let quantity = count;

    if (detail?.unit) {
      unit = detail.unit;
      quantity = detail.quantity;
      unitPrice = detail.unit_price ?? unitPrice;
    } else {
      const same = SAME_LINE_WEIGHT.exec(name)?.groups ?? SAME_LINE_WEIGHT_3.exec(name)?.groups;
      if (same) {
        const t = tidyAmount(toNumber(same["w"] ?? "0"), toUnit(same["u"] ?? "kg"));
        name = (same["n"] ?? name).trim();
        unit = t.unit;
        quantity = t.quantity;
      }
    }

    const piecesMarked = PIECES_MARKER.test(name);
    name = name.replace(TRAILING_MARKER, "").trim();
    if (piecesMarked && unit === null) unit = "pieces";

    const sized = readSize(stripPrefix(name, prefixes), count);
    if (unit === null && sized.size) {
      unit = sized.size.unit;
      quantity = sized.size.quantity;
    }
    const clean = sized.text || name;
    return {
      lineNo,
      raw_text: name,
      text: clean,
      quantity,
      unit,
      unit_price: unitPrice,
      total_price: total,
      tax,
      discount: null,
      guess: guessCategory(clean, tax),
    };
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? "";
    if (!row) continue;

    if (ended) {
      // After the total only payment, tax and loyalty lines are listed; nothing here is a product.
      const reason = reasonFor(row);
      if (reason && reason !== "bag") ignored.push({ lineNo: i, text: row, reason, total_price: null, restore: null });
      continue;
    }
    if (END.test(row)) {
      ended = true;
      const t = ITEM.exec(row)?.groups;
      ignored.push({ lineNo: i, text: row, reason: "total", total_price: t ? toNumber(t["total"] ?? "0") : null, restore: null });
      prev = { kind: "ignored" };
      continue;
    }

    // A detail line for the product above: "0,946 kg x 1,99 EUR/kg", "3 x 0,49".
    const detail = readDetail(row);
    if (detail) {
      if (prev?.kind === "product" && prev.line.total_price !== null) {
        const p = prev.line;
        if (detail.unit) {
          p.unit = detail.unit;
          p.quantity = detail.quantity;
        } else {
          p.quantity = p.unit === null ? detail.quantity : p.quantity * detail.quantity;
        }
        p.unit_price = detail.unit_price ?? p.unit_price;
      }
      continue; // a detail line is never a product, with or without a product above it
    }

    const withCount = ITEM_WITH_COUNT.exec(row)?.groups;
    const plain = withCount ? undefined : ITEM.exec(row)?.groups;
    const g = withCount ?? plain;

    if (g) {
      const name = (g["name"] ?? "").trim();
      const total = toNumber(g["total"] ?? "0");
      const tax = g["tax"] ?? null;
      const count = withCount ? Number(g["count"]) : 1;
      const unitPrice = withCount ? toNumber(g["unit"] ?? "0") : null;
      const reason = reasonFor(name);

      // A discount belongs to the product above it and only changes its price.
      if (total < 0 && reason !== "deposit") {
        if (prev?.kind === "product") {
          prev.line.discount = round2((prev.line.discount ?? 0) + total);
          prev.line.total_price = prev.line.total_price === null ? null : round2(prev.line.total_price + total);
        }
        ignored.push({ lineNo: i, text: name, reason: "discount", total_price: total, restore: null });
        continue;
      }
      if (!HAS_LETTERS.test(name)) continue; // a lone number or a separator
      const product = build(i, name, count, unitPrice, total, tax, null);
      if (reason) {
        ignored.push({ lineNo: i, text: name, reason, total_price: total, restore: product });
        prev = { kind: "ignored" };
        continue;
      }
      lines.push(product);
      prev = { kind: "product", line: product };
      continue;
    }

    if (!HAS_LETTERS.test(row)) continue;

    // A name with no price, when the next line gives the amount and price: "Tomaten Rispen kg" then "0,554 kg  0,71 B".
    const next = nextRow(i);
    const d = next ? readDetail(next.row) : null;
    if (next && d && d.total !== null) {
      const product = build(i, row, d.unit ? 1 : d.quantity, d.unit_price, d.total, d.tax, d.unit ? d : null);
      const reason = reasonFor(row);
      if (reason) {
        ignored.push({ lineNo: i, text: row, reason, total_price: d.total, restore: product });
        prev = { kind: "ignored" };
      } else {
        lines.push(product);
        prev = { kind: "product", line: product };
      }
      i = next.index;
      continue;
    }
    // Loyalty lines without a price are listed so the list matches the paper.
    if (reasonFor(row) === "loyalty") ignored.push({ lineNo: i, text: row, reason: "loyalty", total_price: null, restore: null });
  }
  return { lines, ignored };
}

export function parseGenericReceipt(text: string, opts: ParseOptions = {}): ParsedLine[] {
  return parseReceiptText(text, opts).lines;
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

type StoreEntry = { prefixes?: string[]; ignore?: { text: string; reason: string }[] };

/** Own-brand prefixes and ignore words for a store, from `receipt-data.json`. */
export function storeData(store: string | null): StoreData {
  const d = (data.stores as Record<string, StoreEntry>)[store ?? ""];
  return { prefixes: d?.prefixes ?? [], ignore: (d?.ignore ?? []) as StoreData["ignore"] };
}

/**
 * Parsers written for one store's layout, keyed by the id from `detectStore` (see `kaufland.ts`). Every store
 * without one uses the generic reader with that store's data, if the data file has any.
 */
export const STORE_PARSERS = new Map<string, ReceiptParser>([["kaufland", kauflandParser]]);

export function parseReceipt(text: string): { store: string | null; lines: ParsedLine[]; ignored: IgnoredLine[] } {
  const store = detectStore(text);
  const parser = (store && STORE_PARSERS.get(store)) || { parse: (t: string) => parseReceiptText(t, storeData(store)) };
  return { store, ...parser.parse(text) };
}
