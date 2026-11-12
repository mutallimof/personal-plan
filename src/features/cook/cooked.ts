import type { Tables } from "@/integrations/supabase/types";
import type { Amounts } from "./nutrition";

export type CookedLog = Tables<"cooked_log">;

/** How long after cooking the undo is offered (the database function enforces the same limit). */
export const UNDO_MINUTES = 10;

/** Cooked meals that were not undone, newest first. */
export function activeMeals(logs: readonly CookedLog[]): CookedLog[] {
  return logs.filter((l) => !l.undone_at).sort((a, b) => b.cooked_at.localeCompare(a.cooked_at));
}

export const canUndo = (log: CookedLog, now: Date): boolean =>
  !log.undone_at && now.getTime() - new Date(log.cooked_at).getTime() < UNDO_MINUTES * 60_000;

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const sameDay = (iso: string, now: Date) => dayKey(new Date(iso)) === dayKey(now);

/** What a log counts as eaten: the numbers saved with it. Carbs and fat are null when the table had none. */
export const eatenOf = (l: CookedLog): Amounts => ({ kcal: l.kcal ?? 0, protein_g: l.protein_g ?? 0, carbs_g: l.carbs_g, fat_g: l.fat_g });

/** Portions eaten: what was entered, or (for meals logged before portions existed) everything that was cooked. */
export const portionsOf = (l: CookedLog): number => (l.portions && l.portions > 0 ? l.portions : l.servings);

/** The numbers of one portion of a logged meal. */
export function perPortion(l: CookedLog): Amounts {
  const n = portionsOf(l);
  const e = eatenOf(l);
  return { kcal: e.kcal / n, protein_g: e.protein_g / n, carbs_g: e.carbs_g === null ? null : e.carbs_g / n, fat_g: e.fat_g === null ? null : e.fat_g / n };
}

export type Totals = {
  meals: number;
  kcal: number;
  protein_g: number;
  /** Null when none of the meals has carbs (the table did not have them); otherwise the sum of those that do. */
  carbs_g: number | null;
  fat_g: number | null;
  /** Ingredients without nutrition data across the meals; the totals leave them out. */
  missing: number;
};
export type DayTotals = Totals;

/** Adds up meals. Undone meals must be left out by the caller (see `activeMeals`). */
export function sumMeals(meals: readonly CookedLog[]): Totals {
  const known = (pick: (l: CookedLog) => number | null) => {
    const vals = meals.map(pick).filter((v): v is number => v !== null);
    return vals.length ? vals.reduce((s, v) => s + v, 0) : null;
  };
  return {
    meals: meals.length,
    kcal: meals.reduce((s, l) => s + (l.kcal ?? 0), 0),
    protein_g: meals.reduce((s, l) => s + (l.protein_g ?? 0), 0),
    carbs_g: known((l) => l.carbs_g),
    fat_g: known((l) => l.fat_g),
    missing: meals.reduce((s, l) => s + l.kcal_missing, 0),
  };
}

/** Energy and protein (and carbs and fat when known) of the meals cooked today (local time). Approximate. */
export function todayTotals(logs: readonly CookedLog[], now: Date): Totals {
  return sumMeals(activeMeals(logs).filter((l) => sameDay(l.cooked_at, now)));
}

export type DayBar = Totals & { key: string; date: Date };

/** The last `count` days ending today, oldest first, each with what was eaten that day (days with nothing are zero). */
export function lastDays(logs: readonly CookedLog[], now: Date, count = 7): DayBar[] {
  const meals = activeMeals(logs);
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (count - 1 - i));
    return { key: dayKey(date), date, ...sumMeals(meals.filter((l) => sameDay(l.cooked_at, date))) };
  });
}

/** Totals over the days of `lastDays`, and the average per day that has at least one meal. */
export function weekSummary(days: readonly DayBar[]): { total: Totals; averageKcal: number; activeDays: number } {
  const sum = (pick: (d: DayBar) => number) => days.reduce((s, d) => s + pick(d), 0);
  const known = (pick: (d: DayBar) => number | null) => {
    const vals = days.map(pick).filter((v): v is number => v !== null);
    return vals.length ? vals.reduce((s, v) => s + v, 0) : null;
  };
  const activeDays = days.filter((d) => d.meals > 0).length;
  const kcal = sum((d) => d.kcal);
  return {
    total: { meals: sum((d) => d.meals), kcal, protein_g: sum((d) => d.protein_g), carbs_g: known((d) => d.carbs_g), fat_g: known((d) => d.fat_g), missing: sum((d) => d.missing) },
    averageKcal: activeDays ? kcal / activeDays : 0,
    activeDays,
  };
}

/** Logged meals of the last `count` days (today included), newest first, undone ones left out. */
export function recentMeals(logs: readonly CookedLog[], now: Date, count = 7): CookedLog[] {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (count - 1)).getTime();
  return activeMeals(logs).filter((l) => new Date(l.cooked_at).getTime() >= from);
}
