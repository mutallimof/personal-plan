import { describe, expect, it } from "vitest";
import { comparable, dimensionOf, fromBase, toBase } from "./units";

describe("units", () => {
  it("converts weight and volume to grams and millilitres", () => {
    expect(toBase(1.5, "kg")).toBe(1500);
    expect(toBase(250, "g")).toBe(250);
    expect(toBase(0.5, "l")).toBe(500);
    expect(fromBase(1500, "kg")).toBe(1.5);
    expect(fromBase(250, "ml")).toBe(250);
  });

  it("only compares units of the same kind", () => {
    expect(comparable("g", "kg")).toBe(true);
    expect(comparable("ml", "l")).toBe(true);
    expect(comparable("pieces", "pieces")).toBe(true);
    expect(comparable("g", "ml")).toBe(false);
    expect(comparable("g", "pieces")).toBe(false);
    expect(comparable("pieces", "pack")).toBe(false);
  });

  it("treats an unknown unit as a pack", () => {
    expect(dimensionOf("bunch")).toBe("pack");
  });
});
