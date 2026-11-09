import { describe, expect, it } from "vitest";
import {
  chartPoints,
  hitTopOfRange,
  parseRepRange,
  readyToGoUp,
  sessionsFor,
  weightUpdates,
  type ExerciseSession,
  type LoggedSet,
} from "./progress";

const set = (o: Partial<LoggedSet> = {}): LoggedSet => ({
  exercise_id: "e1",
  log_id: "l1",
  set_number: 1,
  planned_reps: "8-12",
  reps: 12,
  weight_kg: 20,
  done: true,
  ...o,
});
const session = (sets: LoggedSet[], date = "2026-01-01T10:00:00Z"): ExerciseSession => ({ logId: "x", date, sets });

describe("parseRepRange", () => {
  it("reads ranges, single numbers and open-ended text", () => {
    expect(parseRepRange("8-12")).toEqual({ min: 8, max: 12 });
    expect(parseRepRange("8–12")).toEqual({ min: 8, max: 12 });
    expect(parseRepRange("10")).toEqual({ min: 10, max: 10 });
    expect(parseRepRange("12+")).toEqual({ min: 12, max: 12 });
    expect(parseRepRange("AMRAP")).toBeNull();
    expect(parseRepRange(null)).toBeNull();
  });
});

describe("hitTopOfRange", () => {
  it("needs every set done and at the top of the range", () => {
    expect(hitTopOfRange(session([set(), set({ set_number: 2 })]))).toBe(true);
    expect(hitTopOfRange(session([set(), set({ reps: 11 })]))).toBe(false);
    expect(hitTopOfRange(session([set(), set({ done: false })]))).toBe(false);
    expect(hitTopOfRange(session([set({ planned_reps: "AMRAP" })]))).toBe(false);
    expect(hitTopOfRange(session([]))).toBe(false);
  });
});

describe("readyToGoUp", () => {
  const good = (date: string, kg = 20) =>
    session([set({ weight_kg: kg }), set({ weight_kg: kg, set_number: 2 })], date);

  it("is true when the last two sessions both hit the top at the same weight", () => {
    expect(readyToGoUp([good("2026-01-08"), good("2026-01-01")])).toBe(true);
  });
  it("is false with fewer than two sessions", () => {
    expect(readyToGoUp([good("2026-01-08")])).toBe(false);
    expect(readyToGoUp([])).toBe(false);
  });
  it("is false when only the latest session hit the top", () => {
    const miss = session([set({ reps: 9 })], "2026-01-01");
    expect(readyToGoUp([good("2026-01-08"), miss])).toBe(false);
  });
  it("only looks at the last two sessions", () => {
    const miss = session([set({ reps: 9 })], "2025-12-25");
    expect(readyToGoUp([good("2026-01-08"), good("2026-01-01"), miss])).toBe(true);
  });
  it("is false when the weight already went up between the two sessions", () => {
    expect(readyToGoUp([good("2026-01-08", 22.5), good("2026-01-01", 20)])).toBe(false);
  });
});

describe("sessionsFor", () => {
  it("groups one exercise's sets by workout, newest first", () => {
    const sets = [
      set({ log_id: "a", set_number: 2 }),
      set({ log_id: "a", set_number: 1 }),
      set({ log_id: "b" }),
      set({ log_id: "a", exercise_id: "other" }),
    ];
    const logs = [
      { id: "a", finished_at: "2026-01-01T00:00:00Z" },
      { id: "b", finished_at: "2026-01-05T00:00:00Z" },
      { id: "c", finished_at: "2026-01-09T00:00:00Z" },
    ];
    const out = sessionsFor("e1", sets, logs);
    expect(out.map((s) => s.logId)).toEqual(["b", "a"]);
    expect(out[1]!.sets.map((s) => s.set_number)).toEqual([1, 2]);
  });
});

describe("chartPoints", () => {
  it("returns oldest first with top weight and average reps of done sets", () => {
    const newest = session(
      [set({ weight_kg: 25, reps: 10 }), set({ weight_kg: 25, reps: 8 }), set({ done: false, reps: 1 })],
      "2026-02-01",
    );
    const oldest = session([set({ weight_kg: 20, reps: 12 })], "2026-01-01");
    expect(chartPoints([newest, oldest])).toEqual([
      { date: "2026-01-01", weight: 20, reps: 12 },
      { date: "2026-02-01", weight: 25, reps: 9 },
    ]);
  });
});

describe("weightUpdates", () => {
  const items = [{ id: "i1", exercise_id: "e1", sets: 3, weight_kg: 20 as number | null }];
  const sets = (kgs: number[]) => kgs.map((weight_kg) => ({ done: true, weight_kg }));

  it("offers an update when all sets were done and heavier than planned", () => {
    expect(weightUpdates(items, [{ exercise_id: "e1", sets: sets([22.5, 22.5, 22.5]) }])).toEqual([
      { itemId: "i1", exerciseId: "e1", from: 20, to: 22.5 },
    ]);
  });
  it("offers nothing when a set was skipped", () => {
    const skipped = [...sets([25, 25]), { done: false, weight_kg: 25 }];
    expect(weightUpdates(items, [{ exercise_id: "e1", sets: skipped }])).toEqual([]);
  });
  it("offers nothing when the weight is equal, nothing was planned, or the exercise was not logged", () => {
    expect(weightUpdates(items, [{ exercise_id: "e1", sets: sets([20, 20, 20]) }])).toEqual([]);
    const unplanned = [{ ...items[0]!, weight_kg: null }];
    expect(weightUpdates(unplanned, [{ exercise_id: "e1", sets: sets([25, 25, 25]) }])).toEqual([]);
    expect(weightUpdates(items, [])).toEqual([]);
  });
});
