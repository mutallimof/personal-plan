import { fitWithin, type GrayImage } from "./image-geometry";
import { PHOTO_CHECKS, SHARPNESS_SIDE, type PhotoLimits } from "./photo-config";

export type PhotoIssue = "dark" | "bright" | "blurry" | "small";

export const ISSUE_MESSAGE: Record<PhotoIssue, string> = {
  dark: "Too dark, try more light",
  bright: "Too bright, avoid glare",
  blurry: "Too blurry, hold still and retake",
  small: "Too small, move closer",
};

export type PhotoQuality = {
  /** The first problem found, or null when the photo looks fine. */
  issue: PhotoIssue | null;
  brightness: number;
  sharpness: number;
};

/** Mean grey level, 0 (black) to 255 (white). */
export function meanBrightness(gray: GrayImage): number {
  let sum = 0;
  for (const v of gray.data) sum += v;
  return gray.data.length ? sum / gray.data.length : 0;
}

/** Variance of the Laplacian: the stronger and more frequent the edges, the higher. Blur flattens edges. */
export function laplacianVariance(gray: GrayImage): number {
  const { width: w, height: h, data } = gray;
  if (w < 3 || h < 3) return 0;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = (data[i - w] ?? 0) + (data[i + w] ?? 0) + (data[i - 1] ?? 0) + (data[i + 1] ?? 0) - 4 * (data[i] ?? 0);
      sum += v;
      sumSq += v * v;
      n++;
    }
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

/**
 * Checks a photo before OCR. `receipt` is the paper area (so a dark table does not count as "too dark");
 * `source` is the size of the photo as it came from the camera.
 */
export function assessQuality(receipt: GrayImage, source: { width: number; height: number }, limits: PhotoLimits = PHOTO_CHECKS): PhotoQuality {
  const brightness = meanBrightness(receipt);
  const sharpness = laplacianVariance(fitWithin(receipt, SHARPNESS_SIDE));
  let issue: PhotoIssue | null = null;
  if (Math.min(source.width, source.height) < limits.minShortSide || Math.max(source.width, source.height) < limits.minLongSide) issue = "small";
  else if (brightness < limits.minBrightness) issue = "dark";
  else if (brightness > limits.maxBrightness) issue = "bright";
  else if (sharpness < limits.minSharpness) issue = "blurry";
  return { issue, brightness, sharpness };
}
