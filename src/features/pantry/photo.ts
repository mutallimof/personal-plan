import type { GrayImage } from "./image-geometry";
import { grayToRgba, targetSize, toGray } from "./image-prep";

export type LoadedPhoto = {
  /** The photo as taken (turned upright, resized to the working size), in colour. */
  canvas: HTMLCanvasElement;
  gray: GrayImage;
  /** Size as it came from the camera, before resizing. */
  source: { width: number; height: number };
};

/** Decodes a photo, turns it upright and resizes it. Runs on the device only; nothing is uploaded. */
export async function loadPhoto(file: Blob): Promise<LoadedPhoto> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Could not open that image.");
  }
  const source = { width: bitmap.width, height: bitmap.height };
  const { width, height } = targetSize(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not prepare the image.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return { canvas, gray: { width, height, data: toGray(ctx.getImageData(0, 0, width, height).data) }, source };
}

/** A canvas showing a grey image. */
export function grayCanvas(gray: GrayImage): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = gray.width;
  canvas.height = gray.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare the image.");
  const pixels = ctx.createImageData(gray.width, gray.height);
  pixels.data.set(grayToRgba(gray.data));
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

/** A temporary address for showing a canvas in an <img>. Release it with URL.revokeObjectURL. */
export function canvasUrl(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(URL.createObjectURL(blob)) : reject(new Error("Could not show the image."))),
      "image/jpeg",
      0.85,
    );
  });
}
