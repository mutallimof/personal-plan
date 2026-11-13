import { describe, expect, it } from "vitest";
import {
  aliasesToLearn,
  applySuggestion,
  buildReview,
  canSave,
  confirmLine,
  editLine,
  isLowConfidence,
  itemsToSave,
  lineProblem,
  toggleSkip,
  unresolvedCount,
  withSuggestions,
  type ReviewLine,
} from "./review";
import { alias, loc, SYNTHETIC_RECEIPT } from "./fixtures";
import { LOW_CONFIDENCE } from "./ocr";
import { parseGenericReceipt, type ParsedLine } from "./receipt";

const places = [
  loc({ id: "fridge", name: "Fridge", kind: "fridge", position: 0 }),
  loc({ id: "freezer", name: "Freezer", kind: "freezer", position: 1 }),
  loc({ id: "shelf", name: "Shelf", kind: "shelf", position: 2 }),
];

const dict = [
  alias("H MILCH 1.5%", "Milk (UHT) 1.5%", { default_location_kind: "shelf", default_unit: "l", default_quantity: 1 }),
  alias("BIO EIER M", "Eggs", { default_location_kind: "fridge", default_unit: "pieces", default_quantity: 10 }),
  alias("SPAGHETTI", "Spaghetti", { category: "dry goods", default_location_kind: "shelf", default_unit: "pack", default_quantity: 1 }),
];

const parsed = (p: Partial<ParsedLine> & { raw_text: string }, lineNo = 0): ParsedLine => ({
  lineNo,
  quantity: 1,
  unit: null,
  unit_price: null,
  total_price: null,
  ...p,
});

describe("buildReview", () => {
  it("fills a matched line from the dictionary and marks it confirmed", () => {
    const [l] = buildReview([parsed({ raw_text: "H-MILCH 1,5% 1L" })], dict, null, places);
    expect(l).toMatchObject({
      status: "matched",
      confirmed: true,
      skip: false,
      edited: false,
      name: "Milk (UHT) 1.5%",
      quantity: 1,
      unit: "l",
      category: "dairy",
      locationId: "shelf",
    });
  });

  it("multiplies the remembered quantity by how many were bought", () => {
    const [l] = buildReview([parsed({ raw_text: "BIO EIER M 10ER", quantity: 2 })], dict, null, places);
    expect(l).toMatchObject({ quantity: 20, unit: "pieces", locationId: "fridge" });
  });

  it("uses a printed weight instead of the remembered quantity", () => {
    const [l] = buildReview([parsed({ raw_text: "SPAGHETTI", quantity: 0.5, unit: "kg" })], dict, null, places);
    expect(l).toMatchObject({ quantity: 0.5, unit: "kg", weighed: true });
  });

  it("shows an unknown line with a readable name and needs a look", () => {
    const [l] = buildReview([parsed({ raw_text: "KÄSE GOUDA 400G" })], dict, null, places);
    expect(l).toMatchObject({ status: "unknown", confirmed: false, name: "Käse Gouda", category: "other", unit: "pieces", quantity: 1 });
  });

  it("marks a close spelling as uncertain and fills it from the suggestion", () => {
    const [l] = buildReview([parsed({ raw_text: "VOLLKORNBROTT" })], [alias("VOLLKORNBROT", "Bread", { category: "bakery" })], null, places);
    expect(l).toMatchObject({ status: "uncertain", confirmed: false, name: "Bread", category: "bakery" });
  });

  it("falls back to the category's usual place when the dictionary gives none", () => {
    const [l] = buildReview([parsed({ raw_text: "JOGHURT" })], [alias("JOGHURT", "Yogurt", { category: "dairy" })], null, places);
    expect(l?.locationId).toBe("fridge");
  });

  it("leaves the place empty when the user has no matching place", () => {
    const [l] = buildReview([parsed({ raw_text: "JOGHURT" })], [alias("JOGHURT", "Yogurt")], null, []);
    expect(l?.locationId).toBeNull();
  });

  it("sorts unknown first, then uncertain, then matched, keeping receipt order inside each", () => {
    const lines = buildReview(
      [
        parsed({ raw_text: "SPAGHETTI" }, 1),
        parsed({ raw_text: "ZZZ ONE" }, 2),
        parsed({ raw_text: "VOLLKORNBROTT" }, 3),
        parsed({ raw_text: "H MILCH 1,5%" }, 4),
        parsed({ raw_text: "ZZZ TWO" }, 5),
      ],
      [...dict, alias("VOLLKORNBROT", "Bread")],
      null,
      places,
    );
    expect(lines.map((l) => l.id)).toEqual(["2", "5", "3", "1", "4"]);
  });

  it("builds a review from the synthetic receipt: unknown lines first", () => {
    const lines = buildReview(parseGenericReceipt(SYNTHETIC_RECEIPT), dict, "rewe", places);
    expect(lines.map((l) => [l.status, l.name])).toEqual([
      ["unknown", "Bananen"],
      ["unknown", "Joghurt Natur"],
      ["unknown", "Tomaten"],
      ["matched", "Milk (UHT) 1.5%"],
      ["matched", "Eggs"],
      ["matched", "Spaghetti"],
    ]);
    expect(lines[0]).toMatchObject({ quantity: 946, unit: "g", weighed: true });
    expect(lines[1]).toMatchObject({ quantity: 3, unit: "pieces" });
  });
});

describe("OCR confidence", () => {
  it("has no confidence for plain text", () => {
    const [l] = buildReview([parsed({ raw_text: "SPAGHETTI" })], dict, null, places);
    expect(l?.confidence).toBeNull();
  });

  it("keeps a confident exact match confirmed", () => {
    const [l] = buildReview([parsed({ raw_text: "SPAGHETTI" }, 4)], dict, null, places, new Map([[4, 96]]));
    expect(l).toMatchObject({ status: "matched", confirmed: true, confidence: 96 });
  });

  it("asks for a second look at a matched line the OCR was unsure of", () => {
    const [l] = buildReview([parsed({ raw_text: "SPAGHETTI" }, 4)], dict, null, places, new Map([[4, 61]]));
    expect(l).toMatchObject({ status: "matched", confirmed: false, confidence: 61 });
    expect(unresolvedCount([l as ReviewLine])).toBe(1);
  });

  it("sorts low-confidence matches after unknown and uncertain, before confident ones", () => {
    const lines = buildReview(
      [parsed({ raw_text: "SPAGHETTI" }, 1), parsed({ raw_text: "H MILCH 1,5%" }, 2), parsed({ raw_text: "ZZZ" }, 3)],
      dict,
      null,
      places,
      new Map([
        [1, 95],
        [2, 50],
        [3, 99],
      ]),
    );
    expect(lines.map((l) => l.id)).toEqual(["3", "2", "1"]);
  });

  it("treats the threshold as low only below it", () => {
    expect(isLowConfidence({ confidence: LOW_CONFIDENCE })).toBe(false);
    expect(isLowConfidence({ confidence: LOW_CONFIDENCE - 1 })).toBe(true);
    expect(isLowConfidence({ confidence: null })).toBe(false);
  });
});

describe("AI suggestions", () => {
  const suggestion = { text: "ZZZ", name: "Chicken breast", category: "meat", kind: "fridge" } as const;
  const [unknown, matched] = buildReview([parsed({ raw_text: "ZZZ 1,99 B" }, 1), parsed({ raw_text: "SPAGHETTI" }, 2)], dict, null, places) as [ReviewLine, ReviewLine];

  it("attaches a suggestion to the unknown line it answers, and changes nothing else", () => {
    const [a, b] = withSuggestions([unknown, matched], [suggestion]) as [ReviewLine, ReviewLine];
    expect(a.suggestion).toEqual(suggestion);
    expect(a).toMatchObject({ name: unknown.name, confirmed: false, edited: false, category: "other" });
    expect(b).toBe(matched);
  });

  it("never attaches to a matched line", () => {
    const [m] = withSuggestions([matched], [{ ...suggestion, text: "SPAGHETTI" }]) as [ReviewLine];
    expect(m.suggestion).toBeNull();
  });

  it("saves nothing until accepted: a suggested line is still unresolved", () => {
    const [a] = withSuggestions([unknown], [suggestion]) as [ReviewLine];
    expect(unresolvedCount([a])).toBe(1);
    expect(canSave([a])).toBe(false);
  });

  it("accepting fills the fields, picks the place of that kind, and counts as an edit", () => {
    const [a] = withSuggestions([unknown], [suggestion]) as [ReviewLine];
    expect(applySuggestion(a, places)).toMatchObject({
      name: "Chicken breast",
      category: "meat",
      locationId: "fridge",
      confirmed: true,
      edited: true,
      suggestion: null,
    });
  });

  it("falls back to the category place when the suggestion has no place", () => {
    const [a] = withSuggestions([unknown], [{ ...suggestion, kind: null, category: "frozen" }]) as [ReviewLine];
    expect(applySuggestion(a, places).locationId).toBe("freezer");
  });

  it("does nothing without a suggestion", () => {
    expect(applySuggestion(unknown, places)).toBe(unknown);
  });
});

describe("editing", () => {
  const [base] = buildReview([parsed({ raw_text: "ZZZ" })], dict, null, places) as [ReviewLine];

  it("editing confirms and marks the line as edited", () => {
    const l = editLine(base, { name: "Zzz" });
    expect(l).toMatchObject({ name: "Zzz", confirmed: true, edited: true });
  });

  it("confirming alone does not mark it as edited", () => {
    expect(confirmLine(base)).toMatchObject({ confirmed: true, edited: false });
  });

  it("skips and unskips", () => {
    expect(toggleSkip(base).skip).toBe(true);
    expect(toggleSkip(toggleSkip(base)).skip).toBe(false);
  });
});

describe("saving rules", () => {
  const lines = buildReview(
    [parsed({ raw_text: "ZZZ" }, 1), parsed({ raw_text: "SPAGHETTI" }, 2)],
    dict,
    null,
    places,
  );
  const [unknown, matched] = lines as [ReviewLine, ReviewLine];

  it("counts lines that still need a look; skipped ones do not count", () => {
    expect(unresolvedCount(lines)).toBe(1);
    expect(unresolvedCount([toggleSkip(unknown), matched])).toBe(0);
  });

  it("cannot save while a line is unresolved", () => {
    expect(canSave(lines)).toBe(false);
    expect(canSave([confirmLine(unknown), matched])).toBe(true);
  });

  it("cannot save with everything skipped", () => {
    expect(canSave([toggleSkip(unknown), toggleSkip(matched)])).toBe(false);
  });

  it("cannot save a line without a name or quantity", () => {
    const bad = editLine(unknown, { name: " " });
    expect(lineProblem(bad)).toBe("Name is empty");
    expect(canSave([bad, matched])).toBe(false);
    expect(lineProblem(editLine(unknown, { quantity: 0 }))).toBe("Quantity must be above 0");
    expect(lineProblem(unknown)).toBeNull();
  });

  it("saves every line that is not skipped", () => {
    const items = itemsToSave([editLine(unknown, { name: " Zzz ", quantity: 3 }), toggleSkip(matched)]);
    expect(items).toEqual([{ name: "Zzz", quantity: 3, unit: "pieces", category: "other", location_id: "shelf", icon: null }]);
  });
});

describe("aliasesToLearn", () => {
  const lines = buildReview(
    [parsed({ raw_text: "ZZZ ONE 1,99 B" }, 1), parsed({ raw_text: "SPAGHETTI" }, 2), parsed({ raw_text: "BIO EIER M", quantity: 2 }, 3)],
    dict,
    "rewe",
    places,
  );
  const byRaw = (raw: string) => lines.find((l) => l.rawText === raw) as ReviewLine;

  it("learns an unknown line once confirmed, with the store and the chosen place kind", () => {
    const learned = aliasesToLearn([editLine(byRaw("ZZZ ONE 1,99 B"), { name: "Zzz", locationId: "freezer", unit: "pack" })], "rewe", places);
    expect(learned).toEqual([
      {
        raw_text: "ZZZ ONE",
        store: "rewe",
        product_name: "Zzz",
        category: "other",
        default_location_kind: "freezer",
        default_unit: "pack",
        default_quantity: 1,
      },
    ]);
  });

  it("does not re-learn an untouched exact match", () => {
    expect(aliasesToLearn([byRaw("SPAGHETTI")], "rewe", places)).toEqual([]);
  });

  it("learns a matched line that was changed, with the quantity per item bought", () => {
    const changed = editLine(byRaw("BIO EIER M"), { quantity: 12 });
    expect(aliasesToLearn([changed], null, places)[0]).toMatchObject({ raw_text: "BIO EIER M", default_quantity: 6 });
  });

  it("learns nothing from skipped lines", () => {
    expect(aliasesToLearn([toggleSkip(editLine(byRaw("ZZZ ONE 1,99 B"), { name: "Zzz" }))], null, places)).toEqual([]);
  });

  it("learns nothing when a place was not chosen: the kind stays empty", () => {
    const l = editLine(byRaw("ZZZ ONE 1,99 B"), { locationId: null });
    expect(aliasesToLearn([l], null, places)[0]?.default_location_kind).toBeNull();
  });
});
