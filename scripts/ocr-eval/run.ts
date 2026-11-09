/// <reference types="node" />
// Measures how well receipt OCR works on your own photos. See scripts/ocr-eval/README.md.
//
//   npm run ocr:eval                       every image in scripts/ocr-eval/samples
//   npm run ocr:eval -- path/to/folder     another folder
//   npm run ocr:eval -- --threshold        black-and-white preprocessing
//   npm run ocr:eval -- --verbose          also list lines that were read exactly
//
// Photos and expected files stay on your machine: the samples folder is ignored by git, and OCR runs locally.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";
import { enhance, targetSize } from "../../src/features/pantry/image-prep";
import { recognize } from "../../src/features/pantry/ocr";
import { scoreLines, type EvalResult } from "../../src/features/pantry/ocr-score";

type Image = { width: number; height: number; data: Uint8ClampedArray };

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const folder = resolve(args.find((a) => !a.startsWith("--")) ?? join(here, "samples"));
const threshold = flags.has("--threshold");
const verbose = flags.has("--verbose");

function decode(file: string): Image {
  const buf = readFileSync(file);
  if (/\.png$/i.test(file)) {
    const png = PNG.sync.read(buf);
    return { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) };
  }
  const img = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true });
  return { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };
}

/** Bilinear resize, standing in for what the browser's canvas does. */
function resize(src: Image, width: number, height: number): Image {
  if (width === src.width && height === src.height) return src;
  const data = new Uint8ClampedArray(width * height * 4);
  const sx = src.width / width;
  const sy = src.height / height;
  for (let y = 0; y < height; y++) {
    const fy = Math.min(src.height - 1, y * sy);
    const y0 = Math.floor(fy);
    const y1 = Math.min(src.height - 1, y0 + 1);
    for (let x = 0; x < width; x++) {
      const fx = Math.min(src.width - 1, x * sx);
      const x0 = Math.floor(fx);
      const x1 = Math.min(src.width - 1, x0 + 1);
      for (let c = 0; c < 4; c++) {
        const at = (px: number, py: number) => src.data[(py * src.width + px) * 4 + c] ?? 0;
        const top = at(x0, y0) * (1 - (fx - x0)) + at(x1, y0) * (fx - x0);
        const bottom = at(x0, y1) * (1 - (fx - x0)) + at(x1, y1) * (fx - x0);
        data[(y * width + x) * 4 + c] = top * (1 - (fy - y0)) + bottom * (fy - y0);
      }
    }
  }
  return { width, height, data };
}

function expectedLines(file: string): string[] {
  // Editors on Windows can add a byte order mark, which JSON.parse rejects.
  const json: unknown = JSON.parse(readFileSync(file, "utf8").replace(/^﻿/, ""));
  const list = Array.isArray(json) ? json : (json as { lines?: unknown }).lines;
  if (!Array.isArray(list) || !list.every((l) => typeof l === "string")) {
    throw new Error(`${basename(file)}: expected a list of strings, or {"lines": [...]}`);
  }
  return list as string[];
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function print(name: string, r: EvalResult) {
  console.log(`\n${name}`);
  for (const l of r.lines) {
    if (l.status === "exact" && !verbose) continue;
    const mark = l.status === "exact" ? "ok     " : l.status === "close" ? "close  " : "MISSED ";
    console.log(`  ${mark} ${l.expected}`);
    if (l.status !== "exact") console.log(`          read: ${l.got ?? "(nothing close)"}`);
  }
  if (r.extra.length) console.log(`  extra lines read: ${r.extra.length}${verbose ? `\n    ${r.extra.join("\n    ")}` : ""}`);
  console.log(
    `  lines: ${r.exact} exact, ${r.close} close, ${r.missed} missed of ${r.lines.length}  ` +
      `(exact ${pct(r.exactRate)}, exact or close ${pct(r.closeRate)}, character errors ${pct(r.cer)})`,
  );
  console.log(`  products found: ${r.products.found} of ${r.products.expected}`);
}

async function main() {
  if (!existsSync(folder)) {
    console.error(`No folder at ${folder}.\nCreate it and add photos with matching .expected.json files (see scripts/ocr-eval/README.md).`);
    process.exit(1);
  }
  const images = readdirSync(folder)
    .filter((f) => /\.(jpe?g|png)$/i.test(f))
    .sort();
  const pairs = images
    .map((f) => ({ image: join(folder, f), expected: join(folder, `${basename(f, extname(f))}.expected.json`) }))
    .filter((p) => existsSync(p.expected));
  if (!pairs.length) {
    console.error(`Nothing to do in ${folder}.\nEach photo (name.jpg) needs name.expected.json next to it. See scripts/ocr-eval/README.md.`);
    process.exit(1);
  }

  console.log(`OCR on ${pairs.length} image(s), ${threshold ? "black and white" : "greyscale"}. The first run downloads the German language data.`);
  const totals = { lines: 0, exact: 0, close: 0, edits: 0, chars: 0, found: 0, products: 0 };
  for (const p of pairs) {
    const src = decode(p.image);
    const size = targetSize(src.width, src.height);
    const scaled = resize(src, size.width, size.height);
    const png = new PNG({ width: size.width, height: size.height });
    png.data = Buffer.from(enhance(scaled.data, { threshold }));
    const got = (await recognize(PNG.sync.write(png), () => {}, join(here, ".cache"))).map((l) => l.text);
    const expected = expectedLines(p.expected);
    const r = scoreLines(expected, got);
    print(basename(p.image), r);

    const chars = expected.reduce((n, l) => n + l.replace(/\s+/g, " ").trim().length, 0);
    totals.lines += expected.length;
    totals.exact += r.exact;
    totals.close += r.close;
    totals.chars += chars;
    totals.edits += r.cer * chars;
    totals.found += r.products.found;
    totals.products += r.products.expected;
  }

  if (pairs.length > 1) {
    console.log(
      `\nAll images: ${totals.exact + totals.close} of ${totals.lines} lines read exactly or closely ` +
        `(${pct((totals.exact + totals.close) / (totals.lines || 1))}), exact ${pct(totals.exact / (totals.lines || 1))}, ` +
        `character errors ${pct(totals.edits / (totals.chars || 1))}, products found ${totals.found} of ${totals.products}`,
    );
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
