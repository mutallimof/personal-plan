// Screenshots of the real app with invented data, for design review.
//   node scripts/design-shots/shoot.mjs [output folder] [--theme garden|clay|tide] [--only name,name] [--desktop]
// Starts `vite dev` against a Supabase address that does not exist, signs a pretend user in through localStorage and
// answers every database request from fixtures.mjs inside the browser. No real account, key or network is used.
// Needs Microsoft Edge (set EDGE_PATH to override the default Windows location).
import { execSync, spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import puppeteer from "puppeteer-core";
import { chatStream, tables, user } from "./fixtures.mjs";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? null : (args[i + 1] ?? "");
};
const out = args[0] && !args[0].startsWith("--") ? args[0] : "screenshots/design";
const theme = flag("theme") ?? "garden";
const only = flag("only")?.split(",") ?? null;
const desktop = args.includes("--desktop");
const edge = process.env.EDGE_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

const PORT = 5198;
const APP = `http://localhost:${PORT}`;
const DB = "http://localhost:54399";

/** One per design group. `steps` run after the page has loaded. */
const SHOTS = [
  { name: "01-splash", path: "/", signedOut: true },
  { name: "02-navigation", path: "/gym" },
  { name: "03-home", path: "/pantry" },
  { name: "04-kitchen-fridge", path: "/pantry?open=fridge" },
  { name: "05-cook-tabs", path: "/pantry?sheet=cook" },
  { name: "06-shopping", path: "/pantry?sheet=cook", tab: "Shopping" },
  { name: "07-nutrition", path: "/pantry?sheet=cook", tab: "Nutrition" },
  { name: "08-chat", path: "/pantry?sheet=cook", tab: "Ask AI", ask: "What can I cook tonight?" },
  { name: "09-settings", path: "/pantry?sheet=settings" },
  { name: "09-settings-appearance", path: "/pantry?sheet=settings&section=appearance" },
  { name: "10-profile", path: "/profile" },
  { name: "11-sign-in", path: "/auth", signedOut: true },
  { name: "design-sheet", path: "/design", full: true },
  // more screens, for checking the rest of the app (pass --only x- to take just these)
  { name: "x-items", path: "/pantry?sheet=items" },
  { name: "x-add-item", path: "/pantry", click: "Add item" },
  { name: "x-receipt", path: "/pantry?sheet=receipt" },
  { name: "x-recipes", path: "/pantry?sheet=cook", tab: "Recipes" },
  { name: "x-cook-this", path: "/pantry?sheet=cook", click: "Cook this" },
  { name: "x-settings-ai", path: "/pantry?sheet=settings&section=ai" },
  { name: "x-settings-dictionary", path: "/pantry?sheet=settings&section=dictionary" },
  { name: "x-settings-layout", path: "/pantry?sheet=settings&section=layout" },
  { name: "x-gym-week", path: "/gym/week" },
  { name: "x-gym-month", path: "/gym/month" },
  { name: "x-gym-library", path: "/gym/library" },
  { name: "x-gym-session", path: "/gym/session/session-0" },
  { name: "x-gym-workout", path: "/gym/workout/session-0" },
  { name: "x-gym-exercise", path: "/gym/exercise/ex-0" },
  { name: "x-fridge-list", path: "/pantry?open=fridge", tapRow: "[data-more]" },
  { name: "x-freezer", path: "/pantry?open=freezer" },
  { name: "x-freezer-list", path: "/pantry?open=freezer", tapRow: "[data-more]" },
  { name: "x-fridge-empty-list", path: "/pantry?open=fridge", tapRow: "[data-empty]" },
  { name: "x-languages", path: "/languages" },
];

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const expires = Math.floor(Date.now() / 1000) + 86_400;
const session = {
  access_token: `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: user.id, role: "authenticated", exp: expires })}.pretend`,
  token_type: "bearer",
  expires_in: 86_400,
  expires_at: expires,
  refresh_token: "pretend",
  user,
};

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "*" };
const json = (body, status = 200) => ({ status, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(body) });

/** Answers a request to the pretend database. Reads come from the fixtures; writes are accepted and forgotten. */
function answer(req) {
  const url = new URL(req.url());
  if (req.method() === "OPTIONS") return { status: 204, headers: CORS };
  if (url.pathname.startsWith("/auth/v1/user")) return json(user);
  if (url.pathname.startsWith("/auth/")) return json({});
  const table = url.pathname.replace("/rest/v1/", "");
  const one = (req.headers()["accept"] ?? "").includes("vnd.pgrst.object");
  if (req.method() !== "GET") return one ? json({ id: "new" }, 201) : json([], 201);
  const rows = tables[table] ?? [];
  return one ? json(rows[0] ?? null) : json(rows);
}

// An earlier run that was cut off can leave its server behind; screenshots of that stale server would be wrong.
if (await fetch(APP).then(() => true, () => false)) {
  console.error(`Something is already listening on port ${PORT}. Stop it first.`);
  process.exit(1);
}

const env = { ...process.env, VITE_SUPABASE_URL: DB, VITE_SUPABASE_PUBLISHABLE_KEY: "preview", SUPABASE_URL: DB, SUPABASE_PUBLISHABLE_KEY: "preview" };
const server = spawn("npx", ["vite", "dev", "--port", String(PORT), "--strictPort"], { env, shell: true, stdio: "ignore" });

async function waitForServer() {
  for (let i = 0; i < 90; i++) {
    try {
      if ((await fetch(`${APP}/favicon.svg`)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("the dev server did not start");
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function clickText(page, selector, text) {
  const done = await page.evaluate(
    (sel, t) => {
      const el = [...document.querySelectorAll(sel)].find((e) => e.textContent?.trim() === t);
      if (el) el.click();
      return !!el;
    },
    selector,
    text,
  );
  if (!done) throw new Error(`nothing to click: ${selector} "${text}"`);
}

await mkdir(out, { recursive: true });
let failed = 0;
const browser = await puppeteer.launch({ executablePath: edge, headless: true });
try {
  await waitForServer();
  const wanted = SHOTS.filter((shot) => (only ? only.some((o) => shot.name.includes(o)) : !shot.name.startsWith("x-")));
  // Warm-up: the dev server bundles some dependencies the first time a page asks for them and that first load fails.
  // Open every page until none of them fails (at most four rounds), and throw the results away.
  for (let round = 0, broken = true; broken && round < 4; round++) {
    broken = false;
    for (const path of new Set(wanted.map((s) => s.path.split("?")[0]))) {
      const page = await browser.newPage();
    await page.evaluateOnNewDocument((s) => localStorage.setItem("sb-localhost-auth-token", JSON.stringify(s)), session);
    await page.setCacheEnabled(false); // a cached copy of a re-bundled dependency breaks the next page
        await page.setRequestInterception(true);
    page.on("request", (req) => (req.url().startsWith(DB) ? void req.respond(answer(req)) : void req.continue()));
      await page.goto(APP + path, { waitUntil: "networkidle0", timeout: 90_000 }).catch(() => {});
      await wait(1000);
      if (await page.evaluate(() => document.body.innerText.includes("didn't load")).catch(() => true)) broken = true;
      await page.close();
    }
    if (broken) await wait(6000);
  }
  const size = desktop ? { label: "1280", width: 1280, height: 800, mobile: false } : { label: "375", width: 375, height: 812, mobile: true };
  for (const mode of ["light", "dark"]) {
    for (const shot of wanted) {
      const page = await browser.newPage();
      try {
        await page.setViewport({ width: size.width, height: size.height, isMobile: size.mobile, hasTouch: size.mobile, deviceScaleFactor: 2 });
        await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
        await page.evaluateOnNewDocument(
          (s, appearance) => {
            if (s) localStorage.setItem("sb-localhost-auth-token", JSON.stringify(s));
            else localStorage.removeItem("sb-localhost-auth-token");
            localStorage.setItem("lifeplan.appearance", JSON.stringify(appearance));
          },
          shot.signedOut ? null : session,
          { theme, mode },
        );
        await page.setCacheEnabled(false); // a cached copy of a re-bundled dependency breaks the next page
        await page.setRequestInterception(true);
        page.on("request", (req) => {
          const url = req.url();
          if (url.startsWith(DB)) return void req.respond(answer(req));
          if (url.includes("/_serverFn/") && req.method() === "POST" && shot.ask)
            return void req.respond({ status: 200, headers: { "content-type": "application/x-ndjson; charset=utf-8", "x-tss-raw": "true" }, body: chatStream }).catch((e) => console.warn("respond failed", e.message));
          void req.continue();
        });
        page.on("pageerror", (e) => console.warn(`  [${shot.name}] page error: ${e.message}`));
        if (process.env.SHOTS_DEBUG) {
          page.on("console", (m) => console.warn(`  [${shot.name}] console: ${m.text().slice(0, 400)}`));
          page.on("request", (r) => r.method() === "POST" && console.warn(`  [${shot.name}] POST ${r.url().slice(0, 120)}`));
        }
        await page.goto(APP + shot.path, { waitUntil: "networkidle0", timeout: 90_000 });
        // the dev server sometimes re-bundles a dependency on first use and the page has to load again
        for (let i = 0; i < 3 && (await page.evaluate(() => document.body.innerText.includes("This page didn't load"))); i++) {
          await wait(2500);
          await page.reload({ waitUntil: "networkidle0", timeout: 90_000 });
        }
        await wait(1200);
        if (shot.tab) {
          await clickText(page, '[role="tab"]', shot.tab);
          await wait(900);
        }
        if (shot.click) {
          await clickText(page, "button", shot.click);
          await wait(900);
        }
        if (shot.tapRow) {
          const ok = await page.evaluate((sel) => {
            const hit = document.querySelector(`[data-row]:has(${sel}) [data-row-hit]`) ?? document.querySelector("[data-row-hit]");
            hit?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
            return !!hit;
          }, shot.tapRow);
          if (!ok) throw new Error("no row to tap");
          await wait(900);
        }
        if (shot.ask) {
          await page.type('input[aria-label="Ask what to cook"]', shot.ask);
          await page.keyboard.press("Enter");
          // in dev the answer may never show: React StrictMode runs the id counter in CookChat twice, so the reply finds no message
          await wait(1500);
        }
        await page.evaluate(() => document.fonts.ready);
        const file = `${out}/${shot.name}-${size.label}-${mode}${theme === "garden" ? "" : `-${theme}`}.png`;
        await page.screenshot({ path: file, fullPage: shot.full === true });
        console.log(file);
      } catch (e) {
        failed++;
        console.error(`FAILED ${shot.name} (${mode}): ${e instanceof Error ? e.message : e}`);
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
  // the server runs under a shell, so the whole process tree has to go (and before this script exits)
  try {
    if (process.platform === "win32") execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: "ignore" });
    else server.kill();
  } catch {
    /* already gone */
  }
}
process.exitCode = failed ? 1 : 0;
