import { describe, expect, it } from "vitest";
import { adaptiveThreshold, grayToRgba, otsuThreshold, stretchContrast, targetSize, toGray } from "./image-prep";

const rgba = (...px: [number, number, number][]) => new Uint8ClampedArray(px.flatMap(([r, g, b]) => [r, g, b, 255]));

describe("toGray", () => {
  it("uses luma weights", () => {
    expect([...toGray(rgba([255, 255, 255], [0, 0, 0], [255, 0, 0], [0, 255, 0], [0, 0, 255]))]).toEqual([255, 0, 76, 150, 29]);
  });

  it("returns one value per pixel", () => {
    expect(toGray(new Uint8ClampedArray(40))).toHaveLength(10);
  });
});

describe("stretchContrast", () => {
  it("spreads a washed-out range over 0..255", () => {
    // Half the pixels at 100, half at 160: grey paper and grey ink.
    const gray = new Uint8ClampedArray([...Array(50).fill(100), ...Array(50).fill(160)]);
    const out = stretchContrast(gray);
    expect(Math.min(...out)).toBe(0);
    expect(Math.max(...out)).toBe(255);
  });

  it("leaves a flat image alone", () => {
    const flat = new Uint8ClampedArray(100).fill(128);
    expect([...stretchContrast(flat)]).toEqual([...flat]);
  });

  it("keeps the order of grey levels", () => {
    const out = stretchContrast(new Uint8ClampedArray([...Array(40).fill(50), ...Array(20).fill(100), ...Array(40).fill(200)]));
    expect(out[0]).toBeLessThan(out[40] ?? 0);
    expect(out[40]).toBeLessThan(out[60] ?? 0);
  });
});

describe("otsuThreshold", () => {
  const gray = new Uint8ClampedArray([...Array(60).fill(30), ...Array(40).fill(220)]);

  it("splits two clusters", () => {
    const t = otsuThreshold(gray);
    expect(t).toBeGreaterThanOrEqual(30);
    expect(t).toBeLessThan(220);
  });

  it("does not crash on a single-colour image", () => {
    expect(otsuThreshold(new Uint8ClampedArray(10).fill(7))).toBeGreaterThanOrEqual(0);
  });
});

describe("adaptiveThreshold", () => {
  /** Paper that gets darker from left to right (a shadow), with one dark ink pixel on it. */
  function shadowed(inkX: number) {
    const w = 60;
    const h = 20;
    const g = new Uint8ClampedArray(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y * w + x] = 230 - x * 0.5;
    g[10 * w + inkX] = 20;
    return { g, w, h };
  }

  it("keeps ink black and paper white, in the light and in the shadow", () => {
    for (const inkX of [8, 50]) {
      const { g, w, h } = shadowed(inkX);
      const out = adaptiveThreshold(g, w, h);
      expect(out[10 * w + inkX]).toBe(0);
      expect(out[5 * w + inkX]).toBe(255);
      expect(out[2 * w + 30]).toBe(255);
    }
  });

  it("a single global cut would lose the shadowed paper, the local one does not", () => {
    const { g, w, h } = shadowed(8);
    const out = adaptiveThreshold(g, w, h);
    expect(out.filter((v) => v === 0)).toHaveLength(1);
  });

  it("returns only black and white", () => {
    const out = adaptiveThreshold(new Uint8ClampedArray([10, 200, 90, 250, 30, 220, 60, 255, 100]), 3, 3, 3, 5);
    expect(new Set(out).size).toBeLessThanOrEqual(2);
    expect([...out].every((v) => v === 0 || v === 255)).toBe(true);
  });
});

describe("grayToRgba", () => {
  it("makes opaque grey pixels", () => {
    expect([...grayToRgba(new Uint8ClampedArray([0, 128]))]).toEqual([0, 0, 0, 255, 128, 128, 128, 255]);
  });
});

describe("targetSize", () => {
  it("keeps a reasonable size as is", () => {
    expect(targetSize(1500, 2000)).toEqual({ width: 1500, height: 2000 });
  });

  it("shrinks very large photos", () => {
    expect(targetSize(4000, 8000)).toEqual({ width: 1600, height: 3200 });
  });

  it("enlarges small ones, but not more than three times", () => {
    expect(targetSize(600, 900)).toEqual({ width: 1200, height: 1800 });
    expect(targetSize(200, 300)).toEqual({ width: 600, height: 900 });
  });

  it("never returns zero", () => {
    expect(targetSize(1, 1).width).toBeGreaterThan(0);
  });
});
