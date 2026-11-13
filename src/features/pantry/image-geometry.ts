// Shape-changing steps for receipt photos: resize, find the paper, crop, measure and remove tilt.
// Plain functions over grey pixel arrays, shared by the browser and the eval script (scripts/ocr-eval).
import { adaptiveThreshold, otsuThreshold } from "./image-prep";

/** One grey value (0-255) per pixel, row by row. */
export type GrayImage = { width: number; height: number; data: Uint8ClampedArray };

export type Rect = { x: number; y: number; width: number; height: number };

const at = (img: GrayImage, x: number, y: number) => img.data[y * img.width + x] ?? 0;

/** Resizes with box averaging when shrinking and bilinear sampling when growing. */
export function resizeGray(src: GrayImage, width: number, height: number): GrayImage {
  if (width === src.width && height === src.height) return src;
  const data = new Uint8ClampedArray(width * height);
  const sx = src.width / width;
  const sy = src.height / height;
  if (sx >= 1 && sy >= 1) {
    for (let y = 0; y < height; y++) {
      const y0 = Math.floor(y * sy);
      const y1 = Math.min(src.height, Math.max(y0 + 1, Math.ceil((y + 1) * sy)));
      for (let x = 0; x < width; x++) {
        const x0 = Math.floor(x * sx);
        const x1 = Math.min(src.width, Math.max(x0 + 1, Math.ceil((x + 1) * sx)));
        let sum = 0;
        for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) sum += at(src, xx, yy);
        data[y * width + x] = sum / ((y1 - y0) * (x1 - x0));
      }
    }
    return { width, height, data };
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data[y * width + x] = sample(src, (x + 0.5) * sx - 0.5, (y + 0.5) * sy - 0.5, 0);
  }
  return { width, height, data };
}

/** Bilinear sample at a fractional position; positions outside the image give `outside`. */
function sample(img: GrayImage, fx: number, fy: number, outside: number): number {
  if (fx < -0.5 || fy < -0.5 || fx > img.width - 0.5 || fy > img.height - 0.5) return outside;
  const cx = Math.min(img.width - 1, Math.max(0, fx));
  const cy = Math.min(img.height - 1, Math.max(0, fy));
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = Math.min(img.width - 1, x0 + 1);
  const y1 = Math.min(img.height - 1, y0 + 1);
  const tx = cx - x0;
  const ty = cy - y0;
  const top = at(img, x0, y0) * (1 - tx) + at(img, x1, y0) * tx;
  const bottom = at(img, x0, y1) * (1 - tx) + at(img, x1, y1) * tx;
  return top * (1 - ty) + bottom * ty;
}

/** Shrinks so the longer side is at most `side`; used for cheap analysis only. */
export function fitWithin(img: GrayImage, side: number): GrayImage {
  const longest = Math.max(img.width, img.height);
  if (longest <= side) return img;
  const scale = side / longest;
  return resizeGray(img, Math.max(1, Math.round(img.width * scale)), Math.max(1, Math.round(img.height * scale)));
}

export function cropGray(img: GrayImage, r: Rect): GrayImage {
  const data = new Uint8ClampedArray(r.width * r.height);
  for (let y = 0; y < r.height; y++) {
    const from = (r.y + y) * img.width + r.x;
    data.set(img.data.subarray(from, from + r.width), y * r.width);
  }
  return { width: r.width, height: r.height, data };
}

const ANALYSIS_SIDE = 320;
/** A paper region smaller than this share of the photo is more likely noise than a receipt. */
const MIN_PAPER_SHARE = 0.12;
/** A paper region this large means the receipt already fills the photo. */
const MAX_PAPER_SHARE = 0.92;
const CROP_MARGIN = 0.02;

/**
 * Finds the receipt: the largest connected bright region (paper against a darker table or hand).
 * Returns null when there is nothing to crop, because the paper fills the photo or no clear region was found.
 */
export function findPaper(img: GrayImage): Rect | null {
  const small = fitWithin(img, ANALYSIS_SIDE);
  const { width: w, height: h } = small;
  const threshold = otsuThreshold(small.data);
  const label = new Int32Array(w * h);
  let bestLabel = 0;
  let bestSize = 0;
  let bestBox = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  let next = 0;
  const stack: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (label[start] !== 0 || (small.data[start] ?? 0) <= threshold) continue;
    next++;
    let size = 0;
    const box = { minX: w, minY: h, maxX: 0, maxY: 0 };
    stack.push(start);
    label[start] = next;
    while (stack.length) {
      const p = stack.pop() as number;
      const x = p % w;
      const y = (p - x) / w;
      size++;
      box.minX = Math.min(box.minX, x);
      box.maxX = Math.max(box.maxX, x);
      box.minY = Math.min(box.minY, y);
      box.maxY = Math.max(box.maxY, y);
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as const) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (label[q] === 0 && (small.data[q] ?? 0) > threshold) {
          label[q] = next;
          stack.push(q);
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      bestLabel = next;
      bestBox = box;
    }
  }
  if (!bestLabel) return null;

  const boxShare = ((bestBox.maxX - bestBox.minX + 1) * (bestBox.maxY - bestBox.minY + 1)) / (w * h);
  if (boxShare < MIN_PAPER_SHARE || boxShare > MAX_PAPER_SHARE) return null;

  const scaleX = img.width / w;
  const scaleY = img.height / h;
  const marginX = Math.round(img.width * CROP_MARGIN);
  const marginY = Math.round(img.height * CROP_MARGIN);
  const x0 = Math.max(0, Math.floor(bestBox.minX * scaleX) - marginX);
  const y0 = Math.max(0, Math.floor(bestBox.minY * scaleY) - marginY);
  const x1 = Math.min(img.width, Math.ceil((bestBox.maxX + 1) * scaleX) + marginX);
  const y1 = Math.min(img.height, Math.ceil((bestBox.maxY + 1) * scaleY) + marginY);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

const SKEW_SIDE = 700;
/** Largest tilt looked for, in degrees. */
export const MAX_SKEW = 12;
/** Tilts smaller than this are left alone: turning the image would blur it more than it helps. */
const MIN_FIX = 0.4;

/** How sharply ink piles up in rows when the image is turned by `degrees` (high = lines are level). */
function rowSharpness(ink: readonly number[], w: number, h: number, degrees: number): number {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const bins = new Float64Array(h + w + 2);
  const offset = w;
  for (const p of ink) {
    const x = p % w;
    const y = (p - x) / w;
    const bin = Math.round(y * cos - x * sin) + offset;
    bins[bin] = (bins[bin] ?? 0) + 1;
  }
  let sum = 0;
  for (const c of bins) sum += c * c;
  return sum;
}

/**
 * Estimates how far the text lines are tilted, in degrees (positive = the lines run downhill to the right).
 * Picks the angle at which dark pixels line up in the fewest, fullest rows. Returns 0 if nothing clear is found.
 */
export function estimateSkew(img: GrayImage): number {
  const small = fitWithin(img, SKEW_SIDE);
  // Ink = clearly darker than its surroundings. A dark table around the paper is uniform, so it does not count.
  const marks = adaptiveThreshold(small.data, small.width, small.height, 15, 25);
  const ink: number[] = [];
  for (let i = 0; i < marks.length; i++) if (marks[i] === 0) ink.push(i);
  // Mostly ink or almost none: no text lines to measure.
  if (ink.length < 50 || ink.length > small.data.length * 0.5) return 0;

  const score = (a: number) => rowSharpness(ink, small.width, small.height, a);
  let best = 0;
  let bestScore = score(0);
  const base = bestScore;
  for (let a = -MAX_SKEW; a <= MAX_SKEW; a += 1) {
    const s = score(a);
    if (s > bestScore) {
      bestScore = s;
      best = a;
    }
  }
  const coarse = best;
  for (let a = coarse - 0.75; a <= coarse + 0.75; a += 0.25) {
    const s = score(a);
    if (s > bestScore) {
      bestScore = s;
      best = a;
    }
  }
  // Only trust a clear improvement over "not tilted".
  if (bestScore < base * 1.03 || Math.abs(best) < MIN_FIX) return 0;
  return best;
}

/** Turns the image by `degrees` around its centre (positive = clockwise), keeping its size. Gaps are `fill`. */
export function rotateGray(img: GrayImage, degrees: number, fill = 255): GrayImage {
  if (degrees === 0) return img;
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const cx = (img.width - 1) / 2;
  const cy = (img.height - 1) / 2;
  const data = new Uint8ClampedArray(img.data.length);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      // Look up where this pixel came from (inverse rotation).
      data[y * img.width + x] = sample(img, cx + dx * cos + dy * sin, cy - dx * sin + dy * cos, fill);
    }
  }
  return { width: img.width, height: img.height, data };
}
