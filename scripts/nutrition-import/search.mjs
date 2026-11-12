// node scripts/nutrition-import/search.mjs <dataset folder> <word> [<word> ...]
// Lists foods (Foundation Foods or SR Legacy) whose description contains every word, with energy and protein per 100 g.
import { loadFoods } from "./fdc.mjs";

const [dir, ...words] = process.argv.slice(2);
if (!dir || !words.length) {
  console.error("usage: node scripts/nutrition-import/search.mjs <dataset folder> <word> [<word> ...]");
  process.exit(1);
}
for (const f of loadFoods(dir).values()) {
  const d = f.description.toLowerCase();
  if (!words.every((w) => d.includes(w.toLowerCase()))) continue;
  const portions = f.portions.slice(0, process.env.ALL_PORTIONS ? 99 : 3).map((p) => `${p.label || "?"}=${+p.grams.toFixed(1)}g`).join("; ");
  console.log(`${f.id}  ${f.description}  | kcal ${f.kcal ?? "-"}  protein ${f.protein ?? "-"}  ${portions ? `| ${portions}` : ""}`);
}
