import { describe, expect, it } from "vitest";
import { legacyTarget, parsePantrySearch } from "./sheets";

describe("parsePantrySearch", () => {
  it("keeps known values", () => {
    expect(parsePantrySearch({ sheet: "settings", section: "layout", q: "milk", open: "fridge", item: "i1" })).toEqual({
      sheet: "settings",
      section: "layout",
      q: "milk",
      open: "fridge",
      item: "i1",
    });
  });
  it("drops unknown sheets and a section outside settings", () => {
    expect(parsePantrySearch({ sheet: "nope", section: "layout" })).toEqual({});
    expect(parsePantrySearch({ sheet: "cook", section: "layout" }).section).toBeUndefined();
  });
  it("ignores blanks and non-text values", () => {
    expect(parsePantrySearch({ q: "  ", open: 5 })).toEqual({});
  });
});

describe("legacyTarget", () => {
  it("sends each old tab to its new place", () => {
    expect(legacyTarget("receipt")).toEqual({ sheet: "receipt" });
    expect(legacyTarget("cook")).toEqual({ sheet: "cook" });
    expect(legacyTarget("dictionary")).toEqual({ sheet: "settings", section: "dictionary" });
    expect(legacyTarget("kitchen")).toEqual({});
  });
});
