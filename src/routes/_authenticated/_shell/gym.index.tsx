import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Play, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loading, QueryError } from "@/components/states";
import { gym, logsQuery, planQuery, useInvalidateGym } from "@/features/gym/data";
import { estimateMinutes, suggestNext } from "@/features/gym/workout";

export const Route = createFileRoute("/_authenticated/_shell/gym/")({
  head: () => ({ meta: [{ title: "Plan — Lifeplan" }] }),
  component: PlanPage,
});

function PlanPage() {
  const { data: sessions = [], isLoading, isError, refetch } = useQuery(planQuery);
  const { data: logs = [] } = useQuery(logsQuery);
  const invalidate = useInvalidateGym();
  const navigate = useNavigate();
  const next = suggestNext(sessions, logs);

  async function add() {
    try {
      const s = await gym.createSession(`Session ${sessions.length + 1}`, sessions.length);
      await invalidate();
      navigate({ to: "/gym/session/$id", params: { id: s.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add the session");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-[1.75rem] leading-tight">Plan</h1>

      {isError && !sessions.length && <QueryError onRetry={() => refetch()} />}

      {next && next.session.items.length > 0 && (
        <section className="flex items-center justify-between gap-3 rounded-2xl bg-accent p-4 sm:p-5" aria-label="Next session">
          <div className="min-w-0">
            <p className="eyebrow text-accent-foreground">Next</p>
            <p className="truncate text-lg font-semibold">{next.session.name}</p>
            <p className="text-sm text-muted-foreground">~{estimateMinutes(next.session.items)} min</p>
          </div>
          <Button asChild className="h-12 shrink-0 px-5">
            <Link to="/gym/workout/$id" params={{ id: next.session.id }}>
              <Play className="mr-1 h-4 w-4" /> Start
            </Link>
          </Button>
        </section>
      )}

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Loading rows={3} className="h-36" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((s) => (
            <div key={s.id} className="flex flex-col tile">
              <Link
                to="/gym/session/$id"
                params={{ id: s.id }}
                className="flex-1 rounded-t-2xl p-5 pb-3 transition hover:bg-secondary"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="truncate text-lg font-semibold">{s.name}</h2>
                  <span className="shrink-0 text-xs text-muted-foreground">{s.items.length} {s.items.length === 1 ? "exercise" : "exercises"}</span>
                </div>
                <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                  {s.items.slice(0, 4).map((it) => (
                    <li key={it.id} className="truncate">
                      {it.exercise.name}
                    </li>
                  ))}
                  {s.items.length > 4 && <li>+{s.items.length - 4} more</li>}
                  {!s.items.length && <li>No exercises yet</li>}
                </ul>
              </Link>
              <div className="px-5 pb-4">
                {s.items.length > 0 ? (
                  <Button asChild variant="outline" className="h-11 w-full">
                    <Link to="/gym/workout/$id" params={{ id: s.id }}>
                      <Play className="mr-1 h-4 w-4" /> Start workout
                    </Link>
                  </Button>
                ) : (
                  <Button variant="outline" className="h-11 w-full" disabled>
                    <Play className="mr-1 h-4 w-4" /> Start workout
                  </Button>
                )}
              </div>
            </div>
          ))}
          <button
            onClick={add}
            className="flex min-h-36 items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="h-5 w-5" /> Add session
          </button>
        </div>
      )}
    </div>
  );
}
