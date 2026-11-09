import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Check, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { QueryError } from "@/components/states";
import { cn } from "@/lib/utils";
import { planQuery, scheduleQuery, type Scheduled, type Session } from "@/features/gym/data";
import { WEEKDAYS, addDays, fromISO, startOfWeek, toISO } from "@/features/gym/dates";
import {
  PeriodNav,
  SessionPicker,
  useScheduleActions,
  validateDateSearch,
} from "@/features/gym/schedule-ui";

export const Route = createFileRoute("/_authenticated/_shell/gym/week")({
  validateSearch: validateDateSearch,
  head: () => ({ meta: [{ title: "Week — Lifeplan" }] }),
  component: WeekPage,
});

const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-US", opts);

function Chip({
  id,
  label,
  placed,
  onRemove,
}: {
  id: string;
  label: string;
  placed?: boolean;
  onRemove?: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex items-center rounded-full bg-accent text-sm text-accent-foreground",
        isDragging && "opacity-40",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="flex min-h-11 min-w-0 flex-1 cursor-grab touch-manipulation items-center gap-1.5 px-3.5 text-left font-medium active:cursor-grabbing"
      >
        {placed && <Check className="h-3.5 w-3.5 shrink-0" aria-label="planned this week" />}
        <span className="truncate">{label}</span>
      </button>
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${label}`}
          onClick={onRemove}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-accent-foreground/70 hover:text-accent-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function DayCard({
  date,
  label,
  isToday,
  entries,
  nameOf,
  onAdd,
  onRemove,
}: {
  date: string;
  label: string;
  isToday: boolean;
  entries: Scheduled[];
  nameOf: (sessionId: string) => string | null;
  onAdd: (sessionId: string) => void;
  onRemove: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${date}` });
  const [open, setOpen] = useState(false);
  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex min-h-28 flex-col gap-2 rounded-2xl border bg-card p-3 transition-colors",
        isOver && "border-primary bg-accent",
        isToday && !isOver && "border-primary/60",
      )}
    >
      <header className="flex items-center justify-between">
        <h2 className={cn("text-sm font-semibold", isToday && "text-primary-ink")}>{label}</h2>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Add session on ${label}`}
              className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="end">
            <SessionPicker
              onPick={(id) => {
                setOpen(false);
                onAdd(id);
              }}
            />
          </PopoverContent>
        </Popover>
      </header>
      <div className="flex flex-col gap-1.5">
        {entries.map((e) => {
          const name = nameOf(e.session_id);
          return name ? (
            <Chip key={e.id} id={`sch:${e.id}`} label={name} onRemove={() => onRemove(e.id)} />
          ) : null;
        })}
        {!entries.length && (
          <p className="py-2 text-xs text-muted-foreground">Rest day — drop a session here</p>
        )}
      </div>
    </section>
  );
}

function Tray({ sessions, placedIds }: { sessions: Session[]; placedIds: Set<string> }) {
  const { setNodeRef, isOver } = useDroppable({ id: "tray" });
  return (
    <section
      ref={setNodeRef}
      className={cn(
        "sticky top-0 z-10 space-y-2 rounded-2xl border bg-background/95 p-3 backdrop-blur transition-colors",
        isOver && "border-primary bg-accent",
      )}
    >
      <p className="text-xs text-muted-foreground">
        Drag a session onto a day. Drop a planned one back here to unplace it.
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {sessions.map((s) => (
          <div key={s.id} className="w-44 shrink-0">
            <Chip id={`new:${s.id}`} label={s.name} placed={placedIds.has(s.id)} />
          </div>
        ))}
        {!sessions.length && (
          <p className="text-sm text-muted-foreground">
            No sessions yet — create one on the Plan tab.
          </p>
        )}
      </div>
    </section>
  );
}

function WeekPage() {
  const { d } = Route.useSearch();
  const navigate = Route.useNavigate();
  const start = startOfWeek(d ? fromISO(d) : new Date());
  const end = addDays(start, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const todayISO = toISO(new Date());

  const { data: sessions = [] } = useQuery(planQuery);
  const schedQuery = useQuery(scheduleQuery(toISO(start), toISO(end)));
  const scheduled = schedQuery.data;
  const rows: Scheduled[] = scheduled ?? [];
  const actions = useScheduleActions();
  const [activeLabel, setActiveLabel] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const names = useMemo(() => new Map(sessions.map((s) => [s.id, s.name])), [sessions]);
  const nameOf = (id: string) => names.get(id) ?? null;
  const placedIds = new Set(rows.map((r) => r.session_id));

  const sameMonth = start.getMonth() === end.getMonth();
  const title = `${fmt(start, { month: "short", day: "numeric" })} – ${
    sameMonth
      ? `${end.getDate()}, ${end.getFullYear()}`
      : fmt(end, { month: "short", day: "numeric", year: "numeric" })
  }`;

  const go = (date: Date) => navigate({ search: { d: toISO(date) } });

  function labelFor(id: string) {
    const [kind, ref = ""] = id.split(":");
    if (kind === "new") return names.get(ref) ?? "";
    const row = rows.find((r) => r.id === ref);
    return row ? (names.get(row.session_id) ?? "") : "";
  }

  function onDragStart(e: DragStartEvent) {
    setActiveLabel(labelFor(String(e.active.id)));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveLabel(null);
    const over = e.over ? String(e.over.id) : null;
    if (!over) return;
    const [kind, ref = ""] = String(e.active.id).split(":");
    if (over.startsWith("day:")) {
      const date = over.slice(4);
      if (kind === "new") void actions.schedule(ref, date);
      else {
        const row = rows.find((r) => r.id === ref);
        if (row && row.date !== date) void actions.move(ref, date);
      }
    } else if (over === "tray" && kind === "sch") {
      void actions.remove(ref);
    }
  }

  return (
    <div className="space-y-4">
      <PeriodNav
        unit="week"
        title={title}
        onPrev={() => go(addDays(start, -7))}
        onNext={() => go(addDays(start, 7))}
        onToday={() => go(new Date())}
      />
      {schedQuery.isError && <QueryError onRetry={() => schedQuery.refetch()} />}
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveLabel(null)}
      >
        <Tray sessions={sessions} placedIds={placedIds} />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {days.map((day, i) => {
            const iso = toISO(day);
            return (
              <DayCard
                key={iso}
                date={iso}
                label={`${WEEKDAYS[i]} ${day.getDate()}`}
                isToday={iso === todayISO}
                entries={rows.filter((r) => r.date === iso)}
                nameOf={nameOf}
                onAdd={(sid) => void actions.schedule(sid, iso)}
                onRemove={(id) => void actions.remove(id)}
              />
            );
          })}
        </div>
        <DragOverlay>
          {activeLabel ? (
            <div className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg">
              {activeLabel}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
