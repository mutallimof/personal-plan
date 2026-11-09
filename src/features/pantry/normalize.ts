// Turns the text printed on a receipt line into a stable key for the product dictionary.
// Only things that never change what the product is are removed: prices, tax letters, weights, pack counts and
// article numbers. Fat percentages stay ("MILCH 1.5%" and "MILCH 3.5%" are different products).

const UMLAUTS: Record<string, string> = { Ä: "AE", Ö: "OE", Ü: "UE" };

// 1,99  1.99  -0,50 (never a number with a percent sign or more decimals), then an optional EUR and tax letter.
const PRICE = /(?<![\d,.])-?\d{1,5}[.,]\d{2}(?![\d%])(?:\s*(?:EUR|€))?(?:\s*[A-D*](?![A-ZÄÖÜ0-9]))?/g;
// 500G  1,5L  0.75 L  250ML  10ER  6 STK
const AMOUNT = /(?<![\d,.])\d+(?:[.,]\d+)?\s?(?:KG|G|ML|CL|L|LTR|STK|ST|ER)(?![A-ZÄÖÜ0-9])/g;
// "2 X" in front of or after a name
const TIMES = /(?<![\d,.])\d+\s*X(?![A-ZÄÖÜ0-9])/g;
// Article or EAN numbers: five or more digits in a row
const ARTICLE_NO = /(?<![\d,.])\d{5,}(?![\d,.])/g;

/** Removes prices, amounts, counts and article numbers from upper-case text and keeps only `allowed` characters. */
function strip(upper: string, allowed: RegExp): string {
  let t = upper.replace(/(\d),(\d)/g, "$1.$2");
  t = t.replace(AMOUNT, " ").replace(PRICE, " ").replace(TIMES, " ").replace(ARTICLE_NO, " ");
  t = t.replace(allowed, " ");
  // Keep a dot only between digits (1.5%); everywhere else it is punctuation.
  t = t.replace(/(?<!\d)\.|\.(?!\d)/g, " ");
  return t.replace(/\s+/g, " ").trim();
}

export function normalizeReceiptText(raw: string): string {
  return strip(
    raw.toUpperCase().replace(/[ÄÖÜ]/g, (c) => UMLAUTS[c] ?? c),
    /[^A-Z0-9%. ]/g,
  );
}

/** A readable product name from receipt text: "BIO EIER M 10ER 2,49 B" becomes "Bio Eier M". Keeps umlauts. */
export function displayName(raw: string): string {
  return strip(raw.toUpperCase(), /[^A-ZÄÖÜ0-9%. -]/g)
    .toLowerCase()
    .replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}
