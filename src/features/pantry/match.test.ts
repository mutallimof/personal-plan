import { describe, expect, it } from "vitest";
import { levenshtein, matchAlias, similarity } from "./match";
import { alias as makeAlias } from "./fixtures";

const alias = (raw_text: string, product_name: string, store: string | null = null) => makeAlias(raw_text, product_name, { store });

describe("levenshtein / similarity", () => {
  it("counts edits", () => {
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("same", "same")).toBe(0);
  });

  it("scales to 0..1", () => {
    expect(similarity("abc", "abc")).toBe(1);
    expect(similarity("", "")).toBe(1);
    expect(similarity("abcd", "wxyz")).toBe(0);
    expect(similarity("abcde", "abcdf")).toBeCloseTo(0.8);
  });
});

describe("matchAlias exact", () => {
  const list = [alias("VOLLMILCH 3.5%", "Whole milk"), alias("EIER", "Eggs")];

  it("matches after normalizing the receipt text", () => {
    const m = matchAlias(list, "Vollmilch 3,5% 1L  1,15 B", null);
    expect(m.kind).toBe("exact");
    expect(m.kind === "exact" && m.alias.product_name).toBe("Whole milk");
  });

  it("prefers an entry for the same store over one without a store", () => {
    const both = [alias("BUTTER", "Butter"), alias("BUTTER", "Butter (Rewe)", "rewe")];
    const m = matchAlias(both, "BUTTER", "rewe");
    expect(m.kind === "exact" && m.alias.product_name).toBe("Butter (Rewe)");
  });

  it("ignores entries that belong to another store", () => {
    expect(matchAlias([alias("BUTTER", "Butter", "lidl")], "BUTTER", "rewe").kind).toBe("none");
    expect(matchAlias([alias("BUTTER", "Butter", "lidl")], "BUTTER", null).kind).toBe("none");
  });

  it("returns none for empty text", () => {
    expect(matchAlias(list, "1,99 B", null).kind).toBe("none");
  });
});

describe("matchAlias fuzzy", () => {
  const list = [alias("HAEHNCHENBRUSTFILET", "Chicken breast"), alias("VOLLMILCH 3.5%", "Whole milk")];

  it("marks a close spelling as uncertain, never exact", () => {
    const m = matchAlias(list, "HAEHNCHENBRUSTFILE", null);
    expect(m.kind).toBe("uncertain");
    expect(m.kind === "uncertain" && m.alias.product_name).toBe("Chicken breast");
    expect(m.kind === "uncertain" && m.score).toBeGreaterThan(0.85);
  });

  it("does not match different numbers (1.5% is not 3.5%)", () => {
    expect(matchAlias(list, "VOLLMILCH 1,5%", null).kind).toBe("none");
  });

  it("does not loosely match short texts", () => {
    expect(matchAlias([alias("EIER", "Eggs")], "EIEN", null).kind).toBe("none");
  });

  it("does not match things that are only somewhat alike", () => {
    expect(matchAlias(list, "HAEHNCHENKEULE", null).kind).toBe("none");
  });

  it("gives up when two different products are equally close", () => {
    const twins = [alias("BIO JOGHURT NATUR", "Natural yogurt"), alias("BIO JOGHURT NATUS", "Other yogurt")];
    expect(matchAlias(twins, "BIO JOGHURT NATUQ", null).kind).toBe("none");
  });

  it("is fine with two entries for the same product", () => {
    const same = [alias("HAEHNCHENBRUSTFILET", "Chicken breast"), alias("HAEHNCHENBRUSTFILETS", "Chicken breast")];
    expect(matchAlias(same, "HAEHNCHENBRUSTFILEX", null).kind).toBe("uncertain");
  });
});
