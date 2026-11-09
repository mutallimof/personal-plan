/** Pure progress rules. No network, no React. */

export type LoggedSet = {
  exercise_id: string;
  log_id: string;
  set_number: number;
  planned_reps: string | null;
  reps: number | null;
  weight_kg: number | null;
  done: boolean;
};

export type LogMeta = { id: string; finished_at: string };

/** One exercise as performed in one workout. */
export type ExerciseSession = { logId: string; date: string; sets: LoggedSet[] };

/** "8-12" -> {min 8, max 12}; "10" -> {10, 10}; "12+" -> {12, 12}; "AMRAP" -> null. */
export function parseRepRange(reps: string | null | undefined): { min: number; max: number } | null {
  const nums = (reps ?? "").match(/\d+/g)?.map(Number);
  if (!nums?.length) return null;
  return { min: nums[0]!, max: nums[nums.length - 1]! };
}

/** Sessions of one exercise, newest first. */
export function sessionsFor(exerciseId: string, sets: LoggedSet[], logs: LogMeta[]): ExerciseSession[] {
  const byLog = new Map<string, LoggedSet[]>();
  for (const s of sets) {
    if (s.exercise_id !== exerciseId) continue;
    const list = byLog.get(s.log_id) ?? [];
    list.push(s);
    byLog.set(s.log_id, list);
  }
  return logs
    .filter((l) => byLog.has(l.id))
    .sort((a, b) => b.finished_at.localeCompare(a.finished_at))
    .map((l) => ({
      logId: l.id,
      date: l.finished_at,
      sets: [...byLog.get(l.id)!].sort((a, b) => a.set_number - b.set_number),
    }));
}

export function topWeight(s: ExerciseSession): number | null {
  const w = s.sets.filter((x) => x.done && x.weight_kg != null).map((x) => x.weight_kg!);
  return w.length ? Math.max(...w) : null;
}

/** Every set done, each at or above the top of its planned rep range. */
export function hitTopOfRange(s: ExerciseSession): boolean {
  if (!s.sets.length) return false;
  return s.sets.every((x) => {
    const range = parseRepRange(x.planned_reps);
    return x.done && range != null && x.reps != null && x.reps >= range.max;
  });
}

/**
 * "Ready to go up": the last two logged sessions both hit the top of the rep range on all sets,
 * at the same top weight (if the weight already went up in between, it has not been earned again).
 */
export function readyToGoUp(sessionsNewestFirst: ExerciseSession[]): boolean {
  const [a, b] = sessionsNewestFirst;
  if (!a || !b) return false;
  return hitTopOfRange(a) && hitTopOfRange(b) && topWeight(a) === topWeight(b);
}

export type ChartPoint = { date: string; weight: number | null; reps: number | null };

/** Oldest first, for charts. Reps is the average over done sets. */
export function chartPoints(sessionsNewestFirst: ExerciseSession[]): ChartPoint[] {
  return [...sessionsNewestFirst].reverse().map((s) => {
    const done = s.sets.filter((x) => x.done && x.reps != null);
    const reps = done.length ? Math.round((done.reduce((n, x) => n + x.reps!, 0) / done.length) * 10) / 10 : null;
    return { date: s.date, weight: topWeight(s), reps };
  });
}

export type PlannedItem = { id: string; exercise_id: string; sets: number; weight_kg: number | null };
export type PerformedExercise = { exercise_id: string; sets: { done: boolean; weight_kg: number | null }[] };
export type WeightUpdate = { itemId: string; exerciseId: string; from: number; to: number };

/** Items where every planned set was done and the heaviest set beat the planned weight. */
export function weightUpdates(items: PlannedItem[], performed: PerformedExercise[]): WeightUpdate[] {
  const out: WeightUpdate[] = [];
  for (const item of items) {
    if (item.weight_kg == null) continue;
    const p = performed.find((x) => x.exercise_id === item.exercise_id);
    if (!p) continue;
    const done = p.sets.filter((s) => s.done);
    if (done.length < item.sets) continue;
    const heaviest = Math.max(...done.map((s) => s.weight_kg ?? 0));
    if (heaviest > item.weight_kg) out.push({ itemId: item.id, exerciseId: item.exercise_id, from: item.weight_kg, to: heaviest });
  }
  return out;
}
