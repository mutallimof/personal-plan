import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: { table: string; op: string; payload?: unknown }[] = [];
let failSets = false;

vi.mock("@/integrations/supabase/client", () => {
  const from = (table: string) => ({
    insert: (payload: unknown) => {
      calls.push({ table, op: "insert", payload });
      if (table === "workout_sets") return Promise.resolve({ error: failSets ? { message: "boom" } : null });
      return { select: () => ({ single: () => Promise.resolve({ data: { id: "log1" }, error: null }) }) };
    },
    delete: () => ({
      eq: (_c: string, id: string) => {
        calls.push({ table, op: "delete", payload: id });
        return Promise.resolve({ error: null });
      },
    }),
  });
  return { supabase: { from, auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) } } };
});

import { gym } from "./data";

const sets = [
  {
    exercise_id: "e1",
    position: 0,
    set_number: 1,
    planned_reps: "8-12",
    planned_weight_kg: 20,
    reps: 10,
    weight_kg: 20,
    done: true,
  },
];

beforeEach(() => {
  calls.length = 0;
  failSets = false;
});

describe("gym.saveWorkout", () => {
  it("saves the log, then its sets tagged with the log and user", async () => {
    const log = await gym.saveWorkout({ sessionId: "s1", sessionName: "Upper A", startedAt: "2026-01-01T10:00:00Z", sets });
    expect(log.id).toBe("log1");
    expect(calls[0]).toMatchObject({
      table: "workout_logs",
      op: "insert",
      payload: { user_id: "u1", session_id: "s1", session_name: "Upper A" },
    });
    expect(calls[1]).toMatchObject({ table: "workout_sets", op: "insert" });
    const rows = calls[1]!.payload as Record<string, unknown>[];
    expect(rows[0]).toMatchObject({ log_id: "log1", user_id: "u1", exercise_id: "e1", reps: 10 });
  });

  it("removes the log again when the sets fail to save", async () => {
    failSets = true;
    await expect(
      gym.saveWorkout({ sessionId: "s1", sessionName: "Upper A", startedAt: "x", sets }),
    ).rejects.toThrow("boom");
    expect(calls.at(-1)).toEqual({ table: "workout_logs", op: "delete", payload: "log1" });
  });
});
