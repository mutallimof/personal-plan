import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Copy, GripVertical, Play, Plus, Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, Loading, QueryError } from "@/components/states";
import { ExerciseBrowser } from "@/features/gym/ExerciseBrowser";
import { ReadyBadge, isReady, useExerciseSessions } from "@/features/gym/progress-ui";
import { estimateMinutes } from "@/features/gym/workout";
import { gym, planQuery, useInvalidateGym, type Exercise, type SessionExercise } from "@/features/gym/data";

export const Route = createFileRoute("/_authenticated/_shell/gym/session/$id")({
  head: () => ({ meta: [{ title: "Session — Lifeplan" }] }),
  component: SessionPage,
});

function ItemRow({
  item,
  ready,
  onSwap,
  onChanged,
}: {
  item: SessionExercise;
  ready: boolean;
  onSwap: () => void;
  onChanged: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  async function save(patch: Parameters<typeof gym.updateItem>[1]) {
    try {
      await gym.updateItem(item.id, patch);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  }
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={"space-y-3 bg-card p-4 " + (isDragging ? "relative z-10 rounded-2xl shadow-lg" : "")}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Reorder ${item.exercise.name}`}
            className="-ml-2 flex h-11 w-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <GripVertical className="h-5 w-5" />
          </button>
          <Link
            to="/gym/exercise/$id"
            params={{ id: item.exercise_id }}
            search={{ item: item.id }}
            className="flex min-h-11 min-w-0 items-center truncate font-medium hover:underline"
          >
            {item.exercise.name}
          </Link>
          {ready && <ReadyBadge />}
        </div>
        <div className="flex shrink-0">
          <Button size="icon" variant="ghost" aria-label="Swap exercise" onClick={onSwap}>
            <Repeat className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Remove exercise"
            onClick={async () => {
              try {
                await gym.removeItem(item.id);
                onChanged();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not remove");
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
        <label className="space-y-1">
          Sets
          <Input
            className="h-11"
            type="number"
            min={1}
            defaultValue={item.sets}
            onBlur={(e) => e.target.value && save({ sets: Number(e.target.value) })}
          />
        </label>
        <label className="space-y-1">
          Reps
          <Input className="h-11" defaultValue={item.reps} onBlur={(e) => e.target.value && save({ reps: e.target.value })} />
        </label>
        <label className="space-y-1">
          Weight (kg)
          <Input
            className="h-11"
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
  const { data: sessions = [], isLoading, isError, refetch } = useQuery(planQuery);
  const session = sessions.find((s) => s.id === id);
  const [picker, setPicker] = useState<{ mode: "add" } | { mode: "swap"; item: SessionExercise } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [order, setOrder] = useState<SessionExercise[] | null>(null);
  const items = order ?? session?.items ?? [];
  const history = useExerciseSessions(items.map((i) => i.exercise_id));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (isLoading) return <Loading rows={2} className="h-40" />;
  if (isError) return <QueryError onRetry={() => refetch()} />;
  if (!session) return <p className="text-muted-foreground">Session not found.</p>;

  async function pick(e: Exercise) {
    if (!picker || !session) return;
    try {
      if (picker.mode === "add") await gym.addItem(session.id, e.id, items.length);
      else await gym.updateItem(picker.item.id, { exercise_id: e.id });
      await invalidate();
      setPicker(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    }
  }

  async function onDragEnd(ev: DragEndEvent) {
    const { active, over } = ev;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(items, from, to);
    setOrder(next);
    try {
      await gym.reorder(next);
      await invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reorder");
    } finally {
      setOrder(null);
    }
  }

  async function remove() {
    if (!session) return;
    setDeleting(true);
    try {
      await gym.deleteSession(session.id);
      setConfirmDelete(false);
      await invalidate();
      navigate({ to: "/gym" });
    } catch (err) {
      setConfirmDelete(false);
      toast.error(err instanceof Error ? err.message : "Could not delete");
    } finally {
      setDeleting(false);
    }
  }

  async function duplicate() {
    if (!session) return;
    try {
      const copy = await gym.duplicateSession({ ...session, items }, sessions.length);
      await invalidate();
      toast.success("Session duplicated");
      navigate({ to: "/gym/session/$id", params: { id: copy.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not duplicate");
    }
  }

  const minutes = estimateMinutes(items);

  return (
    <div className="space-y-4">
      <Link to="/gym" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Plan
      </Link>
      <div className="flex items-center gap-2">
        <Input
          key={session.name}
          aria-label="Session name"
          className="h-12 text-lg font-semibold"
          defaultValue={session.name}
          onBlur={async (e) => {
            const name = e.target.value.trim();
            if (name && name !== session.name) {
              await gym.renameSession(session.id, name);
              await invalidate();
            }
          }}
        />
        <Button variant="outline" size="icon" className="shrink-0" aria-label="Duplicate session" onClick={duplicate}>
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="shrink-0"
          aria-label="Delete session"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {items.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {items.length} {items.length === 1 ? "exercise" : "exercises"} · ~{minutes} min
        </p>
      )}

      {items.length > 0 ? (
        <Button asChild className="h-12 w-full">
          <Link to="/gym/workout/$id" params={{ id: session.id }}>
            <Play className="mr-1 h-4 w-4" /> Start workout
          </Link>
        </Button>
      ) : (
        <Button className="h-12 w-full" disabled>
          <Play className="mr-1 h-4 w-4" /> Start workout
        </Button>
      )}

      {items.length === 0 ? (
        <Empty>No exercises yet.</Empty>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <ul className="divide-y overflow-hidden tile">
              {items.map((it) => (
                <ItemRow
                  key={it.id}
                  item={it}
                  ready={isReady(history.byExercise.get(it.exercise_id))}
                  onSwap={() => setPicker({ mode: "swap", item: it })}
                  onChanged={invalidate}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
      <Button variant="outline" className="h-12 w-full" onClick={() => setPicker({ mode: "add" })}>
        <Plus className="mr-1 h-4 w-4" /> Add exercise
      </Button>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{session.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {items.length > 0
                ? `This removes the day and its ${items.length} ${items.length === 1 ? "exercise" : "exercises"} from your plan. Logged workouts stay.`
                : "This removes the day from your plan. Logged workouts stay."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void remove();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!picker} onOpenChange={(o) => !o && setPicker(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{picker?.mode === "swap" ? "Swap exercise" : "Add exercise"}</DialogTitle>
          </DialogHeader>
          <ExerciseBrowser onPick={pick} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
