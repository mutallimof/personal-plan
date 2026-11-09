import { describe, expect, it } from "vitest";
import { cropGray, estimateSkew, findPaper, fitWithin, resizeGray, rotateGray, type GrayImage } from "./image-geometry";
import { receiptImage } from "./test-images";

const px = (img: GrayImage, x: number, y: number) => img.data[y * img.width + x];
const gradient = (w: number, h: number): GrayImage => ({
  width: w,
  height: h,
  data: Uint8ClampedArray.from({ length: w * h }, (_, i) => ((i % w) * 255) / (w - 1)),
});

describe("resizeGray", () => {
  it("averages when shrinking", () => {
    const img: GrayImage = { width: 2, height: 2, data: new Uint8ClampedArray([0, 100, 100, 200]) };
    expect([...resizeGray(img, 1, 1).data]).toEqual([100]);
  });

  it("interpolates when growing", () => {
    const img: GrayImage = { width: 2, height: 1, data: new Uint8ClampedArray([0, 200]) };
    const out = resizeGray(img, 4, 1);
    expect(out.width).toBe(4);
    expect(out.data[0]).toBe(0);
    expect(out.data[3]).toBe(200);
    expect(out.data[1]).toBeGreaterThan(0);
    expect(out.data[2]).toBeLessThan(200);
  });

  it("returns the same image for the same size", () => {
    const img = gradient(4, 4);
    expect(resizeGray(img, 4, 4)).toBe(img);
  });
});

describe("fitWithin", () => {
  it("shrinks the longer side to the limit and keeps proportions", () => {
    const out = fitWithin(gradient(400, 200), 100);
    expect([out.width, out.height]).toEqual([100, 50]);
  });

  it("leaves small images alone", () => {
    const img = gradient(50, 20);
    expect(fitWithin(img, 100)).toBe(img);
  });
});

describe("cropGray", () => {
  it("cuts out a rectangle", () => {
    const out = cropGray(gradient(10, 4), { x: 2, y: 1, width: 3, height: 2 });
    expect([out.width, out.height]).toEqual([3, 2]);
    expect(px(out, 0, 0)).toBe(px(gradient(10, 4), 2, 1));
  });
});

describe("findPaper", () => {
  const paper = { x: 150, y: 40, width: 200, height: 380 };

  it("finds a receipt lying on a dark table", () => {
    const rect = findPaper(receiptImage({ width: 500, height: 460, paper }));
    expect(rect).not.toBeNull();
    const r = rect as NonNullable<typeof rect>;
    // Contains the paper, with only a small margin around it.
    expect(r.x).toBeLessThanOrEqual(paper.x);
    expect(r.y).toBeLessThanOrEqual(paper.y);
    expect(r.x + r.width).toBeGreaterThanOrEqual(paper.x + paper.width);
    expect(r.y + r.height).toBeGreaterThanOrEqual(paper.y + paper.height);
    expect(r.width).toBeLessThan(paper.width + 70);
    expect(r.height).toBeLessThan(paper.height + 70);
  });

  it("does nothing when the paper already fills the photo", () => {
    expect(findPaper(receiptImage({ width: 400, height: 500 }))).toBeNull();
  });

  it("does nothing on a flat image", () => {
    expect(findPaper({ width: 100, height: 100, data: new Uint8ClampedArray(10000).fill(120) })).toBeNull();
  });

  it("ignores specks that are too small to be a receipt", () => {
    const rect = findPaper(receiptImage({ width: 500, height: 460, paper: { x: 10, y: 10, width: 20, height: 20 } }));
    expect(rect).toBeNull();
  });
});

describe("estimateSkew", () => {
  it("finds no tilt in straight lines", () => {
    expect(estimateSkew(receiptImage({ width: 400, height: 500 }))).toBe(0);
  });

  it.each([3, -4.5, 8])("measures a tilt of %s degrees", (tilt) => {
    const angle = estimateSkew(receiptImage({ width: 400, height: 500, tilt, background: 225 }));
    expect(angle).toBeGreaterThan(tilt - 0.8);
    expect(angle).toBeLessThan(tilt + 0.8);
  });

  it("is not thrown off by a dark table around tilted paper", () => {
    const angle = estimateSkew(receiptImage({ width: 500, height: 460, paper: { x: 100, y: 30, width: 300, height: 400 }, tilt: 6 }));
    expect(angle).toBeGreaterThan(5.2);
    expect(angle).toBeLessThan(6.8);
  });

  it("returns 0 for an empty page", () => {
    expect(estimateSkew({ width: 200, height: 200, data: new Uint8ClampedArray(40000).fill(230) })).toBe(0);
  });
});

describe("rotateGray", () => {
  it("moves a pixel clockwise by a quarter turn", () => {
    const img: GrayImage = { width: 5, height: 5, data: new Uint8ClampedArray(25).fill(255) };
    img.data[2 * 5 + 4] = 0; // right of centre
    const out = rotateGray(img, 90);
    expect(px(out, 2, 4)).toBe(0); // now below centre
    expect(px(out, 4, 2)).toBe(255);
  });

  it("fills the gaps", () => {
    const out = rotateGray({ width: 20, height: 20, data: new Uint8ClampedArray(400).fill(0) }, 30, 200);
    expect(px(out, 0, 0)).toBe(200);
  });

  it("straightens what estimateSkew measured", () => {
    const tilted = receiptImage({ width: 400, height: 500, tilt: 5, background: 225 });
    const fixed = rotateGray(tilted, -estimateSkew(tilted));
    expect(Math.abs(estimateSkew(fixed))).toBeLessThan(0.5);
  });

  it("returns the same image for no turn", () => {
    const img = gradient(4, 4);
    expect(rotateGray(img, 0)).toBe(img);
  });
});
