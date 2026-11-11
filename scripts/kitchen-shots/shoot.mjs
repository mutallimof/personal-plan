// Takes screenshots of the kitchen scene with invented data using Microsoft Edge (headless) and puppeteer-core.
// Usage: node scripts/kitchen-shots/shoot.mjs <output folder>
// Needs Edge installed (set EDGE_PATH to override the default Windows location).
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import puppeteer from "puppeteer-core";

const out = process.argv[2] ?? "kitchen-shots";
const edge =
  process.env.EDGE_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
await mkdir(out, { recursive: true });

const env = {
  ...process.env,
  VITE_SUPABASE_URL: "http://localhost:1",
  VITE_SUPABASE_PUBLISHABLE_KEY: "preview",
};
const server = spawn("npx", ["vite", "--config", "scripts/kitchen-shots/vite.config.ts"], {
  env,
  shell: true,
  stdio: "ignore",
});
await new Promise((r) => setTimeout(r, 6000));

const SHOTS = [
  { name: "scene", query: "" },
  { name: "cabinet-open", query: "open=wall-shelf" },
  { name: "base-cabinet-open", query: "open=base-left" },
  { name: "fridge-open", query: "open=fridge" },
  { name: "freezer-open", query: "open=freezer" },
  { name: "item-sheet", query: "open=fridge&item=1" },
  { name: "receipt-review", query: "view=review", full: true },
];
const SIZES = [
  { label: "375", width: 375, height: 800, mobile: true },
  { label: "1280", width: 1280, height: 800, mobile: false },
];

const browser = await puppeteer.launch({ executablePath: edge, headless: true });
try {
  for (const size of SIZES) {
    for (const dark of [0, 1]) {
      for (const shot of SHOTS) {
        const page = await browser.newPage();
        await page.setViewport({
          width: size.width,
          height: size.height,
          isMobile: size.mobile,
          hasTouch: size.mobile,
          deviceScaleFactor: 1,
        });
        const q = [shot.query, dark ? "dark=1" : ""].filter(Boolean).join("&");
        await page.goto(`http://localhost:5199/?${q}`, { waitUntil: "networkidle0" });
        await new Promise((r) => setTimeout(r, 1200));
        await page.screenshot({
          path: `${out}/${shot.name}-${size.label}-${dark ? "dark" : "light"}.png`,
          fullPage: shot.full === true,
        });
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
  server.kill();
  spawn("taskkill", ["/pid", String(server.pid), "/T", "/F"], { shell: true, stdio: "ignore" });
}
