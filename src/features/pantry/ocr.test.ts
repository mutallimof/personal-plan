import { describe, expect, it } from "vitest";
import { confidenceByLine, linesFromBlocks, ocrText } from "./ocr";
import { parseGenericReceipt } from "./receipt";
import { buildReview } from "./review";
import { alias, loc } from "./fixtures";

const block = (...lines: [string, number][]) => ({
  paragraphs: [{ lines: lines.map(([text, confidence]) => ({ text, confidence })) }],
});

describe("linesFromBlocks", () => {
  it("flattens blocks and paragraphs in order and trims", () => {
    const lines = linesFromBlocks([block(["  BUTTER  2,19 B \n", 91], ["MILCH 0,99 B", 64]), block(["SUMME 3,18", 88])]);
    expect(lines).toEqual([
      { text: "BUTTER  2,19 B", confidence: 91 },
      { text: "MILCH 0,99 B", confidence: 64 },
      { text: "SUMME 3,18", confidence: 88 },
    ]);
  });

  it("drops empty lines and copes with no blocks", () => {
    expect(linesFromBlocks([block(["   ", 10], ["A", 90])])).toEqual([{ text: "A", confidence: 90 }]);
    expect(linesFromBlocks(null)).toEqual([]);
    expect(linesFromBlocks(undefined)).toEqual([]);
  });
});

describe("OCR text and parser line numbers", () => {
  const lines = linesFromBlocks([block(["REWE Markt", 95], ["BANANEN 1,89 B", 92], ["H-MILCH 0,99 B", 55], ["SUMME 2,88", 90]) ]);

  it("joins lines so that parser line numbers index the OCR lines", () => {
    const parsed = parseGenericReceipt(ocrText(lines));
    expect(parsed.map((p) => [p.raw_text, p.lineNo])).toEqual([
      ["BANANEN", 1],
      ["H-MILCH", 2],
    ]);
    for (const p of parsed) expect(lines[p.lineNo]?.text).toContain(p.raw_text);
  });

  it("carries the confidence of each source line into the review", () => {
    const parsed = parseGenericReceipt(ocrText(lines));
    const review = buildReview(
      parsed,
      [alias("H MILCH", "Milk")],
      null,
      [loc({ kind: "shelf" })],
      confidenceByLine(lines),
    );
    const byName = Object.fromEntries(review.map((r) => [r.rawText, r]));
    expect(byName["BANANEN"]?.confidence).toBe(92);
    expect(byName["H-MILCH"]).toMatchObject({ confidence: 55, confirmed: false });
  });
});
