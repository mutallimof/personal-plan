import { describe, expect, it } from "vitest";
import { scoreLines } from "./ocr-score";

describe("scoreLines", () => {
  const expected = ["H-MILCH 1,5% 1L  0,99 B", "BANANEN  1,89 B", "SPAGHETTI 500G  1,29 B"];

  it("scores a perfect read", () => {
    const r = scoreLines(expected, [...expected]);
    expect(r).toMatchObject({ exact: 3, close: 0, missed: 0, exactRate: 1, closeRate: 1, cer: 0, extra: [] });
    expect(r.products).toEqual({ expected: 3, found: 3 });
  });

  it("ignores case and spacing when comparing", () => {
    const r = scoreLines(["BANANEN 1,89 B"], ["bananen   1,89  b"]);
    expect(r.exact).toBe(1);
  });

  it("counts a small slip as close, with a character error rate", () => {
    const r = scoreLines(["BANANEN 1,89 B"], ["BANANEN 1,69 B"]);
    expect(r).toMatchObject({ exact: 0, close: 1, missed: 0, closeRate: 1 });
    expect(r.cer).toBeCloseTo(1 / 14);
  });

  it("counts an unreadable or absent line as missed, costing all its characters", () => {
    const r = scoreLines(["BANANEN 1,89 B"], ["#@!~ ^^"]);
    expect(r).toMatchObject({ exact: 0, close: 0, missed: 1, cer: 1 });
    expect(r.lines[0]?.got).toBeNull();
    expect(r.extra).toEqual(["#@!~ ^^"]);
  });

  it("uses each OCR line once", () => {
    const r = scoreLines(["BUTTER 2,19 B", "BUTTER 2,19 B"], ["BUTTER 2,19 B"]);
    expect(r).toMatchObject({ exact: 1, missed: 1 });
  });

  it("reports OCR lines nobody asked for", () => {
    const r = scoreLines(["BUTTER 2,19 B"], ["BUTTER 2,19 B", "GARBAGE"]);
    expect(r.extra).toEqual(["GARBAGE"]);
  });

  it("matches lines whatever their order", () => {
    const r = scoreLines(["A LONGER NAME 1,00 B", "ZEBRA 2,00 B"], ["ZEBRA 2,00 B", "A LONGER NAME 1,00 B"]);
    expect(r.exact).toBe(2);
  });

  it("finds products even when the price is misread", () => {
    const r = scoreLines(["BANANEN 1,89 B", "SUMME 1,89"], ["BANANEN 1,B9 B"]);
    expect(r.products).toEqual({ expected: 1, found: 0 });
    const ok = scoreLines(["BANANEN 1,89 B", "SUMME 1,89"], ["BANANEN 1,69 B", "SUMME 1,69"]);
    expect(ok.products).toEqual({ expected: 1, found: 1 });
  });

  it("copes with nothing expected", () => {
    const r = scoreLines([], ["x"]);
    expect(r).toMatchObject({ exactRate: 0, closeRate: 0, cer: 0, extra: ["x"] });
  });
});
