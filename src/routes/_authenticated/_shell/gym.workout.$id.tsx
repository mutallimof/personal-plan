import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { QueryError } from "@/components/states";
import { BodyMap } from "@/features/gym/BodyMap";
import { ExerciseGuide } from "@/features/gym/ExerciseGuide";
import { exercisesQuery, gym, planQuery, useInvalidateGym } from "@/features/gym/data";
import { weightUpdates, type WeightUpdate } from "@/features/gym/progress";
import { draftFromPlan, setRowsFromDraft, type DraftExercise } from "@/features/gym/workout";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_shell/gym/workout/$id")({
  head: () => ({ meta: [{ title: "Workout — Lifeplan" }] }),
  component: WorkoutPage,
});

type Saved = { startedAt: string; draft: DraftExercise[] };
const key = (id: string) => `lifeplan:workout:${id}`;

function load(id: string): Saved | null {
  try {
    const raw = localStorage.getItem(key(id));
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}
function store(id: string, v: Saved | null) {
  try {
    if (v) localStorage.setItem(key(id), JSON.stringify(v));
    else localStorage.removeItem(key(id));
  } catch {
    /* storage blocked: the workout still works, it just won't survive a reload */
  }
}

function WorkoutPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const invalidate = useInvalidateGym();
  const { data: sessions, isLoading, isError, refetch } = useQuery(planQuery);
  const session = sessions?.find((s) => s.id === id);
  const { data: library } = useQuery(exercisesQuery);
  const [info, setInfo] = useState<string | null>(null);

  const [state, setState] = useState<Saved | null>(null);
  const [saving, setSaving] = useState(false);
  const [offer, setOffer] = useState<WeightUpdate[] | null>(null);
  const started = useRef(false);

  // Resume an unfinished workout for this session, or start from the plan.
  useEffect(() => {
    if (!session || started.current) return;
    started.current = true;
    const saved = load(id);
    const fresh = draftFromPlan(session.items);
    const usable = saved && saved.draft.length === fresh.length && saved.draft.every((d, i) => d.itemId === fresh[i]?.itemId);
    setState(usable ? saved : { startedAt: new Date().toISOString(), draft: fresh });
  }, [session, id]);

  useEffect(() => {
    if (state) store(id, state);
  }, [state, id]);

  const doneCount = useMemo(() => state?.draft.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0) ?? 0, [state]);
  const totalCount = useMemo(() => state?.draft.reduce((n, e) => n + e.sets.length, 0) ?? 0, [state]);

  if (isLoading) return <div className="h-64 animate-pulse tile" />;
  if (isError) return <QueryError onRetry={() => refetch()} />;
  if (!session) return <p className="text-muted-foreground">Session not found.</p>;
  if (!state) return <div className="h-64 animate-pulse tile" />;
  if (!session.items.length)
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground">This session has no exercises.</p>
        <Link to="/gym/session/$id" params={{ id }} className="text-primary-ink underline">
          Add exercises
        </Link>
      </div>
    );

  function update(ei: number, si: number, patch: Partial<DraftExercise["sets"][number]>) {
    setState((s) =>
      s && {
        ...s,
        draft: s.draft.map((e, i) =>
          i !== ei ? e : { ...e, sets: e.sets.map((x, j) => (j === si ? { ...x, ...patch } : x)) },
        ),
      },
    );
  }

  function leave() {
    navigate({ to: "/gym" });
  }

  async function finish() {
    if (!session || !state) return;
    setSaving(true);
    try {
      const sets = setRowsFromDraft(state.draft);
      await gym.saveWorkout({ sessionId: session.id, sessionName: session.name, startedAt: state.startedAt, sets });
      store(id, null);
      await invalidate();
      const performed = state.draft.map((e) => ({
        exercise_id: e.exerciseId,
        sets: sets.filter((s) => s.exercise_id === e.exerciseId).map((s) => ({ done: s.done, weight_kg: s.weight_kg })),
      }));
      const ups = weightUpdates(session.items, performed);
      toast.success("Workout saved");
      if (ups.length) setOffer(ups);
      else leave();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the workout");
    } finally {
      setSaving(false);
    }
  }

  async function applyUpdates() {
    if (!offer) return;
    try {
      await Promise.all(offer.map((u) => gym.updateItem(u.itemId, { weight_kg: u.to })));
      await invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the plan");
    }
    setOffer(null);
    leave();
  }

  const infoExercise = info ? library?.find((e) => e.id === info) : undefined;
  const names = new Map(state.draft.map((d) => [d.exerciseId, d.name]));

  return (
    <div className="space-y-5 pb-24">
      <Link to="/gym/session/$id" params={{ id }} className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> {session.name}
      </Link>

      <div className="flex items-baseline justify-between">
        <h1 className="text-[1.75rem] leading-tight">{session.name}</h1>
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {doneCount}/{totalCount}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {state.draft.map((ex, ei) => (
          <section key={ex.itemId} className="space-y-3 tile p-4" aria-label={ex.name}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="font-medium">{ex.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {ex.sets.length} × {ex.plannedReps}
                  {ex.plannedWeight != null && ` · ${ex.plannedWeight} kg`}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="-mr-2 -mt-2 shrink-0"
                aria-label={`How to do ${ex.name}`}
                onClick={() => setInfo(ex.exerciseId)}
              >
                <Info className="h-5 w-5" />
              </Button>
            </div>
            <div className="grid grid-cols-[1.5rem_1fr_1fr_2.75rem] items-center gap-2 text-xs text-muted-foreground">
              <span />
              <span>Reps</span>
              <span>kg</span>
              <span aria-hidden />
              {ex.sets.map((s, si) => (
                <SetRow
                  key={si}
                  n={si + 1}
                  exercise={ex.name}
                  set={s}
                  onChange={(patch) => update(ei, si, patch)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="fixed inset-x-3 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+4rem+0.75rem)] z-20 rounded-full border bg-card/95 p-1.5 shadow-pop backdrop-blur md:sticky md:inset-x-auto md:bottom-4">
        <div className="mx-auto flex max-w-5xl gap-2 md:px-0">
          <Button className="h-12 flex-1" disabled={saving || doneCount === 0} onClick={finish}>
            Finish workout
          </Button>
          <Button
            variant="outline"
            className="h-12"
            onClick={() => {
              store(id, null);
              leave();
            }}
          >
            Discard
          </Button>
        </div>
      </div>

      <Dialog open={!!infoExercise} onOpenChange={(o) => !o && setInfo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{infoExercise?.name}</DialogTitle>
          </DialogHeader>
          {infoExercise && (
            <div className="space-y-5">
              <BodyMap primary={infoExercise.primary_muscles} secondary={infoExercise.secondary_muscles} />
              <ExerciseGuide exercise={infoExercise} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!offer}
        onOpenChange={(o) => {
          if (!o) {
            setOffer(null);
            leave();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update plan weight?</DialogTitle>
          </DialogHeader>
          <ul className="space-y-1 text-sm">
            {offer?.map((u) => (
              <li key={u.itemId} className="flex justify-between gap-2">
                <span className="truncate">{names.get(u.exerciseId)}</span>
                <span className="shrink-0 text-muted-foreground">
                  {u.from} → <span className="font-medium text-foreground">{u.to} kg</span>
                </span>
              </li>
            ))}
          </ul>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="h-11"
              onClick={() => {
                setOffer(null);
                leave();
              }}
            >
              Keep plan
            </Button>
            <Button className="h-11" onClick={applyUpdates}>
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SetRow({
  n,
  exercise,
  set,
  onChange,
}: {
  n: number;
  exercise: string;
  set: DraftExercise["sets"][number];
  onChange: (patch: Partial<DraftExercise["sets"][number]>) => void;
}) {
  return (
    <>
      <span className="text-sm text-foreground">{n}</span>
      <Input
        className="h-11"
        inputMode="numeric"
        aria-label={`${exercise} set ${n} reps`}
        value={set.reps}
        onChange={(e) => onChange({ reps: e.target.value })}
      />
      <Input
        className="h-11"
        inputMode="decimal"
        aria-label={`${exercise} set ${n} weight in kg`}
        value={set.weight}
        onChange={(e) => onChange({ weight: e.target.value })}
      />
      <button
        type="button"
        role="checkbox"
        aria-checked={set.done}
        aria-label={`${exercise} set ${n} done`}
        onClick={() => onChange({ done: !set.done })}
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-xl border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          set.done ? "border-primary bg-primary text-primary-foreground" : "bg-background text-transparent",
        )}
      >
        <Check className="h-5 w-5" />
      </button>
    </>
  );
}
