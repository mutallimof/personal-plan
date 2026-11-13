import { describe, expect, it } from "vitest";
import { alias, loc, SYNTHETIC_KAUFLAND } from "./fixtures";
import { STORE_ALIASES } from "./starter-aliases";
import { parseGenericReceipt, parseReceipt, parseReceiptText, stripPrefix } from "./receipt";
import { buildReview, restoreLine } from "./review";

// Every receipt in this file is invented. Only the line formats follow real receipts.

const parse = (text: string) => parseReceiptText(text);
const find = (text: string, raw: string) => parse(text).lines.find((l) => l.raw_text === raw);

describe("two-line items", () => {
  const receipt = `Tomaten Rispen kg
 0,554 kg                 0,71 B
Äpfel Waage kg
 0,480 kg                 1,44 B
SUMME 2,15`;

  it("takes the name from the first line and the weight from the second", () => {
    const { lines } = parse(receipt);
    expect(lines.map((l) => l.raw_text)).toEqual(["Tomaten Rispen", "Äpfel"]);
    expect(lines[0]).toMatchObject({ quantity: 554, unit: "g", total_price: 0.71, tax: "B" });
    expect(lines[1]).toMatchObject({ quantity: 480, unit: "g", total_price: 1.44 });
  });

  it("never turns the weight line into a product", () => {
    expect(parse(receipt).lines.some((l) => /^\d/.test(l.raw_text))).toBe(false);
  });

  it("keeps a weight of a kilo or more in kg", () => {
    const l = parse("Kürbis kg\n 1,250 kg    3,12 B").lines[0];
    expect(l).toMatchObject({ raw_text: "Kürbis", quantity: 1.25, unit: "kg" });
  });

  it("reads a count and unit price on the second line", () => {
    const l = parse("Eier Beispiel\n 3 * 0,49    1,47 B").lines[0];
    expect(l).toMatchObject({ raw_text: "Eier Beispiel", quantity: 3, unit_price: 0.49, total_price: 1.47 });
  });

  it("works with Windows line endings", () => {
    expect(parse("Tomaten Rispen kg\r\n 0,554 kg   0,71 B\r\n").lines).toHaveLength(1);
  });

  it("does not combine a name with a detail line that has no price", () => {
    expect(parse("Tomaten Rispen kg\n 0,554 kg\n").lines).toHaveLength(0);
  });
});

describe("weights and sizes on the same line", () => {
  it("reads a weight behind a kg marker", () => {
    expect(find("Nektarinen kg     0,406 kg            1,21 B", "Nektarinen")).toMatchObject({ quantity: 406, unit: "g", total_price: 1.21 });
  });

  it("reads a size inside the name", () => {
    expect(find("Champignon w. 400g   1,99 B", "Champignon w. 400g")).toMatchObject({ quantity: 400, unit: "g", text: "Champignon w." });
    expect(find("Kartoffeln 2,5Kg   3,49 B", "Kartoffeln 2,5Kg")).toMatchObject({ quantity: 2.5, unit: "kg", text: "Kartoffeln" });
    expect(find("Peperoni Mix 100g   1,29 B", "Peperoni Mix 100g")).toMatchObject({ quantity: 100, unit: "g" });
    expect(find("Trauben 500g rot   2,49 B", "Trauben 500g rot")).toMatchObject({ quantity: 500, unit: "g", text: "Trauben rot" });
    expect(find("KBB Lachsfil 500g   5,99 B", "KBB Lachsfil 500g")).toMatchObject({ quantity: 500, unit: "g" });
  });

  it("reads litres and pack counts, and multiplies by how many were bought", () => {
    expect(parse("H-MILCH 1,5% 1L   0,99 B").lines[0]).toMatchObject({ quantity: 1, unit: "l" });
    expect(parse("BIO EIER M 10ER   2,49 B").lines[0]).toMatchObject({ quantity: 10, unit: "pieces" });
    expect(parse("MILCH 1L 2 x 0,99   1,98 B").lines[0]).toMatchObject({ quantity: 2, unit: "l" });
  });

  it("does not mistake a fat percentage for a size", () => {
    expect(parse("JOGHURT 3,5%   0,59 B").lines[0]).toMatchObject({ quantity: 1, unit: null });
  });

  it("reads St and St. as pieces and strips them", () => {
    expect(find("Zitronen St   0,59 B", "Zitronen")).toMatchObject({ quantity: 1, unit: "pieces" });
    expect(find("Dill Bund St.   0,99 B", "Dill Bund")).toMatchObject({ unit: "pieces" });
  });
});

describe("own-brand prefixes", () => {
  it("strips the prefixes of a store", () => {
    const k = ["KPur.H.", "K.H-", "KLC.", "KBB", "K."];
    expect(stripPrefix("K.H-Milch", k)).toBe("Milch");
    expect(stripPrefix("KPur.H.Brustfilet", k)).toBe("Brustfilet");
    expect(stripPrefix("K.Saure Sahne", k)).toBe("Saure Sahne");
    expect(stripPrefix("KLC.Nudeln", k)).toBe("Nudeln");
    expect(stripPrefix("KBB Lachsfil", k)).toBe("Lachsfil");
  });

  it("does not strip a prefix that is only the start of a word", () => {
    expect(stripPrefix("KBBQ Sauce", ["KBB"])).toBe("KBBQ Sauce");
  });

  it("keeps the raw text and adds the stripped text", () => {
    const l = parseReceiptText("K.H-Milch   1,15 B", { prefixes: ["K.H-"] }).lines[0];
    expect(l).toMatchObject({ raw_text: "K.H-Milch", text: "Milch" });
  });
});

describe("lines that are not products", () => {
  const receipt = `Pfandartikel   0,25 A
Pfandrückgabe  -0,25 A
BUTTER   2,19 B
Artikelrabatt   -0,50 A
2 Cent OuG Beutel
 4 * 0,02    0,08 A
Coupon Sommer   -1,00
Payback Punkte 5
SUMME   0,52
BAR   1,00
Rückgeld   0,48
MwSt A 19%   B 7%
Visa Kontaktlos
TOMATEN   0,99 B`;
  const result = parse(receipt);

  it("keeps only the product", () => {
    expect(result.lines.map((l) => l.raw_text)).toEqual(["BUTTER"]);
  });

  it("lists everything dropped, with a reason", () => {
    const by = (r: string) => result.ignored.filter((i) => i.reason === r).length;
    expect(by("deposit")).toBe(2);
    expect(by("bag")).toBe(1);
    expect(by("total")).toBe(1);
    expect(by("payment")).toBeGreaterThanOrEqual(2);
    expect(by("tax")).toBe(1);
  });

  it("puts a negative amount on the product above and never makes it a product", () => {
    expect(result.lines[0]).toMatchObject({ discount: -0.5, total_price: 1.69 });
    expect(result.ignored.some((i) => i.reason === "discount" && i.total_price === -0.5)).toBe(true);
  });

  it("does not attach a discount to a product that came before a deposit line", () => {
    const r = parse("BUTTER   2,19 B\nPfandartikel  0,25 A\nRabatt  -0,10 B");
    expect(r.lines[0]).toMatchObject({ total_price: 2.19, discount: null });
  });

  it("can restore a dropped price line as a product, but not a total", () => {
    expect(result.ignored.find((i) => i.reason === "bag")?.restore).toMatchObject({ raw_text: "2 Cent OuG Beutel", total_price: 0.08 });
    expect(result.ignored.find((i) => i.reason === "total")?.restore).toBeNull();
  });

  it("does not drop real products that contain these words", () => {
    const names = parse("Müllbeutel 20er   1,29 A\nBelegkäse   1,99 B\nVorteilspack Äpfel   2,99 B\nBartkoteletts   3,99 B").lines.map((l) => l.raw_text);
    expect(names).toEqual(["Müllbeutel 20er", "Belegkäse", "Vorteilspack Äpfel", "Bartkoteletts"]);
  });

  it("never makes a product after the total", () => {
    expect(parse("SUMME 1,00\nGURKE 0,79 B").lines).toEqual([]);
  });
});

describe("generic German receipts", () => {
  it("reads 2 x 1,29 quantity lines and comma decimals", () => {
    const l = parse("JOGHURT   2,58 B\n 2 x 1,29").lines[0];
    expect(l).toMatchObject({ quantity: 2, unit_price: 1.29, total_price: 2.58 });
  });

  it("reads tax letters A and B", () => {
    const lines = parse("SPÜLMITTEL   1,49 A\nBROT   2,19 B").lines;
    expect(lines.map((l) => l.tax)).toEqual(["A", "B"]);
  });

  it("reads prices with trailing spaces and a dot decimal", () => {
    expect(parse("BUTTER   2.19 B   \n").lines[0]).toMatchObject({ total_price: 2.19 });
    expect(parse("BUTTER   2,19    ").lines[0]).toMatchObject({ total_price: 2.19, tax: null });
  });

  it("reads a weight line with a unit price", () => {
    const l = parse("BANANEN   1,89 B\n 0,946 kg x 1,99 EUR/kg").lines[0];
    expect(l).toMatchObject({ quantity: 946, unit: "g", unit_price: 1.99, total_price: 1.89 });
  });

  it("returns nothing for text with no prices", () => {
    expect(parseGenericReceipt("Hello\nWorld\n12.03.2026 17:45")).toEqual([]);
  });
});

describe("Kaufland receipt", () => {
  const result = parseReceipt(SYNTHETIC_KAUFLAND);

  it("is detected from the text", () => {
    expect(result.store).toBe("kaufland");
  });

  it("finds exactly the products", () => {
    expect(result.lines.map((l) => l.raw_text)).toEqual([
      "Tomaten Rispen",
      "Äpfel",
      "Nektarinen",
      "Champignon w. 400g",
      "Kartoffeln 2,5Kg",
      "Peperoni Mix 100g",
      "Trauben 500g rot",
      "KBB Lachsfil 500g",
      "Zitronen",
      "Dill Bund",
      "K.H-Milch",
      "Weih.Butter",
      "KPur.H.Brustfilet",
      "Rhönsp.Miwa Natur.",
      "Toipa",
      "KLC Papr. edels.",
    ]);
  });

  it("drops deposits, bags and discounts", () => {
    expect(result.ignored.filter((i) => i.reason === "deposit")).toHaveLength(2);
    expect(result.ignored.some((i) => i.reason === "bag")).toBe(true);
    expect(result.lines.find((l) => l.raw_text === "Toipa")?.discount).toBe(-0.5);
  });

  it("buys two cartons when the count line says so", () => {
    expect(result.lines.find((l) => l.raw_text === "K.H-Milch")?.quantity).toBe(2);
  });
});

describe("Kaufland dictionary entries on the review screen", () => {
  const fridge = loc({ id: "fr", name: "Fridge", kind: "fridge" });
  const meat = loc({ id: "meat", name: "Meat and fish", kind: "shelf", parent_id: "fr", accepts: ["meat", "poultry", "fish"] });
  const dairy = loc({ id: "dairy", name: "Dairy and eggs", kind: "shelf", parent_id: "fr", accepts: ["dairy", "eggs"] });
  const veg = loc({ id: "veg", name: "Vegetable drawer", kind: "drawer", parent_id: "fr", accepts: ["vegetables"] });
  const places = [fridge, veg, meat, dairy];
  const dict = STORE_ALIASES.map((a) => alias(a.raw_text, a.product_name, { ...a }));
  const parsed = parseReceipt(SYNTHETIC_KAUFLAND);
  const lines = buildReview(parsed.lines, dict, "kaufland", places);
  const byRaw = (raw: string) => lines.find((l) => l.rawText === raw)!;

  it("knows the entries that are certain", () => {
    for (const [raw, name] of [
      ["Rhönsp.Miwa Natur.", "Mineral water"],
      ["Weih.Butter", "Butter"],
      ["K.H-Milch", "Milk (UHT)"],
      ["KPur.H.Brustfilet", "Chicken breast fillet"],
      ["Toipa", "Toilet paper"],
    ] as const) {
      expect(byRaw(raw)).toMatchObject({ name, status: "matched" });
    }
  });

  it("leaves the unsure ones unknown", () => {
    expect(byRaw("KLC Papr. edels.").status).toBe("unknown");
    expect(byRaw("KBB Lachsfil 500g").status).toBe("unknown");
  });

  it("never puts meat or fish in the vegetable drawer", () => {
    expect(byRaw("KPur.H.Brustfilet").locationId).toBe("meat");
    expect(byRaw("KBB Lachsfil 500g")).toMatchObject({ category: "fish", locationId: "meat" });
    expect(byRaw("Tomaten Rispen").locationId).toBe("veg");
    expect(byRaw("Weih.Butter").locationId).toBe("dairy");
  });

  it("skips non-food by default and lets the person track it", () => {
    expect(byRaw("Toipa")).toMatchObject({ category: "household", skip: true, autoSkip: true });
  });

  it("restores a dropped line as a line to review", () => {
    const bag = parsed.ignored.find((i) => i.reason === "bag")!;
    expect(restoreLine(bag, dict, "kaufland", places)).toMatchObject({ rawText: "2 Cent OuG Beutel", skip: false, confirmed: false });
  });

  it("uses the sizes read from the receipt", () => {
    expect(byRaw("Kartoffeln 2,5Kg")).toMatchObject({ quantity: 2.5, unit: "kg" });
    expect(byRaw("Tomaten Rispen")).toMatchObject({ quantity: 554, unit: "g" });
  });
});
