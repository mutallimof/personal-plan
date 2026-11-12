import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loading, QueryError } from "@/components/states";
import { cn } from "@/lib/utils";
import { canUndo, lastDays, perPortion, portionsOf, recentMeals, weekSummary, type CookedLog, type DayBar, type Totals } from "./cooked";
import { cook, cookedQuery, useInvalidateCook } from "./data";
import { approxLabel, formatAmounts } from "./nutrition";

/** The app is in English, so dates and numbers are too (the same on every computer). */
const LOCALE = "en-GB";
const dayName = (d: Date) => d.toLocaleDateString(LOCALE, { weekday: "short" });
const dayLong = (d: Date) => d.toLocaleDateString(LOCALE, { weekday: "long", day: "numeric", month: "short" });
const kcalText = (n: number) => `${Math.round(n).toLocaleString(LOCALE)} kcal`;
const portionText = (n: number) => `${Math.round(n * 100) / 100} ${n === 1 ? "portion" : "portions"}`;

/** "1,240 kcal · 62 g protein · 150 g carbs · 40 g fat": carbs and fat only when the table has them. */
export const totalsText = (t: Pick<Totals, "kcal" | "protein_g" | "carbs_g" | "fat_g">) => formatAmounts(t);

/**
 * What you ate, from the meals you cooked and logged: today, the last 7 days as a bar chart (with a table of the same
 * numbers), and the meals themselves with Undo (within 10 minutes: also puts the food back) or Remove (takes the meal
 * out of the numbers only). Every number comes from the nutrition table at the time of cooking.
 */
export function EatenSection() {
  const logs = useQuery(cookedQuery);
  const [now] = useState(() => new Date());

  if (logs.isLoading) return <Loading rows={2} className="h-20" />;
  if (logs.isError || !logs.data) return <QueryError onRetry={() => void logs.refetch()} />;

  const days = lastDays(logs.data, now);
  const today = days[days.length - 1] as DayBar;
  const week = weekSummary(days);
  const meals = recentMeals(logs.data, now);

  return (
    <section className="space-y-4" aria-label="What I ate">
      <h2 className="text-xl font-semibold">Eaten</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="tile p-4">
          <p className="eyebrow">Today</p>
          <p className="font-heading text-3xl font-bold tabular-nums">{kcalText(today.kcal)}</p>
          {today.meals > 0 ? (
            <p className="text-sm text-muted-foreground">
              {totalsText({ ...today, kcal: today.kcal }).split(" · ").slice(1).join(" · ")} ({approxLabel(today.missing)})
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing logged yet. Cook a recipe to log it.</p>
          )}
        </div>
        <div className="tile p-4">
          <p className="eyebrow">Last 7 days</p>
          <p className="font-heading text-3xl font-bold tabular-nums">{kcalText(week.total.kcal)}</p>
          <p className="text-sm text-muted-foreground">
            {week.activeDays > 0
              ? `${totalsText(week.total).split(" · ").slice(1).join(" · ")} · about ${kcalText(week.averageKcal)} a day`
              : "Nothing logged this week."}
          </p>
        </div>
      </div>

      <WeekChart days={days} />

      {meals.length > 0 && <MealLog meals={meals} now={now} />}
    </section>
  );
}

function WeekChart({ days }: { days: readonly DayBar[] }) {
  const [active, setActive] = useState<number>(days.length - 1);
  const W = 320;
  const H = 150;
  const TOP = 20;
  const BASE = H - 22;
  const slot = W / days.length;
  const bar = 26;
  const max = Math.max(1, ...days.map((d) => d.kcal));
  const shown = days[active] ?? days[days.length - 1];

  return (
    <div className="space-y-2 tile p-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="group" aria-label="Energy eaten on each of the last 7 days">
        <line x1={0} x2={W} y1={BASE} y2={BASE} className="stroke-border" strokeWidth={1} />
        {days.map((d, i) => {
          const h = d.kcal > 0 ? Math.max(3, (d.kcal / max) * (BASE - TOP)) : 0;
          const x = i * slot + (slot - bar) / 2;
          const isToday = i === days.length - 1;
          const selected = i === active;
          return (
            <g
              key={d.key}
              role="button"
              tabIndex={0}
              aria-label={`${dayLong(d.date)}: ${kcalText(d.kcal)}`}
              aria-pressed={selected}
              className="cursor-pointer outline-none [&:focus-visible_rect[data-hit]]:stroke-ring"
              onClick={() => setActive(i)}
              onFocus={() => setActive(i)}
              onMouseEnter={() => setActive(i)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setActive(i)}
            >
              {/* a hit area wider and taller than the bar */}
              <rect data-hit x={i * slot} y={0} width={slot} height={H} fill="transparent" strokeWidth={1.5} rx={4} />
              {h > 0 ? (
                <>
                  <rect x={x} y={BASE - h} width={bar} height={h} rx={6} className={selected ? "fill-primary" : "fill-primary-soft"} />
                  {/* square off the bottom so the bar sits flat on the baseline */}
                  <rect x={x} y={BASE - Math.min(6, h)} width={bar} height={Math.min(6, h)} className={selected ? "fill-primary" : "fill-primary-soft"} />
                </>
              ) : (
                <rect x={x} y={BASE - 2} width={bar} height={2} className="fill-muted-foreground opacity-40" />
              )}
              {(selected || d.kcal === max) && d.kcal > 0 && (
                <text x={x + bar / 2} y={BASE - h - 5} textAnchor="middle" className="fill-foreground text-[10px] font-medium">
                  {Math.round(d.kcal).toLocaleString(LOCALE)}
                </text>
              )}
              <text x={x + bar / 2} y={H - 6} textAnchor="middle" className={cn("text-[10px]", isToday ? "fill-foreground font-semibold" : "fill-muted-foreground")}>
                {dayName(d.date)}
              </text>
            </g>
          );
        })}
      </svg>
      {shown && (
        <p className="text-sm" aria-live="polite">
          <span className="font-medium">{dayLong(shown.date)}</span>
          {shown.meals > 0 ? `: ${totalsText(shown)} (${approxLabel(shown.missing)})` : ": nothing logged"}
        </p>
      )}
      <details className="text-sm">
        <summary className="min-h-8 cursor-pointer text-muted-foreground">Table</summary>
        <table className="mt-2 w-full text-left tabular-nums">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="py-1 font-normal">Day</th>
              <th className="py-1 font-normal">kcal</th>
              <th className="py-1 font-normal">Protein</th>
              <th className="py-1 font-normal">Carbs</th>
              <th className="py-1 font-normal">Fat</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.key}>
                <td className="py-1">{dayLong(d.date)}</td>
                <td className="py-1">{Math.round(d.kcal)}</td>
                <td className="py-1">{Math.round(d.protein_g)} g</td>
                <td className="py-1">{d.carbs_g === null ? "–" : `${Math.round(d.carbs_g)} g`}</td>
                <td className="py-1">{d.fat_g === null ? "–" : `${Math.round(d.fat_g)} g`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

function MealLog({ meals, now }: { meals: readonly CookedLog[]; now: Date }) {
  const invalidate = useInvalidateCook();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(id: string, action: () => Promise<void>, done: string) {
    setBusy(id);
    try {
      await action();
      await invalidate();
      toast.success(done);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not change the log");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <h3 className="eyebrow px-1">Logged meals</h3>
      <ul className="space-y-2">
        {meals.map((m) => {
          const recent = canUndo(m, now);
          return (
            <li key={m.id} className="flex items-center justify-between gap-3 tile p-4 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium">{m.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {new Date(m.cooked_at).toLocaleString(LOCALE, { weekday: "short", hour: "2-digit", minute: "2-digit" })} · {portionText(portionsOf(m))}
                </span>
                <span className="block text-xs text-muted-foreground">{formatAmounts(perPortion(m))} per portion</span>
              </span>
              <Button
                variant="outline"
                className="h-11 shrink-0"
                disabled={busy === m.id}
                aria-label={`${recent ? "Undo" : "Remove"} ${m.title}`}
                onClick={() => void (recent ? run(m.id, () => cook.undoCook(m.id), "Undone. The food is back in your pantry.") : run(m.id, () => cook.removeFromLog(m.id), "Removed from the log. Your pantry was not changed."))}
              >
                {recent ? "Undo" : "Remove"}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
