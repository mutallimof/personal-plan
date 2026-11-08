import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesUpdate } from "@/integrations/supabase/types";

type DB = SupabaseClient<Database>;
type Args = Record<string, unknown>;

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});
const str = { type: "string" };
const num = { type: "number" };
const int = { type: "integer" };

export const TOOL_DEFS = [
  { name: "get_plan", description: "Get the user's full plan: profile, sessions with exercises (ids, sets, reps, weight), and schedule for the next weeks.", parameters: obj({}) },
  { name: "search_exercises", description: "Search the exercise library. All filters optional.", parameters: obj({ query: str, muscle_group: str, equipment: str }) },
  { name: "update_item", description: "Update an exercise inside a session (session_exercise id). Only pass fields to change.", parameters: obj({ id: str, sets: int, reps: str, weight_kg: num, weight_note: str }, ["id"]) },
  { name: "swap_exercise", description: "Swap the exercise of a session item for another library exercise, keeping sets/reps/weight.", parameters: obj({ id: str, exercise_id: str }, ["id", "exercise_id"]) },
  { name: "add_exercise", description: "Add a library exercise to a session.", parameters: obj({ session_id: str, exercise_id: str, sets: int, reps: str, weight_kg: num, weight_note: str }, ["session_id", "exercise_id"]) },
  { name: "remove_item", description: "Remove an exercise from a session (session_exercise id).", parameters: obj({ id: str }, ["id"]) },
  { name: "reorder_session", description: "Set the order of a session's items.", parameters: obj({ session_id: str, ordered_item_ids: { type: "array", items: str } }, ["session_id", "ordered_item_ids"]) },
  { name: "create_session", description: "Create a new session. Returns its id.", parameters: obj({ name: str }, ["name"]) },
  { name: "rename_session", description: "Rename a session.", parameters: obj({ id: str, name: str }, ["id", "name"]) },
  { name: "delete_session", description: "Delete a session and its exercises.", parameters: obj({ id: str }, ["id"]) },
  { name: "schedule_session", description: "Place a session on a date (YYYY-MM-DD).", parameters: obj({ session_id: str, date: str }, ["session_id", "date"]) },
  { name: "move_scheduled", description: "Move a scheduled entry to another date.", parameters: obj({ scheduled_id: str, date: str }, ["scheduled_id", "date"]) },
  { name: "unschedule", description: "Remove a scheduled entry.", parameters: obj({ scheduled_id: str }, ["scheduled_id"]) },
  { name: "update_profile", description: "Update profile fields.", parameters: obj({ height_cm: num, weight_kg: num, goal: str, sessions_per_week: int, experience: str }) },
].map((t) => ({ type: "function" as const, ...t, strict: false }));

// Tool arguments come from the model, so every value is checked before it reaches the database.
const optStr = (a: Args, k: string): string | undefined => {
  const v = a[k];
  return typeof v === "string" && v !== "" ? v : undefined;
};
const optNum = (a: Args, k: string): number | undefined => {
  const v = a[k];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
};
const optInt = (a: Args, k: string): number | undefined => {
  const v = optNum(a, k);
  return v !== undefined && Number.isInteger(v) ? v : undefined;
};
const strList = (a: Args, k: string): string[] => {
  const v = a[k];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
};
// Drops undefined entries so optional table columns are simply left out of the update.
type Defined<T> = { [K in keyof T]?: Exclude<T[K], undefined> };
const compact = <T extends object>(o: T): Defined<T> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Defined<T>;

export async function runTool(db: DB, userId: string, name: string, a: Args): Promise<unknown> {
  const s = (k: string) => optStr(a, k) ?? "";
  const fail = (e: { message: string } | null) => {
    if (e) throw new Error(e.message);
  };
  switch (name) {
    case "get_plan": {
      const today = new Date();
      const from = new Date(today.getTime() - 7 * 864e5).toISOString().slice(0, 10);
      const to = new Date(today.getTime() + 42 * 864e5).toISOString().slice(0, 10);
      const [p, sess, sch] = await Promise.all([
        db.from("profiles").select("height_cm,weight_kg,goal,sessions_per_week,experience").eq("id", userId).maybeSingle(),
        db.from("sessions").select("id,name,position,items:session_exercises(id,position,sets,reps,weight_kg,weight_note,exercise:exercises(id,name,equipment,family))").order("position"),
        db.from("scheduled_sessions").select("id,session_id,date").gte("date", from).lte("date", to).order("date"),
      ]);
      return { profile: p.data, sessions: sess.data, schedule: sch.data };
    }
    case "search_exercises": {
      let q = db.from("exercises").select("id,name,family,equipment,muscle_group,primary_muscles,secondary_muscles");
      const query = optStr(a, "query");
      const muscleGroup = optStr(a, "muscle_group");
      const equipment = optStr(a, "equipment");
      if (query) q = q.ilike("name", `%${query}%`);
      if (muscleGroup) q = q.eq("muscle_group", muscleGroup);
      if (equipment) q = q.eq("equipment", equipment);
      const { data, error } = await q.order("name");
      fail(error);
      return data;
    }
    case "update_item": {
      const patch: TablesUpdate<"session_exercises"> = compact({
        sets: optInt(a, "sets"),
        reps: optStr(a, "reps"),
        weight_kg: optNum(a, "weight_kg"),
        weight_note: optStr(a, "weight_note"),
      });
      const { error } = await db.from("session_exercises").update(patch).eq("id", s("id"));
      fail(error);
      return { ok: true };
    }
    case "swap_exercise": {
      const { error } = await db.from("session_exercises").update({ exercise_id: s("exercise_id") }).eq("id", s("id"));
      fail(error);
      return { ok: true };
    }
    case "add_exercise": {
      const { count } = await db.from("session_exercises").select("id", { count: "exact", head: true }).eq("session_id", s("session_id"));
      const { error } = await db.from("session_exercises").insert({
        user_id: userId,
        session_id: s("session_id"),
        exercise_id: s("exercise_id"),
        sets: optInt(a, "sets") ?? 3,
        reps: optStr(a, "reps") ?? "8-12",
        weight_kg: optNum(a, "weight_kg") ?? null,
        weight_note: optStr(a, "weight_note") ?? null,
        position: count ?? 0,
      });
      fail(error);
      return { ok: true };
    }
    case "remove_item": {
      const { error } = await db.from("session_exercises").delete().eq("id", s("id"));
      fail(error);
      return { ok: true };
    }
    case "reorder_session": {
      const ids = strList(a, "ordered_item_ids");
      await Promise.all(ids.map((id, i) => db.from("session_exercises").update({ position: i }).eq("id", id).eq("session_id", s("session_id"))));
      return { ok: true };
    }
    case "create_session": {
      const { count } = await db.from("sessions").select("id", { count: "exact", head: true });
      const { data, error } = await db.from("sessions").insert({ user_id: userId, name: s("name"), position: count ?? 0 }).select("id").single();
      fail(error);
      return data;
    }
    case "rename_session": {
      const { error } = await db.from("sessions").update({ name: s("name") }).eq("id", s("id"));
      fail(error);
      return { ok: true };
    }
    case "delete_session": {
      const { error } = await db.from("sessions").delete().eq("id", s("id"));
      fail(error);
      return { ok: true };
    }
    case "schedule_session": {
      const { error } = await db.from("scheduled_sessions").insert({ user_id: userId, session_id: s("session_id"), date: s("date") });
      fail(error);
      return { ok: true };
    }
    case "move_scheduled": {
      const { error } = await db.from("scheduled_sessions").update({ date: s("date") }).eq("id", s("scheduled_id"));
      fail(error);
      return { ok: true };
    }
    case "unschedule": {
      const { error } = await db.from("scheduled_sessions").delete().eq("id", s("scheduled_id"));
      fail(error);
      return { ok: true };
    }
    case "update_profile": {
      const patch: TablesUpdate<"profiles"> = compact({
        height_cm: optNum(a, "height_cm"),
        weight_kg: optNum(a, "weight_kg"),
        goal: optStr(a, "goal"),
        sessions_per_week: optInt(a, "sessions_per_week"),
        experience: optStr(a, "experience"),
      });
      const { error } = await db.from("profiles").update(patch).eq("id", userId);
      fail(error);
      return { ok: true };
    }
    default:
      return { error: `unknown tool ${name}` };
  }
}
