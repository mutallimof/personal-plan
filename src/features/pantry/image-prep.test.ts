import { describe, expect, it } from "vitest";
import { binarize, enhance, otsuThreshold, stretchContrast, targetSize, toGray } from "./image-prep";

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

describe("otsuThreshold / binarize", () => {
  const gray = new Uint8ClampedArray([...Array(60).fill(30), ...Array(40).fill(220)]);

  it("splits two clusters", () => {
    const t = otsuThreshold(gray);
    expect(t).toBeGreaterThanOrEqual(30);
    expect(t).toBeLessThan(220);
  });

  it("makes pure black and white", () => {
    const out = binarize(gray, otsuThreshold(gray));
    expect(new Set(out)).toEqual(new Set([0, 255]));
    expect(out.filter((v) => v === 0)).toHaveLength(60);
  });

  it("does not crash on a single-colour image", () => {
    expect(otsuThreshold(new Uint8ClampedArray(10).fill(7))).toBeGreaterThanOrEqual(0);
  });
});

describe("enhance", () => {
  const px = rgba([10, 10, 10], [10, 10, 10], [240, 240, 240], [240, 240, 240]);

  it("returns opaque grey RGBA of the same size", () => {
    const out = enhance(px, { threshold: false });
    expect(out).toHaveLength(px.length);
    for (let i = 0; i < out.length; i += 4) {
      expect(out[i]).toBe(out[i + 1]);
      expect(out[i + 1]).toBe(out[i + 2]);
      expect(out[i + 3]).toBe(255);
    }
  });

  it("can threshold to black and white", () => {
    const out = enhance(rgba([90, 90, 90], [95, 95, 95], [170, 170, 170], [175, 175, 175]), { threshold: true });
    expect(new Set([out[0], out[4], out[8], out[12]])).toEqual(new Set([0, 255]));
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
