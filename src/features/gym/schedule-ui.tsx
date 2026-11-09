import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { gym, planQuery, useInvalidateGym } from "./data";

/** `?d=YYYY-MM-DD` picks the week / month shown. Anything else falls back to today. */
export function validateDateSearch(s: Record<string, unknown>): { d?: string | undefined } {
  const d = s["d"];
  return { d: typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined };
}

/** Schedule actions that refresh the cache and show a toast on failure. */
export function useScheduleActions() {
  const invalidate = useInvalidateGym();
  async function run(fn: () => Promise<void>) {
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
    await invalidate();
  }
  return {
    schedule: (sessionId: string, date: string) => run(() => gym.schedule(sessionId, date)),
    move: (id: string, date: string) => run(() => gym.moveScheduled(id, date)),
    remove: (id: string) => run(() => gym.unschedule(id)),
  };
}

export function PeriodNav({
  title,
  onPrev,
  onNext,
  onToday,
  unit,
}: {
  title: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  unit: "week" | "month";
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" className="h-11 rounded-full px-4" onClick={onToday}>
          Today
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-11 w-11 rounded-full"
          aria-label={`Previous ${unit}`}
          onClick={onPrev}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-11 w-11 rounded-full"
          aria-label={`Next ${unit}`}
          onClick={onNext}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/** List of sessions; tapping one calls onPick. Used by the "+" popover and the month day dialog. */
export function SessionPicker({ onPick }: { onPick: (sessionId: string) => void }) {
  const { data: sessions = [] } = useQuery(planQuery);
  if (!sessions.length) {
    return (
      <p className="p-2 text-sm text-muted-foreground">
        No sessions yet.{" "}
        <Link to="/gym" className="text-primary-ink underline">
          Create one
        </Link>{" "}
        first.
      </p>
    );
  }
  return (
    <ul className="space-y-1">
      {sessions.map((s) => (
        <li key={s.id}>
          <button
            type="button"
            onClick={() => onPick(s.id)}
            className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm font-medium hover:bg-accent"
          >
            {s.name}
          </button>
        </li>
      ))}
    </ul>
  );
}
