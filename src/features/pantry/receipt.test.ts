import { afterEach, describe, expect, it } from "vitest";
import { SYNTHETIC_RECEIPT } from "./fixtures";
import { detectStore, parseGenericReceipt, parseReceipt, STORE_PARSERS } from "./receipt";

describe("parseGenericReceipt", () => {
  const lines = parseGenericReceipt(SYNTHETIC_RECEIPT);

  it("finds the purchased lines and nothing else", () => {
    expect(lines.map((l) => l.raw_text)).toEqual([
      "H-MILCH 1,5% 1L",
      "BIO EIER M 10ER",
      "BANANEN",
      "JOGHURT NATUR",
      "SPAGHETTI 500G",
      "TOMATEN",
    ]);
  });

  it("reads plain prices", () => {
    // The size in the name ("1L") is read into the amount.
    expect(lines[0]).toMatchObject({ quantity: 1, unit: "l", unit_price: null, total_price: 0.99 });
  });

  it("reads a weight line under the item", () => {
    expect(lines[2]).toMatchObject({ raw_text: "BANANEN", quantity: 946, unit: "g", unit_price: 1.99, total_price: 1.89 });
  });

  it("reads a count line under the item", () => {
    expect(lines[3]).toMatchObject({ quantity: 3, unit: null, unit_price: 0.49, total_price: 1.47 });
  });

  it("reads a count and unit price on the item line", () => {
    expect(lines[5]).toMatchObject({ raw_text: "TOMATEN", quantity: 3, unit_price: 1.29, total_price: 3.87 });
  });

  it("stops at the total, so payment and tax lines are never products", () => {
    expect(lines.some((l) => /BAR|RUECKGELD|MWST|GURKE/.test(l.raw_text))).toBe(false);
  });

  it("skips deposits, discounts and header lines", () => {
    expect(lines.some((l) => /PFAND|RABATT|REWE|Tel|Datum/i.test(l.raw_text))).toBe(false);
  });

  it("records the source line number", () => {
    const rows = SYNTHETIC_RECEIPT.split("\n");
    for (const l of lines) expect(rows[l.lineNo]).toContain(l.raw_text);
  });

  it("handles Windows line endings and extra spaces", () => {
    const crlf = "BUTTER      2,19 B\r\n  KAESE   GOUDA    3,99 A\r\nSUMME 6,18\r\n";
    expect(parseGenericReceipt(crlf).map((l) => l.raw_text)).toEqual(["BUTTER", "KAESE GOUDA"]);
  });

  it("accepts a dot as the decimal mark and a trailing EUR", () => {
    expect(parseGenericReceipt("BUTTER 2.19 EUR B")[0]).toMatchObject({ raw_text: "BUTTER", total_price: 2.19 });
  });

  it("returns nothing for text without prices", () => {
    expect(parseGenericReceipt("")).toEqual([]);
    expect(parseGenericReceipt("Hello\nWorld")).toEqual([]);
  });

  it("ignores a count line that has no item before it", () => {
    expect(parseGenericReceipt("  2 x 0,99\nBUTTER 2,19 B")).toHaveLength(1);
  });
});

describe("detectStore", () => {
  it("finds a store in the header", () => {
    expect(detectStore(SYNTHETIC_RECEIPT)).toBe("rewe");
    expect(detectStore("dm-drogerie markt GmbH\nBeispiel")).toBe("dm");
    expect(detectStore("Willkommen bei Lidl\n")).toBe("lidl");
  });

  it("returns null for an unknown store", () => {
    expect(detectStore("Bäckerei Muster\nBROT 2,50 B")).toBeNull();
  });

  it("only looks at the header, not product lines", () => {
    const body = Array.from({ length: 20 }, () => "X").join("\n");
    expect(detectStore(`${body}\nALDI Sued`)).toBeNull();
  });

  it("does not match inside other words", () => {
    expect(detectStore("Nettoware Handel\n")).toBeNull();
  });
});

describe("parseReceipt", () => {
  afterEach(() => STORE_PARSERS.clear());

  it("uses the generic parser when the store has no parser", () => {
    const { store, lines } = parseReceipt(SYNTHETIC_RECEIPT);
    expect(store).toBe("rewe");
    expect(lines).toHaveLength(6);
  });

  it("uses a store parser when one is registered", () => {
    STORE_PARSERS.set("rewe", {
      parse: () => ({ lines: [{ lineNo: 0, raw_text: "ONLY", quantity: 1, unit: null, unit_price: null, total_price: 1 }], ignored: [] }),
    });
    expect(parseReceipt(SYNTHETIC_RECEIPT).lines.map((l) => l.raw_text)).toEqual(["ONLY"]);
    expect(parseReceipt("BUTTER 2,19 B").lines).toHaveLength(1);
  });
});
