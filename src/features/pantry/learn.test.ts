import { describe, expect, it } from "vitest";
import { draftFromCorrection, type Correction } from "./learn";

const base: Correction = {
  rawText: "H-MILCH 1,5% 1L 0,99 B",
  store: null,
  name: "Milk (UHT) 1.5%",
  category: "dairy",
  placeKind: "shelf",
  unit: "l",
  quantity: 2,
  count: 2,
  weighed: false,
};

describe("draftFromCorrection", () => {
  it("normalizes the receipt text and copies the choices", () => {
    expect(draftFromCorrection(base)).toEqual({
      raw_text: "H MILCH 1.5%",
      store: null,
      product_name: "Milk (UHT) 1.5%",
      category: "dairy",
      default_location_kind: "shelf",
      default_unit: "l",
      default_quantity: 1,
    });
  });

  it("remembers the quantity per item bought", () => {
    expect(draftFromCorrection({ ...base, quantity: 20, count: 2, unit: "pieces" })?.default_quantity).toBe(10);
    expect(draftFromCorrection({ ...base, quantity: 3, count: 1 })?.default_quantity).toBe(3);
  });

  it("does not remember a weighed amount", () => {
    expect(draftFromCorrection({ ...base, quantity: 0.532, count: 1, unit: "kg", weighed: true })).toMatchObject({
      default_unit: "kg",
      default_quantity: null,
    });
  });

  it("keeps the store", () => {
    expect(draftFromCorrection({ ...base, store: "rewe" })?.store).toBe("rewe");
  });

  it("does not remember a zero quantity", () => {
    expect(draftFromCorrection({ ...base, quantity: 0 })?.default_quantity).toBeNull();
  });

  it("returns null without usable text or name", () => {
    expect(draftFromCorrection({ ...base, rawText: "1,99 B" })).toBeNull();
    expect(draftFromCorrection({ ...base, name: "  " })).toBeNull();
  });
});
