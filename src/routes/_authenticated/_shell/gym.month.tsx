import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QueryError } from "@/components/states";
import { cn } from "@/lib/utils";
import { planQuery, scheduleQuery } from "@/features/gym/data";
import { WEEKDAYS, fromISO, monthGrid, toISO } from "@/features/gym/dates";
import {
  PeriodNav,
  SessionPicker,
  useScheduleActions,
  validateDateSearch,
} from "@/features/gym/schedule-ui";

export const Route = createFileRoute("/_authenticated/_shell/gym/month")({
  validateSearch: validateDateSearch,
  head: () => ({ meta: [{ title: "Month — Lifeplan" }] }),
  component: MonthPage,
});

function MonthPage() {
  const { d } = Route.useSearch();
  const navigate = Route.useNavigate();
  const anchor = d ? fromISO(d) : new Date();
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const grid = monthGrid(year, month);
  const first = toISO(grid[0] ?? anchor);
  const last = toISO(grid[grid.length - 1] ?? anchor);
  const todayISO = toISO(new Date());

  const { data: sessions = [] } = useQuery(planQuery);
  const schedQuery = useQuery(scheduleQuery(first, last));
  const scheduled = schedQuery.data;
  const actions = useScheduleActions();
  const [selected, setSelected] = useState<string | null>(null);

  const names = useMemo(() => new Map(sessions.map((s) => [s.id, s.name])), [sessions]);
  const byDate = useMemo(() => {
    const m = new Map<string, { id: string; name: string }[]>();
    for (const r of scheduled ?? []) {
      const name = names.get(r.session_id);
      if (!name) continue;
      m.set(r.date, [...(m.get(r.date) ?? []), { id: r.id, name }]);
    }
    return m;
  }, [scheduled, names]);

  const go = (date: Date) => navigate({ search: { d: toISO(date) } });
  const selectedEntries = selected ? (byDate.get(selected) ?? []) : [];

  return (
    <div className="space-y-4">
      <PeriodNav
        unit="month"
        title={anchor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        onPrev={() => go(new Date(year, month - 1, 1))}
        onNext={() => go(new Date(year, month + 1, 1))}
        onToday={() => go(new Date())}
      />
      {schedQuery.isError && <QueryError onRetry={() => schedQuery.refetch()} />}
      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="grid grid-cols-7 border-b text-center text-xs font-medium text-muted-foreground">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-2">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {grid.map((day) => {
            const iso = toISO(day);
            const entries = byDate.get(iso) ?? [];
            const inMonth = day.getMonth() === month;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => setSelected(iso)}
                aria-label={`${day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}, ${entries.length} sessions`}
                className={cn(
                  "flex min-h-16 flex-col items-stretch gap-1 border-b border-r p-1.5 text-left transition-colors hover:bg-accent sm:min-h-24",
                  !inMonth && "bg-background/60 text-muted-foreground/60",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center self-start rounded-full text-xs font-medium",
                    iso === todayISO && "bg-primary text-primary-foreground",
                  )}
                >
                  {day.getDate()}
                </span>
                <span className="flex flex-wrap gap-1 sm:hidden">
                  {entries.slice(0, 4).map((e) => (
                    <span key={e.id} className="h-2 w-2 rounded-full bg-primary" />
                  ))}
                </span>
                <span className="hidden flex-col gap-1 sm:flex">
                  {entries.slice(0, 2).map((e) => (
                    <span
                      key={e.id}
                      className="truncate rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground"
                    >
                      {e.name}
                    </span>
                  ))}
                  {entries.length > 2 && (
                    <span className="px-1 text-xs text-muted-foreground">
                      +{entries.length - 2} more
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selected &&
                fromISO(selected).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              {selectedEntries.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between rounded-full bg-accent pl-4 text-sm font-medium text-accent-foreground"
                >
                  {e.name}
                  <button
                    type="button"
                    aria-label={`Remove ${e.name}`}
                    onClick={() => void actions.remove(e.id)}
                    className="flex h-11 w-11 items-center justify-center"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {!selectedEntries.length && (
                <p className="text-sm text-muted-foreground">Nothing planned.</p>
              )}
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Add a session</p>
              <SessionPicker onPick={(id) => selected && void actions.schedule(id, selected)} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
