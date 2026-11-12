import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, Plus, Repeat } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BodyMap } from "@/features/gym/BodyMap";
import { ExerciseGuide } from "@/features/gym/ExerciseGuide";
import { exercisesQuery, gym, planQuery, useInvalidateGym, type Exercise } from "@/features/gym/data";
import { ProgressChart, ReadyBadge, isReady, useExerciseSessions } from "@/features/gym/progress-ui";
import { Loading, QueryError } from "@/components/states";

export const Route = createFileRoute("/_authenticated/_shell/gym/exercise/$id")({
  validateSearch: (s: Record<string, unknown>): { item?: string | undefined } => ({
    item: typeof s["item"] === "string" ? s["item"] : undefined,
  }),
  head: () => ({ meta: [{ title: "Exercise — Lifeplan" }] }),
  component: ExercisePage,
});

const VARIATION_ORDER = ["dumbbell", "cable", "machine", "barbell", "bodyweight", "other"] as const;

function AddToSession({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  const { data: sessions = [] } = useQuery(planQuery);
  const invalidate = useInvalidateGym();
  const [sessionId, setSessionId] = useState("");
  const [sets, setSets] = useState("3");
  const [reps, setReps] = useState("8-12");
  const [weight, setWeight] = useState("");
  const [busy, setBusy] = useState(false);
  const chosen = sessions.find((s) => s.id === (sessionId || sessions[0]?.id));

  async function save() {
    if (!chosen) return;
    setBusy(true);
    try {
      await gym.addItem(chosen.id, exercise.id, chosen.items.length, {
        sets: Math.max(1, Number(sets) || 3),
        reps: reps.trim() || "8-12",
        weight_kg: weight === "" ? null : Number(weight),
      });
      await invalidate();
      toast.success(`Added to ${chosen.name}`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  if (!sessions.length)
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        No sessions yet.{" "}
        <Link to="/gym" className="text-primary-ink underline">
          Create one in your plan
        </Link>
      </p>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Session">
        {sessions.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={chosen?.id === s.id}
            onClick={() => setSessionId(s.id)}
            className={
              "h-11 rounded-full border px-4 text-sm " +
              (chosen?.id === s.id
                ? "border-primary bg-accent text-accent-foreground"
                : "bg-background text-muted-foreground")
            }
          >
            {s.name}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
        <label className="space-y-1">
          Sets
          <Input type="number" min={1} inputMode="numeric" value={sets} onChange={(e) => setSets(e.target.value)} />
        </label>
        <label className="space-y-1">
          Reps
          <Input value={reps} onChange={(e) => setReps(e.target.value)} />
        </label>
        <label className="space-y-1">
          Weight (kg)
          <Input
            type="number"
            min={0}
            step="0.5"
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </label>
      </div>
      <Button className="h-12 w-full" disabled={busy} onClick={save}>
        Add
      </Button>
    </div>
  );
}

function ExercisePage() {
  const { id } = Route.useParams();
  const { item: itemId } = Route.useSearch();
  const navigate = useNavigate();
  const invalidate = useInvalidateGym();
  const { data: all, isLoading, isError, refetch } = useQuery(exercisesQuery);
  const { data: sessions = [] } = useQuery(planQuery);
  const [adding, setAdding] = useState(false);

  const exercise = all?.find((e) => e.id === id);
  const history = useExerciseSessions(exercise ? [exercise.id] : []).byExercise.get(id);
  const fromSession = useMemo(() => {
    if (!itemId) return null;
    for (const s of sessions) {
      const it = s.items.find((i) => i.id === itemId);
      if (it) return { session: s, item: it };
    }
    return null;
  }, [sessions, itemId]);

  const variations = useMemo(() => {
    if (!exercise || !all) return [];
    const rest = all.filter((e) => e.family === exercise.family && e.id !== exercise.id);
    return VARIATION_ORDER.map((eq) => ({ eq, list: rest.filter((e) => e.equipment === eq) })).filter(
      (g) => g.list.length,
    );
  }, [all, exercise]);

  if (isLoading) return <Loading rows={2} className="h-64" />;
  if (isError) return <QueryError onRetry={() => refetch()} />;
  if (!exercise) return <p className="text-muted-foreground">Exercise not found.</p>;

  const canSwap = !!fromSession && fromSession.item.exercise_id !== exercise.id;

  async function swap() {
    if (!fromSession) return;
    try {
      await gym.updateItem(fromSession.item.id, { exercise_id: exercise!.id });
      await invalidate();
      toast.success("Swapped");
      navigate({ to: "/gym/session/$id", params: { id: fromSession.session.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not swap");
    }
  }

  const backClass = "inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground";

  return (
    <div className="space-y-6">
      {fromSession ? (
        <Link to="/gym/session/$id" params={{ id: fromSession.session.id }} className={backClass}>
          <ArrowLeft className="h-4 w-4" /> {fromSession.session.name}
        </Link>
      ) : (
        <Link to="/gym/library" className={backClass}>
          <ArrowLeft className="h-4 w-4" /> Library
        </Link>
      )}

      <div className="grid gap-6 md:grid-cols-2 md:items-start">
        <div className="md:order-2">
          <BodyMap primary={exercise.primary_muscles} secondary={exercise.secondary_muscles} />
        </div>

        <div className="space-y-6 md:order-1">
          <header className="space-y-1">
            <h1 className="text-[1.75rem] leading-tight">{exercise.name}</h1>
            <p className="flex items-center gap-2 text-sm capitalize text-muted-foreground">
              {exercise.equipment}
              {isReady(history) && <ReadyBadge />}
            </p>
          </header>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="h-12 sm:flex-1" onClick={() => setAdding(true)}>
              <Plus className="mr-1 h-4 w-4" /> Add to a session
            </Button>
            {canSwap && (
              <Button variant="outline" className="h-12 sm:flex-1" onClick={swap}>
                <Repeat className="mr-1 h-4 w-4" /> Swap to this variation
              </Button>
            )}
          </div>

          <ExerciseGuide exercise={exercise} />
        </div>
      </div>

      {history && history.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">Progress</h2>
          <div className="tile p-4">
            <ProgressChart sessions={history} />
          </div>
        </section>
      )}

      {variations.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">Variations</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {variations.map(({ eq, list }) => (
              <div key={eq} className="space-y-1.5">
                <h3 className="eyebrow px-1">{eq}</h3>
                <ul className="tile divide-y">
                  {list.map((v) => (
                    <li key={v.id}>
                      <Link
                        to="/gym/exercise/$id"
                        params={{ id: v.id }}
                        search={{ item: itemId }}
                        className="flex h-12 items-center px-4 text-sm font-medium"
                      >
                        {v.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to a session</DialogTitle>
          </DialogHeader>
          <AddToSession exercise={exercise} onClose={() => setAdding(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
