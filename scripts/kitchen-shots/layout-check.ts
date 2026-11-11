// Opens every view of the kitchen scene in headless Edge and fails when text overlaps other text, a badge,
// a button or a shelf line. Runs at 375 px and 1280 px, in light and dark.
// Usage: npx tsx scripts/kitchen-shots/layout-check.ts   (set EDGE_PATH if Edge is not in the default place)
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import puppeteer from "puppeteer-core";
import { DEFAULT_LAYOUT } from "../../src/features/kitchen/legacy";
import { describeClash, findClashes, type Box } from "../../src/features/kitchen/overlap";

export const EDGE = process.env["EDGE_PATH"] ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 5199;

const SIZES = [
  { label: "375", width: 375, height: 800, mobile: true },
  { label: "1280", width: 1280, height: 800, mobile: false },
] as const;

/** Runs inside the page (plain JavaScript, so no build step can change it): the boxes of everything the check cares about. */
const COLLECT = `(() => {
  const out = [];
  const add = (kind, name, el) => {
    const r = el.getBoundingClientRect();
    if (r.width > 0.5 && r.height > 0.5) out.push({ kind, name: String(name).trim().slice(0, 40), x: r.x, y: r.y, width: r.width, height: r.height });
  };
  for (const el of document.querySelectorAll("svg text")) {
    if (el.closest("[data-badge]") || el.closest("[data-button]")) continue;
    add("text", el.textContent || "", el);
  }
  for (const el of document.querySelectorAll("[data-badge]")) add("badge", el.textContent || "", el);
  for (const el of document.querySelectorAll("[data-button]")) add("button", el.getAttribute("aria-label") || "", el);
  for (const el of document.querySelectorAll("button")) add("button", el.getAttribute("aria-label") || el.textContent || "", el);
  for (const el of document.querySelectorAll("[data-sprite]")) add("sprite", el.closest("[data-item]")?.getAttribute("aria-label") || "product", el);
  for (const el of document.querySelectorAll("[data-board]")) add("board", "shelf line", el);
  for (const el of document.querySelectorAll("[data-overlay-text]")) add("text", el.textContent || "", el);
  return out;
})()`;

export type ViewResult = { view: string; size: string; theme: string; boxes: number; clashes: string[] };

export async function runLayoutCheck(): Promise<ViewResult[]> {
  const server = spawn("npx", ["vite", "--config", "scripts/kitchen-shots/vite.config.ts"], {
    env: { ...process.env, VITE_SUPABASE_URL: "http://localhost:1", VITE_SUPABASE_PUBLISHABLE_KEY: "preview" },
    shell: true,
    stdio: "ignore",
  });
  const results: ViewResult[] = [];
  const browser = await (async () => {
    // wait for the dev server, then open the browser
    for (let i = 0; i < 60; i++) {
      try {
        const res = await fetch(`http://localhost:${PORT}/`);
        if (res.ok) break;
      } catch {
        /* not up yet */
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    return puppeteer.launch({ executablePath: EDGE, headless: true });
  })();
  try {
    const views = ["", ...DEFAULT_LAYOUT.hotspots.map((h) => `open=${h.key}`)];
    for (const size of SIZES) {
      for (const dark of [0, 1]) {
        const page = await browser.newPage();
        await page.setViewport({ width: size.width, height: size.height, isMobile: size.mobile, hasTouch: size.mobile, deviceScaleFactor: 1 });
        for (const view of views) {
          const q = [view, dark ? "dark=1" : ""].filter(Boolean).join("&");
          await page.goto(`http://localhost:${PORT}/?${q}`, { waitUntil: "networkidle0" });
          await new Promise((r) => setTimeout(r, 1300)); // the open/zoom animation
          const boxes = (await page.evaluate(COLLECT)) as Box[];
          results.push({
            view: view || "scene",
            size: size.label,
            theme: dark ? "dark" : "light",
            boxes: boxes.length,
            clashes: findClashes(boxes).map(describeClash),
          });
        }
        await page.close();
      }
    }
  } finally {
    await browser.close();
    server.kill();
    spawn("taskkill", ["/pid", String(server.pid), "/T", "/F"], { shell: true, stdio: "ignore" });
  }
  return results;
}

export const edgeAvailable = () => existsSync(EDGE);

if (process.argv[1]?.replace(/\\/g, "/").endsWith("layout-check.ts")) {
  const results = await runLayoutCheck();
  let bad = 0;
  for (const r of results) {
    const status = r.clashes.length ? "FAIL" : "ok";
    console.log(`${status}  ${r.size}px ${r.theme.padEnd(5)} ${r.view.padEnd(22)} ${r.boxes} boxes`);
    for (const c of r.clashes) {
      console.log(`      ${c}`);
      bad++;
    }
  }
  console.log(bad ? `${bad} overlaps` : "No overlaps.");
  process.exit(bad ? 1 : 0);
}
