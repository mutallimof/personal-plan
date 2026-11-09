import { describe, expect, it } from "vitest";
import { draftFromPlan, estimateMinutes, setRowsFromDraft, suggestNext } from "./workout";

const item = (o: Record<string, unknown> = {}) => ({
  id: "i1",
  exercise_id: "e1",
  sets: 3,
  reps: "8-12",
  weight_kg: 20 as number | null,
  exercise: { name: "Bench" },
  ...o,
});

describe("draftFromPlan", () => {
  it("starts every set from the plan and not done", () => {
    const [d] = draftFromPlan([item()]);
    expect(d!.sets).toEqual(Array(3).fill({ done: false, reps: "8", weight: "20" }));
  });
  it("leaves reps and weight empty when the plan has none", () => {
    const [d] = draftFromPlan([item({ reps: "AMRAP", weight_kg: null, sets: 1 })]);
    expect(d!.sets).toEqual([{ done: false, reps: "", weight: "" }]);
  });
});

describe("setRowsFromDraft", () => {
  it("makes one row per set with numbers parsed and planned values kept", () => {
    const draft = draftFromPlan([item({ sets: 2 }), item({ id: "i2", exercise_id: "e2" })]);
    draft[0]!.sets[0] = { done: true, reps: "10", weight: "22.5" };
    draft[0]!.sets[1] = { done: false, reps: "", weight: "abc" };
    const rows = setRowsFromDraft(draft);
    expect(rows).toHaveLength(5);
    expect(rows[0]).toEqual({
      exercise_id: "e1",
      position: 0,
      set_number: 1,
      planned_reps: "8-12",
      planned_weight_kg: 20,
      reps: 10,
      weight_kg: 22.5,
      done: true,
    });
    expect(rows[1]).toMatchObject({ set_number: 2, reps: null, weight_kg: null, done: false });
    expect(rows[2]).toMatchObject({ exercise_id: "e2", position: 1, set_number: 1 });
  });
  it("rejects negative numbers", () => {
    const draft = draftFromPlan([item({ sets: 1 })]);
    draft[0]!.sets[0] = { done: true, reps: "-3", weight: "-5" };
    expect(setRowsFromDraft(draft)[0]).toMatchObject({ reps: null, weight_kg: null });
  });
});

describe("estimateMinutes", () => {
  it("is 0 for an empty session and rounds to 5 minutes", () => {
    expect(estimateMinutes([])).toBe(0);
    expect(estimateMinutes([{ sets: 3 }, { sets: 3 }, { sets: 3 }, { sets: 3 }])).toBe(30);
  });
});

describe("suggestNext", () => {
  const sessions = [{ id: "a" }, { id: "b" }, { id: "c" }];
  it("starts with the first session when nothing was logged", () => {
    expect(suggestNext(sessions, [])).toEqual({ session: sessions[0], reason: "first" });
  });
  it("suggests the session after the last one done, wrapping around", () => {
    expect(suggestNext(sessions, [{ session_id: "a" }])?.session.id).toBe("b");
    expect(suggestNext(sessions, [{ session_id: "c" }, { session_id: "a" }])?.session.id).toBe("a");
  });
  it("ignores logs of deleted sessions", () => {
    const logs = [{ session_id: null }, { session_id: "gone" }, { session_id: "b" }];
    expect(suggestNext(sessions, logs)?.session.id).toBe("c");
  });
  it("returns null without sessions", () => {
    expect(suggestNext([], [{ session_id: "a" }])).toBeNull();
  });
});
