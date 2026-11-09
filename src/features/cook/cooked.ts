import type { Tables } from "@/integrations/supabase/types";

export type CookedLog = Tables<"cooked_log">;

/** How long after cooking the undo is offered (the database function enforces the same limit). */
export const UNDO_MINUTES = 10;

/** Cooked meals that were not undone, newest first. */
export function activeMeals(logs: readonly CookedLog[]): CookedLog[] {
  return logs.filter((l) => !l.undone_at).sort((a, b) => b.cooked_at.localeCompare(a.cooked_at));
}

export const canUndo = (log: CookedLog, now: Date): boolean =>
  !log.undone_at && now.getTime() - new Date(log.cooked_at).getTime() < UNDO_MINUTES * 60_000;

const sameDay = (iso: string, now: Date) => {
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
};

export type DayTotals = {
  meals: number;
  kcal: number;
  protein_g: number;
  /** Ingredients without nutrition data across today's meals; the totals leave them out. */
  missing: number;
};

/** Energy and protein of the meals cooked today (local time), from the snapshot saved with each meal. Approximate. */
export function todayTotals(logs: readonly CookedLog[], now: Date): DayTotals {
  const today = activeMeals(logs).filter((l) => sameDay(l.cooked_at, now));
  return {
    meals: today.length,
    kcal: today.reduce((s, l) => s + (l.kcal ?? 0), 0),
    protein_g: today.reduce((s, l) => s + (l.protein_g ?? 0), 0),
    missing: today.reduce((s, l) => s + l.kcal_missing, 0),
  };
}
