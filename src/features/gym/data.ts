import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Exercise = Tables<"exercises">;
export type SessionExercise = Tables<"session_exercises"> & { exercise: Exercise };
export type Session = Tables<"sessions"> & { items: SessionExercise[] };
export type Scheduled = Tables<"scheduled_sessions">;
export type Profile = Tables<"profiles">;

export const MUSCLE_GROUPS = ["chest", "back", "shoulders", "arms", "core", "legs"] as const;
export const EQUIPMENT = ["dumbbell", "barbell", "cable", "machine", "bodyweight"] as const;

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
  async addItem(sessionId: string, exerciseId: string, position: number) {
    const user_id = await uid();
    check(
      await supabase
        .from("session_exercises")
        .insert({ user_id, session_id: sessionId, exercise_id: exerciseId, position, sets: 3, reps: "8-12" }),
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
    check(await supabase.from("sessions").delete().eq("id", id));
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
