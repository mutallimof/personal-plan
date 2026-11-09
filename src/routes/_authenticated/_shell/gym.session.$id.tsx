import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Repeat, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExerciseBrowser } from "@/features/gym/ExerciseBrowser";
import { gym, planQuery, useInvalidateGym, type Exercise, type SessionExercise } from "@/features/gym/data";

export const Route = createFileRoute("/_authenticated/_shell/gym/session/$id")({
  head: () => ({ meta: [{ title: "Session — Lifeplan" }] }),
  component: SessionPage,
});

function ItemRow({ item, onSwap, onChanged }: { item: SessionExercise; onSwap: () => void; onChanged: () => void }) {
  async function save(patch: Parameters<typeof gym.updateItem>[1]) {
    try {
      await gym.updateItem(item.id, patch);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  }
  return (
    <li className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          to="/gym/exercise/$id"
          params={{ id: item.exercise_id }}
          search={{ item: item.id }}
          className="font-medium hover:underline"
        >
          {item.exercise.name}
        </Link>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" aria-label="Swap exercise" onClick={onSwap}><Repeat className="h-4 w-4" /></Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Remove exercise"
            onClick={async () => { await gym.removeItem(item.id); onChanged(); }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
        <label className="space-y-1">Sets
          <Input type="number" min={1} defaultValue={item.sets} onBlur={(e) => e.target.value && save({ sets: Number(e.target.value) })} />
        </label>
        <label className="space-y-1">Reps
          <Input defaultValue={item.reps} onBlur={(e) => e.target.value && save({ reps: e.target.value })} />
        </label>
        <label className="space-y-1">Weight (kg)
          <Input
            type="number"
            step="0.5"
            defaultValue={item.weight_kg ?? ""}
            onBlur={(e) => save({ weight_kg: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </label>
      </div>
    </li>
  );
}

function SessionPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const invalidate = useInvalidateGym();
  const { data: sessions = [], isLoading } = useQuery(planQuery);
  const session = sessions.find((s) => s.id === id);
  const [picker, setPicker] = useState<{ mode: "add" } | { mode: "swap"; item: SessionExercise } | null>(null);

  if (isLoading) return <div className="h-40 animate-pulse rounded-2xl bg-card" />;
  if (!session) return <p className="text-muted-foreground">Session not found.</p>;

  async function pick(e: Exercise) {
    if (!picker || !session) return;
    try {
      if (picker.mode === "add") await gym.addItem(session.id, e.id, session.items.length);
      else await gym.updateItem(picker.item.id, { exercise_id: e.id });
      await invalidate();
      setPicker(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    }
  }

  return (
    <div className="space-y-4">
      <Link to="/gym" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Plan</Link>
      <div className="flex items-center gap-2">
        <Input
          key={session.name}
          className="h-12 text-lg font-semibold"
          defaultValue={session.name}
          onBlur={async (e) => {
            const name = e.target.value.trim();
            if (name && name !== session.name) { await gym.renameSession(session.id, name); await invalidate(); }
          }}
        />
        <Button
          variant="outline"
          size="icon"
          aria-label="Delete session"
          onClick={async () => {
            if (!confirm(`Delete "${session.name}"?`)) return;
            await gym.deleteSession(session.id);
            await invalidate();
            navigate({ to: "/gym" });
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <ul className="divide-y rounded-2xl bg-card">
        {session.items.map((it) => (
          <ItemRow key={it.id} item={it} onSwap={() => setPicker({ mode: "swap", item: it })} onChanged={invalidate} />
        ))}
        {!session.items.length && <li className="p-6 text-center text-sm text-muted-foreground">No exercises yet</li>}
      </ul>
      <Button variant="outline" className="h-12 w-full" onClick={() => setPicker({ mode: "add" })}><Plus className="mr-1 h-4 w-4" /> Add exercise</Button>

      <Dialog open={!!picker} onOpenChange={(o) => !o && setPicker(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{picker?.mode === "swap" ? "Swap exercise" : "Add exercise"}</DialogTitle></DialogHeader>
          <ExerciseBrowser onPick={pick} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
