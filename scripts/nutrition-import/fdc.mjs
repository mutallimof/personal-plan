// Helpers to read the USDA FoodData Central "Foundation Foods or SR Legacy" CSV download (public domain, CC0 1.0).
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Minimal CSV reader (quoted fields, doubled quotes). Returns rows as objects keyed by the header. */
export function readCsv(file) {
  const text = readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

const KCAL = ["1008", "2047", "2048"]; // Energy; Atwater general; Atwater specific (Foundation Foods often has only these)
const PROTEIN = "1003";

export function loadFoods(dir) {
  const foods = readCsv(join(dir, "food.csv")).filter((f) => f.data_type === "foundation_food" || f.data_type === "sr_legacy_food");
  const ids = new Set(foods.map((f) => f.fdc_id));
  const amounts = new Map();
  for (const n of readCsv(join(dir, "food_nutrient.csv"))) {
    if (!ids.has(n.fdc_id)) continue;
    const m = amounts.get(n.fdc_id) ?? {};
    m[n.nutrient_id] = Number(n.amount);
    amounts.set(n.fdc_id, m);
  }
  const portions = new Map();
  for (const p of readCsv(join(dir, "food_portion.csv"))) {
    if (!ids.has(p.fdc_id)) continue;
    const list = portions.get(p.fdc_id) ?? [];
    const amount = Number(p.amount) || 1;
    list.push({ label: p.portion_description || p.modifier, grams: Number(p.gram_weight) / amount });
    portions.set(p.fdc_id, list);
  }
  const out = new Map();
  for (const f of foods) {
    const a = amounts.get(f.fdc_id) ?? {};
    const kcal = KCAL.map((k) => a[k]).find((v) => v !== undefined && !Number.isNaN(v));
    out.set(f.fdc_id, {
      id: f.fdc_id,
      description: f.description,
      published: f.publication_date,
      kcal,
      protein: a[PROTEIN],
      portions: portions.get(f.fdc_id) ?? [],
    });
  }
  return out;
}
