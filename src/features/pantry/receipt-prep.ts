// The receipt photo helper: crop to the paper, straighten, even out the contrast. Pure functions over grey
// pixels, used by the app and by the eval script. See README, "Taking a good receipt photo".
import { cropGray, estimateSkew, findPaper, rotateGray, type GrayImage } from "./image-geometry";
import { adaptiveThreshold, stretchContrast } from "./image-prep";
import { assessQuality, type PhotoQuality } from "./photo-quality";

export type PrepSteps = {
  /** The paper was found and the photo cut down to it. */
  cropped: boolean;
  /** Degrees the text lines were tilted before they were straightened (0 = left alone). */
  tilt: number;
};

export type Prepared = {
  /** What the camera gave us (only resized), for the "Use original" choice. */
  original: GrayImage;
  processed: GrayImage;
  quality: PhotoQuality;
  steps: PrepSteps;
};

/** Window for the black-and-white step: about 1/25 of the width, odd, never tiny. */
const windowFor = (width: number) => Math.max(15, Math.round(width / 25) | 1);

/**
 * Runs the whole helper. `source` is the photo's size before it was resized to the working size; the
 * "too small" check needs the real resolution. `blackWhite` adds a local threshold (pure black on white).
 */
export function prepareReceipt(gray: GrayImage, source: { width: number; height: number }, opts: { blackWhite: boolean }): Prepared {
  const paper = findPaper(gray);
  const area = paper ? cropGray(gray, paper) : gray;
  const quality = assessQuality(area, source);

  const stretched: GrayImage = { ...area, data: stretchContrast(area.data) };
  const tilt = estimateSkew(stretched);
  const level = rotateGray(stretched, -tilt);
  const processed: GrayImage = opts.blackWhite
    ? { ...level, data: adaptiveThreshold(level.data, level.width, level.height, windowFor(level.width)) }
    : level;

  return { original: gray, processed, quality, steps: { cropped: paper !== null, tilt } };
}
