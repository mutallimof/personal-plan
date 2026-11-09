import { describe, expect, it } from "vitest";
import { displayName, normalizeReceiptText as n } from "./normalize";

describe("normalizeReceiptText", () => {
  it("uppercases and collapses spaces", () => {
    expect(n("  bio   vollmilch ")).toBe("BIO VOLLMILCH");
  });

  it("writes umlauts and ß the way receipts often do", () => {
    expect(n("Käse")).toBe("KAESE");
    expect(n("Müsli")).toBe("MUESLI");
    expect(n("Brötchen")).toBe("BROETCHEN");
    expect(n("Süßigkeiten")).toBe("SUESSIGKEITEN");
  });

  it("strips prices and tax letters", () => {
    expect(n("BANANEN 1,89 A")).toBe("BANANEN");
    expect(n("BUTTER 2.19 B")).toBe("BUTTER");
    expect(n("BUTTER 2,19 EUR B")).toBe("BUTTER");
    expect(n("PFAND -0,25")).toBe("PFAND");
  });

  it("strips weights, volumes and pack counts", () => {
    expect(n("SPAGHETTI 500G")).toBe("SPAGHETTI");
    expect(n("MILCH 1L")).toBe("MILCH");
    expect(n("WEIN 0,75 L")).toBe("WEIN");
    expect(n("EIER M 10ER")).toBe("EIER M");
    expect(n("JOGHURT 150 G")).toBe("JOGHURT");
    expect(n("KAESE 1,2KG")).toBe("KAESE");
  });

  it("keeps fat percentages, which tell products apart", () => {
    expect(n("Vollmilch 3,5% 1L 1,15 B")).toBe("VOLLMILCH 3.5%");
    expect(n("H-MILCH 1,5%")).toBe("H MILCH 1.5%");
    expect(n("MILCH 1.5%")).not.toBe(n("MILCH 3.5%"));
  });

  it("strips article numbers and quantity multipliers", () => {
    expect(n("4008400 GOUDA 400G 3,99 A")).toBe("GOUDA");
    expect(n("2 x TOMATEN")).toBe("TOMATEN");
  });

  it("keeps ordinary words that contain unit letters", () => {
    expect(n("GURKE")).toBe("GURKE");
    expect(n("LAUCH")).toBe("LAUCH");
    expect(n("KGB-TEE")).toBe("KGB TEE");
  });

  it("removes punctuation", () => {
    expect(n("Bio-Eier*")).toBe("BIO EIER");
    expect(n("FR.-MILCH")).toBe("FR MILCH");
  });

  it("returns an empty string when nothing is left", () => {
    expect(n("")).toBe("");
    expect(n("1,99 B")).toBe("");
  });

  it("is idempotent", () => {
    for (const s of ["Bio Vollmilch 3,5% 1L 1,15 B", "4008400 GOUDA 400G 3,99 A", "Käse Süß", "H-MILCH 1,5%"]) {
      expect(n(n(s))).toBe(n(s));
    }
  });
});

describe("displayName", () => {
  it("makes receipt text readable", () => {
    expect(displayName("BIO EIER M 10ER 2,49 B")).toBe("Bio Eier M");
    expect(displayName("KÄSE GOUDA 400G 3,99 A")).toBe("Käse Gouda");
    expect(displayName("VOLLMILCH 3,5% 1L")).toBe("Vollmilch 3.5%");
    expect(displayName("H-MILCH")).toBe("H-Milch");
  });

  it("returns an empty string when nothing is left", () => {
    expect(displayName("1,99 B")).toBe("");
  });
});
