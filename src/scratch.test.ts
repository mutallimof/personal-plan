import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { SYNTHETIC_KAUFLAND } from "@/features/pantry/fixtures";
import { parseReceipt } from "@/features/pantry/receipt";
it("x", () => {
  const r = parseReceipt(SYNTHETIC_KAUFLAND);
  const out: string[] = [String(r.store)];
  for (const l of r.lines) out.push(JSON.stringify([l.lineNo, l.raw_text, l.text, l.quantity, l.unit, l.total_price, l.tax, l.discount, l.guess]));
  out.push("-- ignored");
  for (const l of r.ignored) out.push(JSON.stringify([l.lineNo, l.text, l.reason, l.total_price, !!l.restore]));
  writeFileSync("C:/Users/fikre/AppData/Local/Temp/out.txt", out.join("\n"));
});
