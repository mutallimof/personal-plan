import { describe, expect, it } from "vitest";
import { UNDO_MINUTES, activeMeals, canUndo, todayTotals, type CookedLog } from "./cooked";

let n = 0;
function log(p: Partial<CookedLog> = {}): CookedLog {
  n++;
  return {
    id: `c${n}`,
    user_id: "u1",
    recipe_id: null,
    title: "Rice and eggs",
    servings: 2,
    kcal: 800,
    protein_g: 30,
    kcal_missing: 0,
    cooked_at: "2026-03-10T12:00:00",
    removed: [],
    undone_at: null,
    ...p,
  };
}

const now = new Date("2026-03-10T18:00:00");

describe("activeMeals", () => {
  it("leaves out undone meals and sorts newest first", () => {
    const a = log({ cooked_at: "2026-03-10T08:00:00" });
    const b = log({ cooked_at: "2026-03-10T13:00:00" });
    const c = log({ cooked_at: "2026-03-10T15:00:00", undone_at: "2026-03-10T15:02:00" });
    expect(activeMeals([a, c, b])).toEqual([b, a]);
  });
});

describe("canUndo", () => {
  it("is open for a few minutes after cooking", () => {
    const l = log({ cooked_at: "2026-03-10T17:55:00" });
    expect(canUndo(l, now)).toBe(true);
    expect(canUndo(log({ cooked_at: `2026-03-10T17:${60 - UNDO_MINUTES - 1}:00` }), now)).toBe(false);
  });

  it("is closed once undone", () => {
    expect(canUndo(log({ cooked_at: "2026-03-10T17:59:00", undone_at: "2026-03-10T17:59:30" }), now)).toBe(false);
  });
});

describe("todayTotals", () => {
  it("adds up today's meals only", () => {
    const logs = [
      log({ kcal: 800, protein_g: 30 }),
      log({ kcal: 500, protein_g: 20.5, kcal_missing: 2, cooked_at: "2026-03-10T09:00:00" }),
      log({ kcal: 900, protein_g: 40, cooked_at: "2026-03-09T20:00:00" }),
    ];
    expect(todayTotals(logs, now)).toEqual({ meals: 2, kcal: 1300, protein_g: 50.5, missing: 2 });
  });

  it("does not count undone meals", () => {
    expect(todayTotals([log({ undone_at: "2026-03-10T12:01:00" })], now)).toEqual({ meals: 0, kcal: 0, protein_g: 0, missing: 0 });
  });

  it("treats a meal without numbers as zero", () => {
    expect(todayTotals([log({ kcal: null, protein_g: null })], now)).toMatchObject({ meals: 1, kcal: 0, protein_g: 0 });
  });
});
