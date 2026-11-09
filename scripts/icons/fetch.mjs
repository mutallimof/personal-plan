// Downloads the icon files listed in src/features/pantry/icons/icons.json from Twemoji into public/icons/food.
// Twemoji graphics are CC-BY 4.0 (Copyright Twitter, Inc and other contributors); see README.
// Usage: node scripts/icons/fetch.mjs
import { readFile, writeFile, mkdir } from "node:fs/promises";

const TAG = "v15.1.0";
const BASE = `https://raw.githubusercontent.com/jdecked/twemoji/${TAG}/assets/svg`;
const data = JSON.parse(await readFile("src/features/pantry/icons/icons.json", "utf8"));
await mkdir("public/icons/food", { recursive: true });

let failed = 0;
for (const icon of data.icons) {
  const res = await fetch(`${BASE}/${icon.code}.svg`);
  if (!res.ok) {
    console.error(`missing ${icon.key} (${icon.code}): HTTP ${res.status}`);
    failed++;
    continue;
  }
  await writeFile(`public/icons/food/${icon.key}.svg`, await res.text());
}
console.log(`${data.icons.length - failed} of ${data.icons.length} icons written`);
if (failed) process.exitCode = 1;
