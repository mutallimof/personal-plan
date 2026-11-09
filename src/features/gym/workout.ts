import { parseRepRange } from "./progress";

export type DraftSet = { done: boolean; reps: string; weight: string };
export type DraftExercise = { itemId: string; exerciseId: string; name: string; plannedReps: string; plannedWeight: number | null; sets: DraftSet[] };

type PlanItem = {
  id: string;
  exercise_id: string;
  sets: number;
  reps: string;
  weight_kg: number | null;
  exercise: { name: string };
};

/** Start every set from the plan: lower end of the rep range, planned weight, not done. */
export function draftFromPlan(items: PlanItem[]): DraftExercise[] {
  return items.map((it) => {
    const range = parseRepRange(it.reps);
    return {
      itemId: it.id,
      exerciseId: it.exercise_id,
      name: it.exercise.name,
      plannedReps: it.reps,
      plannedWeight: it.weight_kg,
      sets: Array.from({ length: Math.max(1, it.sets) }, () => ({
        done: false,
        reps: range ? String(range.min) : "",
        weight: it.weight_kg != null ? String(it.weight_kg) : "",
      })),
    };
  });
}

const num = (s: string): number | null => {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export type SetRow = {
  exercise_id: string;
  position: number;
  set_number: number;
  planned_reps: string;
  planned_weight_kg: number | null;
  reps: number | null;
  weight_kg: number | null;
  done: boolean;
};

/** Flatten the draft into one row per set, ready to insert. */
export function setRowsFromDraft(draft: DraftExercise[]): SetRow[] {
  return draft.flatMap((ex, position) =>
    ex.sets.map((s, i) => ({
      exercise_id: ex.exerciseId,
      position,
      set_number: i + 1,
      planned_reps: ex.plannedReps,
      planned_weight_kg: ex.plannedWeight,
      reps: num(s.reps) == null ? null : Math.round(num(s.reps)!),
      weight_kg: num(s.weight),
      done: s.done,
    })),
  );
}

/** Rough length: 40 s working + 90 s rest per set, 1 min setup per exercise. Rounded to 5 min. */
export function estimateMinutes(items: { sets: number }[]): number {
  if (!items.length) return 0;
  const seconds = items.reduce((n, it) => n + it.sets * 130 + 60, 0);
  return Math.max(5, Math.round(seconds / 60 / 5) * 5);
}

/** Next session after the one done last, in plan order. Falls back to the first session. */
export function suggestNext<S extends { id: string }>(
  sessions: S[],
  logsNewestFirst: { session_id: string | null }[],
): { session: S; reason: "first" | "after-last" } | null {
  if (!sessions.length) return null;
  const last = logsNewestFirst.find((l) => l.session_id && sessions.some((s) => s.id === l.session_id));
  if (!last) return { session: sessions[0]!, reason: "first" };
  const i = sessions.findIndex((s) => s.id === last.session_id);
  return { session: sessions[(i + 1) % sessions.length]!, reason: "after-last" };
}
