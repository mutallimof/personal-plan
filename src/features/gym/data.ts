import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { SetRow } from "./workout";

export type Exercise = Tables<"exercises">;
export type SessionExercise = Tables<"session_exercises"> & { exercise: Exercise };
export type Session = Tables<"sessions"> & { items: SessionExercise[] };
export type Scheduled = Tables<"scheduled_sessions">;
export type Profile = Tables<"profiles">;
export type WorkoutLog = Tables<"workout_logs">;
export type WorkoutSet = Tables<"workout_sets">;
export type BodyWeight = Tables<"body_weight_logs">;

export const MUSCLE_GROUPS = ["chest", "back", "shoulders", "arms", "core", "legs"] as const;
export const EQUIPMENT = ["dumbbell", "barbell", "cable", "machine", "bodyweight", "other"] as const;

async function uid() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

function checkRow<T>(res: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw new Error(res.error.message);
  if (res.data == null) throw new Error("No data returned");
  return res.data;
}

export const exercisesQuery = queryOptions({
  queryKey: ["gym", "exercises"],
  staleTime: 1000 * 60 * 30,
  queryFn: async () => check(await supabase.from("exercises").select("*").order("name")) ?? [],
});

export const planQuery = queryOptions({
  queryKey: ["gym", "plan"],
  queryFn: async (): Promise<Session[]> => {
    const rows = check(
      await supabase
        .from("sessions")
        .select("*, items:session_exercises(*, exercise:exercises(*))")
        .order("position"),
    ) as unknown as Session[];
    return rows.map((s) => ({ ...s, items: [...s.items].sort((a, b) => a.position - b.position) }));
  },
});

export const scheduleQuery = (from: string, to: string) =>
  queryOptions({
    queryKey: ["gym", "schedule", from, to],
    queryFn: async () =>
      check(await supabase.from("scheduled_sessions").select("*").gte("date", from).lte("date", to).order("date")),
  });

export const profileQuery = queryOptions({
  queryKey: ["gym", "profile"],
  queryFn: async () => {
    const id = await uid();
    return check(await supabase.from("profiles").select("*").eq("id", id).maybeSingle());
  },
});

/** Latest finished workouts, newest first. */
export const logsQuery = queryOptions({
  queryKey: ["gym", "logs"],
  queryFn: async () =>
    check(await supabase.from("workout_logs").select("*").order("finished_at", { ascending: false }).limit(60)) ?? [],
});

/** Sets of the given exercises from the latest workouts. Empty id list -> no request. */
export const historyQuery = (exerciseIds: string[]) =>
  queryOptions({
    queryKey: ["gym", "history", [...exerciseIds].sort().join(",")],
    enabled: exerciseIds.length > 0,
    queryFn: async (): Promise<{ logs: WorkoutLog[]; sets: WorkoutSet[] }> => {
      const logs =
        check(await supabase.from("workout_logs").select("*").order("finished_at", { ascending: false }).limit(60)) ?? [];
      if (!logs.length) return { logs, sets: [] };
      const sets =
        check(
          await supabase
            .from("workout_sets")
            .select("*")
            .in("log_id", logs.map((l) => l.id))
            .in("exercise_id", exerciseIds),
        ) ?? [];
      return { logs, sets };
    },
  });

export const bodyWeightQuery = queryOptions({
  queryKey: ["gym", "body-weight"],
  queryFn: async () =>
    check(await supabase.from("body_weight_logs").select("*").order("date", { ascending: true }).limit(260)) ?? [],
});

export function useInvalidateGym() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["gym"] });
}

// ---------- mutations (manual edits) ----------
export const gym = {
  async updateItem(id: string, patch: Partial<Tables<"session_exercises">>) {
    check(await supabase.from("session_exercises").update(patch).eq("id", id));
  },
  async removeItem(id: string) {
    check(await supabase.from("session_exercises").delete().eq("id", id));
  },
  async addItem(
    sessionId: string,
    exerciseId: string,
    position: number,
    opts: { sets?: number; reps?: string; weight_kg?: number | null } = {},
  ) {
    const user_id = await uid();
    check(
      await supabase.from("session_exercises").insert({
        user_id,
        session_id: sessionId,
        exercise_id: exerciseId,
        position,
        sets: opts.sets ?? 3,
        reps: opts.reps ?? "8-12",
        weight_kg: opts.weight_kg ?? null,
      }),
    );
  },
  async reorder(items: { id: string }[]) {
    await Promise.all(
      items.map((it, i) => supabase.from("session_exercises").update({ position: i }).eq("id", it.id)),
    );
  },
  async createSession(name: string, position: number) {
    const user_id = await uid();
    return checkRow(await supabase.from("sessions").insert({ user_id, name, position }).select().single());
  },
  async renameSession(id: string, name: string) {
    check(await supabase.from("sessions").update({ name }).eq("id", id));
  },
  async deleteSession(id: string) {
    // select the deleted row: a delete that matches nothing (not yours, already gone) is not an error to the database
    const rows = check(await supabase.from("sessions").delete().eq("id", id).select("id"));
    if (!rows?.length) throw new Error("Could not delete this day. Reload and try again.");
  },
  async schedule(sessionId: string, date: string) {
    const user_id = await uid();
    check(await supabase.from("scheduled_sessions").insert({ user_id, session_id: sessionId, date }));
  },
  async moveScheduled(id: string, date: string) {
    check(await supabase.from("scheduled_sessions").update({ date }).eq("id", id));
  },
  async unschedule(id: string) {
    check(await supabase.from("scheduled_sessions").delete().eq("id", id));
  },
  /** Save a finished workout. If the sets fail to save, the empty log is removed again. */
  async saveWorkout(input: { sessionId: string; sessionName: string; startedAt: string; sets: SetRow[] }) {
    const user_id = await uid();
    const log = checkRow(
      await supabase
        .from("workout_logs")
        .insert({
          user_id,
          session_id: input.sessionId,
          session_name: input.sessionName,
          started_at: input.startedAt,
          finished_at: new Date().toISOString(),
        })
        .select()
        .single(),
    );
    const { error } = await supabase
      .from("workout_sets")
      .insert(input.sets.map((s) => ({ ...s, user_id, log_id: log.id })));
    if (error) {
      await supabase.from("workout_logs").delete().eq("id", log.id);
      throw new Error(error.message);
    }
    return log;
  },
  async duplicateSession(session: Session, position: number) {
    const copy = await gym.createSession(`${session.name} copy`, position);
    const user_id = await uid();
    if (session.items.length) {
      const { error } = await supabase.from("session_exercises").insert(
        session.items.map((it, i) => ({
          user_id,
          session_id: copy.id,
          exercise_id: it.exercise_id,
          position: i,
          sets: it.sets,
          reps: it.reps,
          weight_kg: it.weight_kg,
          weight_note: it.weight_note,
        })),
      );
      if (error) {
        await supabase.from("sessions").delete().eq("id", copy.id);
        throw new Error(error.message);
      }
    }
    return copy;
  },
  async saveBodyWeight(date: string, weight_kg: number) {
    const user_id = await uid();
    check(await supabase.from("body_weight_logs").upsert({ user_id, date, weight_kg }, { onConflict: "user_id,date" }));
  },
  async deleteBodyWeight(id: string) {
    check(await supabase.from("body_weight_logs").delete().eq("id", id));
  },
  async seedExample() {
    check(await supabase.rpc("seed_example_plan"));
  },
  async saveProfile(patch: Partial<Profile>) {
    const id = await uid();
    check(await supabase.from("profiles").upsert({ id, ...patch }));
  },
};

export function formatWeight(it: Pick<SessionExercise, "weight_kg" | "weight_note">) {
  const w = it.weight_kg != null ? `${it.weight_kg} kg` : "";
  const note = it.weight_note ?? "";
  if (note.endsWith("+")) return `${note} ${w}`.trim();
  return [w, note].filter(Boolean).join(" ");
}
