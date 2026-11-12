import { describe, expect, it } from "vitest";
import { UNDO_MINUTES, activeMeals, canUndo, lastDays, perPortion, portionsOf, recentMeals, todayTotals, weekSummary, type CookedLog } from "./cooked";

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
    carbs_g: null,
    fat_g: null,
    portions: null,
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
    expect(todayTotals(logs, now)).toEqual({ meals: 2, kcal: 1300, protein_g: 50.5, carbs_g: null, fat_g: null, missing: 2 });
  });

  it("does not count undone meals", () => {
    expect(todayTotals([log({ undone_at: "2026-03-10T12:01:00" })], now)).toEqual({ meals: 0, kcal: 0, protein_g: 0, carbs_g: null, fat_g: null, missing: 0 });
  });

  it("treats a meal without numbers as zero", () => {
    expect(todayTotals([log({ kcal: null, protein_g: null })], now)).toMatchObject({ meals: 1, kcal: 0, protein_g: 0 });
  });
});

describe("carbs and fat", () => {
  it("are summed only from meals that have them, and are null when none does", () => {
    const withMacros = [log({ carbs_g: 90, fat_g: 14 }), log({ carbs_g: 30.5, fat_g: 6 })];
    expect(todayTotals(withMacros, now)).toMatchObject({ carbs_g: 120.5, fat_g: 20 });
    expect(todayTotals([...withMacros, log()], now)).toMatchObject({ meals: 3, carbs_g: 120.5, fat_g: 20 });
    expect(todayTotals([log()], now)).toMatchObject({ carbs_g: null, fat_g: null });
  });
});

describe("per portion", () => {
  it("divides what was eaten by the portions eaten", () => {
    const l = log({ kcal: 600, protein_g: 24, carbs_g: 80, fat_g: 20, portions: 2, servings: 4 });
    expect(portionsOf(l)).toBe(2);
    expect(perPortion(l)).toEqual({ kcal: 300, protein_g: 12, carbs_g: 40, fat_g: 10 });
  });

  it("counts everything cooked as eaten for a meal logged before portions existed", () => {
    const l = log({ kcal: 800, protein_g: 30, servings: 2, portions: null });
    expect(portionsOf(l)).toBe(2);
    expect(perPortion(l)).toEqual({ kcal: 400, protein_g: 15, carbs_g: null, fat_g: null });
  });
});

describe("the last 7 days", () => {
  const logs = [
    log({ kcal: 700, protein_g: 30, carbs_g: 80, fat_g: 20, cooked_at: "2026-03-10T12:00:00" }),
    log({ kcal: 500, protein_g: 20, carbs_g: 50, fat_g: 10, cooked_at: "2026-03-10T08:00:00" }),
    log({ kcal: 900, protein_g: 40, cooked_at: "2026-03-07T20:00:00" }),
    log({ kcal: 999, protein_g: 99, cooked_at: "2026-03-03T20:00:00" }), // 7 days back: outside
    log({ kcal: 400, protein_g: 10, cooked_at: "2026-03-09T20:00:00", undone_at: "2026-03-09T20:01:00" }),
  ];

  it("gives seven days, oldest first, today last, with zeros for empty days", () => {
    const days = lastDays(logs, now);
    expect(days.map((d) => d.key)).toEqual(["2026-03-04", "2026-03-05", "2026-03-06", "2026-03-07", "2026-03-08", "2026-03-09", "2026-03-10"]);
    expect(days.map((d) => d.kcal)).toEqual([0, 0, 0, 900, 0, 0, 1200]);
    expect(days[6]).toMatchObject({ meals: 2, protein_g: 50, carbs_g: 130, fat_g: 30 });
    expect(days[5]).toMatchObject({ meals: 0, kcal: 0, carbs_g: null });
  });

  it("sums the week and averages over the days with meals", () => {
    const w = weekSummary(lastDays(logs, now));
    expect(w.total).toMatchObject({ meals: 3, kcal: 2100, protein_g: 90, carbs_g: 130, fat_g: 30 });
    expect(w.activeDays).toBe(2);
    expect(w.averageKcal).toBe(1050);
  });

  it("lists the meals of the week without undone ones, newest first", () => {
    expect(recentMeals(logs, now).map((l) => l.kcal)).toEqual([700, 500, 900]);
  });

  it("is empty-safe", () => {
    expect(weekSummary(lastDays([], now))).toMatchObject({ activeDays: 0, averageKcal: 0, total: { kcal: 0, carbs_g: null } });
  });
});
