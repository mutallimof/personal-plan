import { enhance, targetSize, type PrepOptions } from "./image-prep";

/** Decodes a photo, straightens its orientation, resizes it and cleans it up for OCR. Runs on the device only. */
export async function preparePhoto(file: File, options: PrepOptions): Promise<HTMLCanvasElement> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Could not open that image.");
  }
  const { width, height } = targetSize(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not prepare the image.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const pixels = ctx.getImageData(0, 0, width, height);
  pixels.data.set(enhance(pixels.data, options));
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}
