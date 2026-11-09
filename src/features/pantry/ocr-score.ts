import { levenshtein, similarity } from "./match";
import { normalizeReceiptText } from "./normalize";
import { parseGenericReceipt } from "./receipt";

export type LineScore = {
  expected: string;
  /** The best unused OCR line, or null when nothing was left. */
  got: string | null;
  similarity: number;
  status: "exact" | "close" | "missed";
};

export type EvalResult = {
  lines: LineScore[];
  /** OCR lines that matched no expected line. */
  extra: string[];
  exact: number;
  close: number;
  missed: number;
  /** Share of expected lines read exactly, ignoring case and spacing. */
  exactRate: number;
  /** Share read exactly or nearly (similarity of at least `CLOSE`). */
  closeRate: number;
  /** Character error rate over the expected lines: edits needed divided by expected characters. */
  cer: number;
  /** Product names (without prices) the parser finds in the expected text versus in the OCR text. */
  products: { expected: number; found: number };
};

/** Similarity from which a line counts as read, with small slips. */
export const CLOSE = 0.85;

const tidy = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/** Scores OCR output against hand-written expected lines. Each OCR line is used for at most one expected line. */
export function scoreLines(expected: readonly string[], got: readonly string[]): EvalResult {
  const free = new Set(got.map((_, i) => i));
  const lines: LineScore[] = [];
  let edits = 0;
  let chars = 0;

  for (const exp of expected) {
    const e = tidy(exp);
    let best = -1;
    let bestSim = -1;
    for (const i of free) {
      const sim = similarity(e, tidy(got[i] ?? ""));
      if (sim > bestSim) {
        bestSim = sim;
        best = i;
      }
    }
    const matched = best >= 0 && bestSim >= CLOSE;
    if (matched) free.delete(best);
    const gotLine = best >= 0 ? (got[best] ?? null) : null;
    lines.push({
      expected: exp,
      got: matched ? gotLine : null,
      similarity: Math.max(0, bestSim),
      status: !matched ? "missed" : bestSim === 1 ? "exact" : "close",
    });
    edits += matched ? levenshtein(e, tidy(gotLine ?? "")) : e.length;
    chars += e.length;
  }

  const exact = lines.filter((l) => l.status === "exact").length;
  const close = lines.filter((l) => l.status === "close").length;
  const total = expected.length || 1;
  return {
    lines,
    extra: [...free].map((i) => got[i] ?? ""),
    exact,
    close,
    missed: lines.length - exact - close,
    exactRate: exact / total,
    closeRate: (exact + close) / total,
    cer: chars ? edits / chars : 0,
    products: scoreProducts(expected, got),
  };
}

function scoreProducts(expected: readonly string[], got: readonly string[]) {
  const names = (lines: readonly string[]) =>
    parseGenericReceipt(lines.join("\n")).map((l) => normalizeReceiptText(l.raw_text));
  const want = names(expected);
  const have = new Set(names(got));
  return { expected: want.length, found: want.filter((n) => have.has(n)).length };
}
