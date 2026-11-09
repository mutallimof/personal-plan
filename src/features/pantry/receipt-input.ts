// Turns an uploaded receipt (PDF, HTML, plain text) into text. Everything runs in the browser; the file is never sent anywhere.

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** A piece of text on a PDF page with its position (origin bottom-left, as PDF defines it). */
export type PdfTextItem = { str: string; x: number; y: number; width: number };

const SAME_LINE = 3; // points of vertical difference still counted as one line
const WIDE_GAP = 8; // points of horizontal gap that count as a column break

/** Joins PDF text pieces into lines, top to bottom, with two spaces where a column break is. */
export function pdfItemsToText(items: readonly PdfTextItem[]): string {
  const rows: { y: number; items: PdfTextItem[] }[] = [];
  for (const it of [...items].filter((i) => i.str.trim()).sort((a, b) => b.y - a.y)) {
    const row = rows.find((r) => Math.abs(r.y - it.y) <= SAME_LINE);
    if (row) row.items.push(it);
    else rows.push({ y: it.y, items: [it] });
  }
  return rows
    .map((r) => {
      let text = "";
      let end = Number.NEGATIVE_INFINITY;
      for (const it of r.items.sort((a, b) => a.x - b.x)) {
        const gap = it.x - end;
        text += text === "" ? it.str : gap > WIDE_GAP ? `  ${it.str}` : gap > 0.5 ? ` ${it.str}` : it.str;
        end = it.x + it.width;
      }
      return text.trim();
    })
    .join("\n");
}

const BLOCKS = "p,div,tr,li,h1,h2,h3,h4,h5,h6,table,section";

/** Visible text of an HTML document, with line breaks where the layout has them. */
export function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style,head,noscript").forEach((n) => n.remove());
  doc.querySelectorAll("br").forEach((n) => n.replaceWith("\n"));
  doc.querySelectorAll("td,th").forEach((n) => n.append("  "));
  doc.querySelectorAll(BLOCKS).forEach((n) => n.append("\n"));
  return (doc.body.textContent ?? "")
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

async function pdfToText(file: File): Promise<string> {
  // Loaded on demand: pdf.js is large and only needed here.
  const pdfjs = await import("pdfjs-dist");
  const { default: workerSrc } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdf = await task.promise;
  const pages: string[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const content = await (await pdf.getPage(n)).getTextContent();
    const items: PdfTextItem[] = [];
    for (const it of content.items) {
      if ("str" in it) items.push({ str: it.str, x: it.transform[4] ?? 0, y: it.transform[5] ?? 0, width: it.width });
    }
    pages.push(pdfItemsToText(items));
  }
  await task.destroy();
  return pages.join("\n");
}

/** Reads a receipt file as text. Throws an Error with a message that can be shown to the user. */
export async function readReceiptFile(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) throw new Error("That file is too large (10 MB at most).");
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  const isHtml = file.type === "text/html" || /\.html?$/i.test(file.name);
  let text: string;
  try {
    text = isPdf ? await pdfToText(file) : isHtml ? htmlToText(await readAsText(file)) : await readAsText(file);
  } catch {
    throw new Error("Could not read that file.");
  }
  if (!text.trim()) throw new Error(isPdf ? "No text found in that PDF. Is it a scan? Try a photo instead." : "The file has no text.");
  return text;
}
