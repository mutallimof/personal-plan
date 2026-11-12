// Invented grey test images for the photo helper tests (no real receipts anywhere in the repo).
import type { GrayImage } from "./image-geometry";

type Spec = {
  width: number;
  height: number;
  /** Grey of the table/background around the paper. */
  background?: number;
  /** The paper rectangle (before tilting), default: the whole image. */
  paper?: { x: number; y: number; width: number; height: number };
  paperGray?: number;
  inkGray?: number;
  /** Degrees, positive = clockwise. */
  tilt?: number;
  /** Blur radius in pixels (box blur). */
  blur?: number;
};

/** Lines of "text": short dark dashes with gaps, 6 px tall every 16 px, inside the paper. */
export function receiptImage(spec: Spec): GrayImage {
  const { width, height, background = 40, paperGray = 225, inkGray = 35, tilt = 0, blur = 0 } = spec;
  const paper = spec.paper ?? { x: 0, y: 0, width, height };
  const rad = (tilt * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const cx = width / 2;
  const cy = height / 2;
  const data = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Where this pixel lies on the upright (untilted) page.
      const dx = x - cx;
      const dy = y - cy;
      const u = cx + dx * cos + dy * sin;
      const v = cy - dx * sin + dy * cos;
      const onPaper = u >= paper.x && u < paper.x + paper.width && v >= paper.y && v < paper.y + paper.height;
      let value = onPaper ? paperGray : background;
      if (onPaper) {
        const margin = 14;
        const inText = u > paper.x + margin && u < paper.x + paper.width - margin && v > paper.y + margin && v < paper.y + paper.height - margin;
        if (inText && (v - paper.y) % 16 < 6 && (u - paper.x) % 9 < 6) value = inkGray;
      }
      data[y * width + x] = value;
    }
  }
  return blur ? boxBlur({ width, height, data }, blur) : { width, height, data };
}

export function boxBlur(img: GrayImage, radius: number): GrayImage {
  const out = new Uint8ClampedArray(img.data.length);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      let sum = 0;
      let n = 0;
      for (let yy = Math.max(0, y - radius); yy <= Math.min(img.height - 1, y + radius); yy++) {
        for (let xx = Math.max(0, x - radius); xx <= Math.min(img.width - 1, x + radius); xx++) {
          sum += img.data[yy * img.width + xx] ?? 0;
          n++;
        }
      }
      out[y * img.width + x] = sum / n;
    }
  }
  return { width: img.width, height: img.height, data: out };
}

export const scaleBrightness = (img: GrayImage, factor: number): GrayImage => ({ ...img, data: img.data.map((v) => v * factor) });
