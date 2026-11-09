// Reads text from a receipt photo with Tesseract, running in the browser (a WebAssembly worker).
// The photo is never uploaded. Tesseract downloads its own code and the German language data (about 10 MB,
// cached by the browser after the first use) and nothing else.

/** One line of recognized text with Tesseract's confidence (0-100). */
export type OcrLine = { text: string; confidence: number };

/** Lines below this confidence are highlighted for a second look. */
export const LOW_CONFIDENCE = 80;

type BlockLike = { paragraphs: { lines: { text: string; confidence: number }[] }[] };

/** Flattens Tesseract's blocks into trimmed, non-empty lines in reading order. */
export function linesFromBlocks(blocks: readonly BlockLike[] | null | undefined): OcrLine[] {
  const out: OcrLine[] = [];
  for (const b of blocks ?? []) {
    for (const p of b.paragraphs) {
      for (const l of p.lines) {
        const text = l.text.replace(/\s+$/g, "").replace(/^\s+/g, "");
        if (text) out.push({ text, confidence: l.confidence });
      }
    }
  }
  return out;
}

/** The text the receipt parser reads. Line n of this text is `lines[n]`, so parser line numbers map back. */
export const ocrText = (lines: readonly OcrLine[]) => lines.map((l) => l.text).join("\n");

/** Confidence per line number of `ocrText(lines)`. */
export const confidenceByLine = (lines: readonly OcrLine[]) => new Map(lines.map((l, i) => [i, l.confidence]));

export type OcrProgress = { label: string; progress: number };

const LABELS: Record<string, string> = {
  "loading tesseract core": "Loading reader",
  "initializing tesseract": "Loading reader",
  "loading language traineddata": "Loading German language data",
  "initializing api": "Loading reader",
  "recognizing text": "Reading the receipt",
};

/** Runs OCR on an image or canvas. `onProgress` gets a label and a 0-1 value. */
export async function recognize(
  image: Parameters<import("tesseract.js").Worker["recognize"]>[0],
  onProgress: (p: OcrProgress) => void = () => {},
  cachePath?: string,
): Promise<OcrLine[]> {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("deu", 1, {
    ...(cachePath ? { cachePath } : {}),
    logger: (m) => onProgress({ label: LABELS[m.status] ?? "Working", progress: m.progress }),
  });
  try {
    // One text column; keep the wide gaps between name and price.
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: "1" });
    const { data } = await worker.recognize(image, {}, { blocks: true });
    return linesFromBlocks(data.blocks);
  } finally {
    await worker.terminate();
  }
}
