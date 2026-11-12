// Generates the PWA icons (public/icons/*.png) from the sprout mark in public/favicon.svg (the same paths as
// src/components/Logo.tsx). Draws each icon as SVG in headless Microsoft Edge and saves a PNG.
//   node scripts/make-icons.mjs
// Needs Edge (set EDGE_PATH to override the default Windows location).
import { mkdirSync, readFileSync } from "node:fs";
import puppeteer from "puppeteer-core";

const GREEN = "#22C55E";
const edge = process.env.EDGE_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

// Everything after the tile in favicon.svg is the sprout.
const favicon = readFileSync("public/favicon.svg", "utf8");
const sprout = favicon.slice(favicon.indexOf("/>") + 2, favicon.lastIndexOf("</svg>"));

/** rounded: a rounded tile on transparent. Otherwise full bleed, with the sprout scaled around the centre. */
const svg = (size, { rounded, scale }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">` +
  `<rect width="64" height="64" rx="${rounded ? 17 : 0}" fill="${GREEN}"/>` +
  `<g transform="translate(32 32) scale(${scale}) translate(-32 -32)">${sprout}</g></svg>`;

const OUT = [
  ["icon-192.png", 192, { rounded: true, scale: 1 }],
  ["icon-512.png", 512, { rounded: true, scale: 1 }],
  ["icon-maskable-512.png", 512, { rounded: false, scale: 0.78 }], // the sprout stays inside the 80% safe zone
  ["apple-touch-icon.png", 180, { rounded: false, scale: 0.92 }], // iOS rounds the corners itself
];

mkdirSync("public/icons", { recursive: true });
const browser = await puppeteer.launch({ executablePath: edge, headless: true });
try {
  for (const [name, size, opts] of OUT) {
    const page = await browser.newPage();
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    await page.setContent(`<body style="margin:0;background:transparent">${svg(size, opts)}</body>`);
    await page.screenshot({ path: `public/icons/${name}`, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    await page.close();
  }
} finally {
  await browser.close();
}
console.log("wrote", OUT.map((o) => o[0]).join(", "));
