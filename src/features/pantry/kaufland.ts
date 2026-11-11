import { parseReceiptText, storeData, type ReceiptParser } from "./receipt";

/**
 * Kaufland receipts: own-brand prefixes (K., K.H-, KLC., KBB, KPur.H.) in front of names, two-line items
 * (name, then weight or "n * price" with the amount), deposit, bag and discount lines. The layout is read by
 * the shared reader; this parser hands it Kaufland's prefixes and ignore words from `receipt-data.json`.
 * Registered in `STORE_PARSERS` (receipt.ts). Nothing here runs at import time, so the import cycle is safe.
 */
export const kauflandParser: ReceiptParser = {
  parse: (text) => parseReceiptText(text, storeData("kaufland")),
};
