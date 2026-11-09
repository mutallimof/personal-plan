import { describe, expect, it } from "vitest";
import { estimateSkew } from "./image-geometry";
import { prepareReceipt } from "./receipt-prep";
import { receiptImage } from "./test-images";

const source = { width: 1500, height: 2000 };

describe("prepareReceipt", () => {
  const table = receiptImage({ width: 500, height: 460, paper: { x: 150, y: 40, width: 200, height: 380 }, tilt: 4 });

  it("crops to the paper and straightens the lines", () => {
    const out = prepareReceipt(table, source, { blackWhite: false });
    expect(out.steps.cropped).toBe(true);
    expect(out.steps.tilt).toBeGreaterThan(3);
    expect(out.steps.tilt).toBeLessThan(5);
    expect(out.processed.width).toBeLessThan(table.width);
    expect(Math.abs(estimateSkew(out.processed))).toBeLessThan(0.6);
  });

  it("keeps the original untouched for the comparison", () => {
    const out = prepareReceipt(table, source, { blackWhite: false });
    expect(out.original).toBe(table);
  });

  it("judges the paper, not the dark table around it", () => {
    expect(prepareReceipt(table, source, { blackWhite: false }).quality.issue).toBeNull();
  });

  it("does not crop or turn a clean, straight photo", () => {
    const clean = receiptImage({ width: 400, height: 500 });
    const out = prepareReceipt(clean, source, { blackWhite: false });
    expect(out.steps).toEqual({ cropped: false, tilt: 0 });
    expect(out.processed.width).toBe(400);
    expect(out.processed.height).toBe(500);
  });

  it("can reduce to pure black and white", () => {
    const out = prepareReceipt(table, source, { blackWhite: true });
    expect([...out.processed.data].every((v) => v === 0 || v === 255)).toBe(true);
  });

  it("reports a quality problem but still returns the images", () => {
    const out = prepareReceipt(receiptImage({ width: 400, height: 500, paperGray: 70, inkGray: 20 }), source, { blackWhite: false });
    expect(out.quality.issue).toBe("dark");
    expect(out.processed.data.length).toBeGreaterThan(0);
  });
});
