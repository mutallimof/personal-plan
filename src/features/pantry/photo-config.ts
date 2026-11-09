// Limits for the receipt photo checks. Tune them here; nothing else in the app hard-codes these numbers.
// They were chosen on invented test images, not on a collection of real phone photos, so adjust them if good
// photos are rejected or poor ones pass (npm run ocr:eval helps to see what your photos need).

export type PhotoLimits = {
  minBrightness: number;
  maxBrightness: number;
  minSharpness: number;
  minShortSide: number;
  minLongSide: number;
};

export const PHOTO_CHECKS: PhotoLimits = {
  /** Mean grey level (0-255) of the receipt area. Below: too dark. */
  minBrightness: 85,
  /** Above: washed out by glare or flash. */
  maxBrightness: 238,
  /** Variance of the Laplacian (edge strength) at a fixed working size. Below: too blurry. */
  minSharpness: 60,
  /** Smallest acceptable photo, in pixels. Both must hold: the short side and the long side. */
  minShortSide: 600,
  minLongSide: 900,
};

/** The longer side the sharpness is measured at, so the number does not depend on the camera's resolution. */
export const SHARPNESS_SIDE = 1200;
