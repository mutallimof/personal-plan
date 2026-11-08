import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { gym, planQuery, useInvalidateGym } from "@/features/gym/data";

export const Route = createFileRoute("/_authenticated/_shell/gym/")({
  component: PlanPage,
});

function PlanPage() {
  const { data: sessions = [], isLoading } = useQuery(planQuery);
  const invalidate = useInvalidateGym();
  const navigate = useNavigate();

  async function add() {
    const s = await gym.createSession(`Session ${sessions.length + 1}`, sessions.length);
    await invalidate();
    navigate({ to: "/gym/session/$id", params: { id: s.id } });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Plan</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && [0, 1, 2].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-card" />)}
        {sessions.map((s) => (
          <Link key={s.id} to="/gym/session/$id" params={{ id: s.id }} className="rounded-2xl bg-card p-5 transition hover:bg-secondary">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">{s.name}</h2>
              <span className="text-xs text-muted-foreground">{s.items.length} exercises</span>
            </div>
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              {s.items.slice(0, 4).map((it) => (
                <li key={it.id} className="truncate">{it.exercise.name}</li>
              ))}
              {s.items.length > 4 && <li>+{s.items.length - 4} more</li>}
            </ul>
          </Link>
        ))}
        <button onClick={add} className="flex min-h-36 items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary">
          <Plus className="h-5 w-5" /> Add session
        </button>
      </div>
    </div>
  );
}
