// Cleans up a receipt photo before OCR. These are plain functions over pixel arrays, so the browser and the
// eval script (scripts/ocr-eval) run exactly the same code. Everything stays on the device.

/** RGBA pixels to one grey value per pixel (luma weights). */
export function toGray(rgba: Uint8ClampedArray): Uint8ClampedArray {
  const gray = new Uint8ClampedArray(rgba.length / 4);
  for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
    gray[p] = Math.round(0.299 * (rgba[i] ?? 0) + 0.587 * (rgba[i + 1] ?? 0) + 0.114 * (rgba[i + 2] ?? 0));
  }
  return gray;
}

function histogram(gray: Uint8ClampedArray): number[] {
  const h = new Array<number>(256).fill(0);
  for (const v of gray) h[v] = (h[v] ?? 0) + 1;
  return h;
}

/** Stretches the grey range so the darkest 2% become black and the lightest 2% white. Fixes washed-out photos. */
export function stretchContrast(gray: Uint8ClampedArray, clip = 0.02): Uint8ClampedArray {
  const h = histogram(gray);
  const cut = gray.length * clip;
  let low = 0;
  let seen = 0;
  while (low < 255 && seen + (h[low] ?? 0) <= cut) seen += h[low++] ?? 0;
  let high = 255;
  seen = 0;
  while (high > 0 && seen + (h[high] ?? 0) <= cut) seen += h[high--] ?? 0;
  if (high - low < 8) return gray; // flat image: nothing to stretch
  const out = new Uint8ClampedArray(gray.length);
  const scale = 255 / (high - low);
  for (let i = 0; i < gray.length; i++) out[i] = ((gray[i] ?? 0) - low) * scale;
  return out;
}

/** Otsu's method: the grey level that best separates ink from paper. */
export function otsuThreshold(gray: Uint8ClampedArray): number {
  const h = histogram(gray);
  const total = gray.length;
  let sumAll = 0;
  for (let t = 0; t < 256; t++) sumAll += t * (h[t] ?? 0);
  let sumBack = 0;
  let weightBack = 0;
  let best = 0;
  let bestVariance = -1;
  for (let t = 0; t < 256; t++) {
    weightBack += h[t] ?? 0;
    if (weightBack === 0) continue;
    const weightFront = total - weightBack;
    if (weightFront === 0) break;
    sumBack += t * (h[t] ?? 0);
    const meanBack = sumBack / weightBack;
    const meanFront = (sumAll - sumBack) / weightFront;
    const variance = weightBack * weightFront * (meanBack - meanFront) ** 2;
    if (variance > bestVariance) {
      bestVariance = variance;
      best = t;
    }
  }
  return best;
}

/**
 * Black and white with a threshold that follows the local brightness (mean of the surrounding window), so a shadow
 * across the paper does not turn into a black block. A pixel becomes black when it is clearly darker than its
 * surroundings (by `bias` grey levels).
 */
export function adaptiveThreshold(gray: Uint8ClampedArray, width: number, height: number, window = 31, bias = 12): Uint8ClampedArray {
  // Summed-area table: the sum over any rectangle in four lookups.
  const stride = width + 1;
  const sums = new Float64Array(stride * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      row += gray[y * width + x] ?? 0;
      sums[(y + 1) * stride + x + 1] = (sums[y * stride + x + 1] ?? 0) + row;
    }
  }
  const half = Math.floor(window / 2);
  const out = new Uint8ClampedArray(gray.length);
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - half);
    const y1 = Math.min(height, y + half + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - half);
      const x1 = Math.min(width, x + half + 1);
      const total = (sums[y1 * stride + x1] ?? 0) - (sums[y0 * stride + x1] ?? 0) - (sums[y1 * stride + x0] ?? 0) + (sums[y0 * stride + x0] ?? 0);
      const mean = total / ((y1 - y0) * (x1 - x0));
      out[y * width + x] = (gray[y * width + x] ?? 0) < mean - bias ? 0 : 255;
    }
  }
  return out;
}

/** Grey values to RGBA pixels (grey in all three channels, opaque), for canvases and PNG files. */
export function grayToRgba(gray: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(gray.length * 4);
  for (let p = 0, i = 0; p < gray.length; p++, i += 4) {
    const v = gray[p] ?? 0;
    out[i] = v;
    out[i + 1] = v;
    out[i + 2] = v;
    out[i + 3] = 255;
  }
  return out;
}

const MAX_SIDE = 3200;
const MIN_SHORT_SIDE = 1200;
const MAX_UPSCALE = 3;

/** Size to work at: big enough for small print to be readable, small enough to stay fast. */
export function targetSize(width: number, height: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  const shortest = Math.min(width, height);
  let scale = 1;
  if (longest > MAX_SIDE) scale = MAX_SIDE / longest;
  else if (shortest < MIN_SHORT_SIDE) scale = Math.min(MAX_UPSCALE, MIN_SHORT_SIDE / shortest);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
