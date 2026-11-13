import { describe, expect, it } from "vitest";
import { aliasKey, exportAliases, parseAliasFile, planAliasWrites, toDraft, type Alias } from "./aliases";
import { STARTER_ALIASES } from "./starter-aliases";
import { normalizeReceiptText } from "./normalize";

const row = (p: Partial<Alias> = {}): Alias => ({
  id: "a1",
  user_id: "u1",
  raw_text: "H MILCH 1.5%",
  store: null,
  product_name: "Milk (UHT) 1.5%",
  category: "dairy",
  default_location_kind: "shelf",
  default_unit: "l",
  default_quantity: 1,
  icon: null,
  created_at: "2026-01-01T00:00:00Z",
  ...p,
});

describe("toDraft", () => {
  it("normalizes the text and fills defaults", () => {
    expect(toDraft({ raw_text: "Käse 1,99 B", product_name: " Cheese " })).toEqual({
      raw_text: "KAESE",
      store: null,
      product_name: "Cheese",
      category: "other",
      default_location_kind: null,
      default_unit: "pieces",
      default_quantity: null,
    });
  });

  it("lowercases the store and treats blank as none", () => {
    expect(toDraft({ raw_text: "A", product_name: "A", store: " REWE " })).toMatchObject({ store: "rewe" });
    expect(toDraft({ raw_text: "A", product_name: "A", store: "  " })).toMatchObject({ store: null });
  });

  it.each([
    [null, "not an object"],
    [{ product_name: "x" }, "raw_text is empty"],
    [{ raw_text: "1,99", product_name: "x" }, "raw_text is empty"],
    [{ raw_text: "a" }, "product_name is empty"],
    [{ raw_text: "a", product_name: "x", category: "Candy!" }, 'unknown category "Candy!"'],
    [{ raw_text: "a", product_name: "x", default_location_kind: "attic" }, 'unknown default_location_kind "attic"'],
    [{ raw_text: "a", product_name: "x", default_unit: "oz" }, 'unknown default_unit "oz"'],
    [{ raw_text: "a", product_name: "x", default_quantity: 0 }, "default_quantity must be a number above 0"],
    [{ raw_text: "a", product_name: "x", default_quantity: "2" }, "default_quantity must be a number above 0"],
  ])("rejects %j", (input, reason) => {
    expect(toDraft(input)).toBe(reason);
  });
});

describe("parseAliasFile", () => {
  it("reads the exported shape and a bare list", () => {
    const one = { raw_text: "Butter", product_name: "Butter", category: "dairy" };
    expect(parseAliasFile(JSON.stringify({ version: 1, aliases: [one] })).drafts).toHaveLength(1);
    expect(parseAliasFile(JSON.stringify([one])).drafts).toHaveLength(1);
  });

  it("keeps good entries and reports bad ones", () => {
    const res = parseAliasFile(JSON.stringify([{ raw_text: "Butter", product_name: "Butter" }, { raw_text: "x" }, 5]));
    expect(res.drafts).toHaveLength(1);
    expect(res.errors).toEqual(["Entry 2: product_name is empty", "Entry 3: not an object"]);
  });

  it("collapses entries that normalize to the same key, last one wins", () => {
    const res = parseAliasFile(
      JSON.stringify([
        { raw_text: "Butter 250g", product_name: "First" },
        { raw_text: "BUTTER", product_name: "Second" },
      ]),
    );
    expect(res.drafts.map((d) => d.product_name)).toEqual(["Second"]);
  });

  it("rejects broken JSON and the wrong shape", () => {
    expect(parseAliasFile("{nope").errors).toEqual(["The file is not valid JSON."]);
    expect(parseAliasFile('{"x":1}').errors).toHaveLength(1);
    expect(parseAliasFile("null").errors).toHaveLength(1);
  });
});

describe("exportAliases", () => {
  it("round-trips through parseAliasFile", () => {
    const aliases = [row({ id: "b", raw_text: "ZUCKER", store: "rewe", product_name: "Sugar" }), row()];
    const back = parseAliasFile(exportAliases(aliases));
    expect(back.errors).toEqual([]);
    expect(back.drafts.map(aliasKey).sort()).toEqual(aliases.map(aliasKey).sort());
  });

  it("does not leak ids or user ids", () => {
    const text = exportAliases([row()]);
    expect(text).not.toContain("u1");
    expect(text).not.toContain('"id"');
  });
});

describe("planAliasWrites", () => {
  const draft = (p: Partial<ReturnType<typeof toDraft> & object> = {}) => ({
    ...(toDraft({ raw_text: "Butter", product_name: "Butter" }) as object),
    ...p,
  }) as NonNullable<ReturnType<typeof toDraft> & object>;

  it("inserts new keys and updates existing ones", () => {
    const existing = [row({ id: "x", raw_text: "BUTTER" })];
    const plan = planAliasWrites(existing, [draft(), draft({ raw_text: "MILCH" })]);
    expect(plan.updates.map((u) => u.id)).toEqual(["x"]);
    expect(plan.inserts.map((d) => d.raw_text)).toEqual(["MILCH"]);
  });

  it("treats the same text in another store as a different alias", () => {
    const plan = planAliasWrites([row({ id: "x", raw_text: "BUTTER", store: null })], [draft({ store: "lidl" })]);
    expect(plan.updates).toEqual([]);
    expect(plan.inserts).toHaveLength(1);
  });

  it("keeps only the last of several drafts with one key", () => {
    const plan = planAliasWrites([], [draft({ product_name: "A" }), draft({ product_name: "B" })]);
    expect(plan.inserts.map((d) => d.product_name)).toEqual(["B"]);
  });
});

describe("starter dictionary", () => {
  it("is small", () => {
    expect(STARTER_ALIASES.length).toBeGreaterThan(30);
    expect(STARTER_ALIASES.length).toBeLessThan(80);
  });

  it("has valid, normalized, unique entries", () => {
    const keys = new Set<string>();
    for (const a of STARTER_ALIASES) {
      expect(toDraft(a)).toEqual(a);
      expect(a.raw_text).toBe(normalizeReceiptText(a.raw_text));
      expect(keys.has(aliasKey(a))).toBe(false);
      keys.add(aliasKey(a));
    }
  });

  it("covers the basics", () => {
    const texts = STARTER_ALIASES.map((a) => a.raw_text);
    for (const t of ["EIER", "BROT", "SPAGHETTI", "BASMATI REIS", "HAFERFLOCKEN", "SPEISEQUARK"]) {
      expect(texts).toContain(t);
    }
    expect(texts.some((t) => t.includes("MILCH"))).toBe(true);
    expect(texts.some((t) => t.includes("JOGHURT"))).toBe(true);
    expect(texts.some((t) => t.includes("HAEHNCHEN"))).toBe(true);
  });
});
