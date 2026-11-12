/// <reference types="node" />
// Measures how well receipt OCR works on your own photos, with and without the photo helper.
// See scripts/ocr-eval/README.md.
//
//   npm run ocr:eval                       every image in scripts/ocr-eval/samples
//   npm run ocr:eval -- path/to/folder     another folder
//   npm run ocr:eval -- --threshold        the helper also reduces to black and white
//   npm run ocr:eval -- --verbose          also list lines that were read exactly
//
// Each image is read twice: as taken ("original") and after the helper (crop, straighten, contrast: "helper").
// Photos and expected files stay on your machine: the samples folder is ignored by git, and OCR runs locally.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";
import { resizeGray, type GrayImage } from "../../src/features/pantry/image-geometry";
import { grayToRgba, targetSize, toGray } from "../../src/features/pantry/image-prep";
import { recognize } from "../../src/features/pantry/ocr";
import { scoreLines, type EvalResult } from "../../src/features/pantry/ocr-score";
import { prepareReceipt } from "../../src/features/pantry/receipt-prep";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const folder = resolve(args.find((a) => !a.startsWith("--")) ?? join(here, "samples"));
const blackWhite = flags.has("--threshold");
const verbose = flags.has("--verbose");

type Rgba = { width: number; height: number; data: Uint8ClampedArray };

function decode(file: string): Rgba {
  const buf = readFileSync(file);
  if (/\.png$/i.test(file)) {
    const png = PNG.sync.read(buf);
    return { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) };
  }
  const img = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true });
  return { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };
}

function png(gray: GrayImage): Buffer {
  const out = new PNG({ width: gray.width, height: gray.height });
  out.data = Buffer.from(grayToRgba(gray.data));
  return PNG.sync.write(out);
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

type Mode = "original" | "helper";
const MODES: readonly Mode[] = ["original", "helper"];
type Totals = { lines: number; exact: number; close: number; edits: number; chars: number; found: number; products: number };
const empty = (): Totals => ({ lines: 0, exact: 0, close: 0, edits: 0, chars: 0, found: 0, products: 0 });

function add(t: Totals, r: EvalResult, expected: readonly string[]) {
  const chars = expected.reduce((n, l) => n + l.replace(/\s+/g, " ").trim().length, 0);
  t.lines += expected.length;
  t.exact += r.exact;
  t.close += r.close;
  t.chars += chars;
  t.edits += r.cer * chars;
  t.found += r.products.found;
  t.products += r.products.expected;
}

const summary = (t: Totals) =>
  `${t.exact + t.close} of ${t.lines} lines exact or close (${pct((t.exact + t.close) / (t.lines || 1))}), ` +
  `exact ${pct(t.exact / (t.lines || 1))}, character errors ${pct(t.edits / (t.chars || 1))}, products found ${t.found} of ${t.products}`;

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

  console.log(
    `OCR on ${pairs.length} image(s), each twice: as taken, and after the photo helper${blackWhite ? " (black and white)" : ""}. ` +
      "The first run downloads the German language data.",
  );
  const totals: Record<Mode, Totals> = { original: empty(), helper: empty() };
  for (const p of pairs) {
    const rgba = decode(p.image);
    const size = targetSize(rgba.width, rgba.height);
    const gray = resizeGray({ width: rgba.width, height: rgba.height, data: toGray(rgba.data) }, size.width, size.height);
    const prepared = prepareReceipt(gray, { width: rgba.width, height: rgba.height }, { blackWhite });
    const expected = expectedLines(p.expected);
    const { cropped, tilt } = prepared.steps;
    console.log(
      `\n${basename(p.image)}  [check: ${prepared.quality.issue ?? "ok"}, brightness ${prepared.quality.brightness.toFixed(0)}, ` +
        `sharpness ${prepared.quality.sharpness.toFixed(0)}; helper ${cropped ? "cropped" : "no crop"}, tilt ${tilt.toFixed(1)}°]`,
    );
    for (const mode of MODES) {
      const image = mode === "original" ? gray : prepared.processed;
      const got = (await recognize(png(image), () => {}, join(here, ".cache"))).map((l) => l.text);
      const r = scoreLines(expected, got);
      print(mode, r);
      add(totals[mode], r, expected);
    }
  }

  console.log("\nAll images");
  for (const mode of MODES) console.log(`  ${mode.padEnd(8)} ${summary(totals[mode])}`);
  const gain = (totals.helper.exact + totals.helper.close - totals.original.exact - totals.original.close) / (totals.helper.lines || 1);
  const cerDelta = totals.helper.edits / (totals.helper.chars || 1) - totals.original.edits / (totals.original.chars || 1);
  console.log(
    `  helper vs original: ${gain >= 0 ? "+" : ""}${(gain * 100).toFixed(1)} points of lines read, ` +
      `${cerDelta <= 0 ? "" : "+"}${(cerDelta * 100).toFixed(1)} points of character errors ` +
      `(${gain > 0 || (gain === 0 && cerDelta < 0) ? "the helper helps" : gain === 0 && cerDelta === 0 ? "no difference" : "the helper does not help on these images"})`,
  );
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
