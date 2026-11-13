import { describe, expect, it } from "vitest";
import { PHOTO_CHECKS } from "./photo-config";
import { assessQuality, laplacianVariance, meanBrightness } from "./photo-quality";
import { boxBlur, receiptImage, scaleBrightness } from "./test-images";

const big = { width: 1500, height: 2000 };
const sharp = receiptImage({ width: 400, height: 500 });

describe("meanBrightness / laplacianVariance", () => {
  it("average the pixels", () => {
    expect(meanBrightness({ width: 2, height: 1, data: new Uint8ClampedArray([100, 200]) })).toBe(150);
  });

  it("is zero for a flat image and high for edges", () => {
    const flat = { width: 20, height: 20, data: new Uint8ClampedArray(400).fill(100) };
    expect(laplacianVariance(flat)).toBe(0);
    expect(laplacianVariance(sharp)).toBeGreaterThan(1000);
  });

  it("drops when the image is blurred", () => {
    expect(laplacianVariance(boxBlur(sharp, 3))).toBeLessThan(laplacianVariance(sharp) / 10);
  });

  it("copes with tiny images", () => {
    expect(laplacianVariance({ width: 2, height: 2, data: new Uint8ClampedArray(4) })).toBe(0);
  });
});

describe("assessQuality", () => {
  it("passes a clear, well lit photo", () => {
    const q = assessQuality(sharp, big);
    expect(q.issue).toBeNull();
    expect(q.brightness).toBeGreaterThan(PHOTO_CHECKS.minBrightness);
    expect(q.sharpness).toBeGreaterThan(PHOTO_CHECKS.minSharpness);
  });

  it("flags a dark photo", () => {
    expect(assessQuality(scaleBrightness(sharp, 0.3), big).issue).toBe("dark");
  });

  it("flags a washed-out photo", () => {
    const glare = { ...sharp, data: sharp.data.map((v) => Math.min(255, v + 200)) };
    expect(assessQuality(glare, big).issue).toBe("bright");
  });

  it("flags a blurry photo", () => {
    expect(assessQuality(boxBlur(sharp, 4), big).issue).toBe("blurry");
  });

  it("flags a small photo, whatever the working size", () => {
    expect(assessQuality(sharp, { width: 400, height: 520 }).issue).toBe("small");
    expect(assessQuality(sharp, { width: 640, height: 800 }).issue).toBe("small"); // long side under the minimum
  });

  it("reports the first problem only, size before light", () => {
    expect(assessQuality(scaleBrightness(sharp, 0.3), { width: 300, height: 400 }).issue).toBe("small");
  });

  it("uses the limits it is given", () => {
    const strict = { ...PHOTO_CHECKS, minBrightness: 250 };
    expect(assessQuality(sharp, big, strict).issue).toBe("dark");
  });
});
