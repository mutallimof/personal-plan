import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { pantry, useInvalidatePantry } from "./data";
import { describeMove, type Move } from "./organize";
import type { PantryLocation } from "./model";

/** Proposed moves of items to the places that accept their category. Nothing moves until the person accepts. */
export function OrganizeDialog({
  moves,
  locations,
  onClose,
}: {
  moves: readonly Move[];
  locations: readonly PantryLocation[];
  onClose: () => void;
}) {
  const invalidate = useInvalidatePantry();
  const [chosen, setChosen] = useState<ReadonlySet<string>>(() => new Set(moves.map((m) => m.item.id)));
  const [busy, setBusy] = useState(false);
  const picked = useMemo(() => moves.filter((m) => chosen.has(m.item.id)), [moves, chosen]);

  async function apply() {
    setBusy(true);
    let done = 0;
    try {
      for (const m of picked) {
        await pantry.moveItem(m.item, m.to.id);
        done++;
      }
      toast.success(`Moved ${done} ${done === 1 ? "item" : "items"}`);
      await invalidate();
      onClose();
    } catch (e) {
      toast.error(`Moved ${done}, then it failed: ${e instanceof Error ? e.message : "unknown error"}`);
      await invalidate();
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Organize</DialogTitle>
        </DialogHeader>
        {moves.length === 0 ? (
          <p className="text-sm text-muted-foreground">Everything is where it belongs.</p>
        ) : (
          <ul className="divide-y">
            {moves.map((m) => {
              const d = describeMove(m, locations);
              return (
                <li key={m.item.id}>
                  <label className="flex min-h-14 items-center gap-3 py-1">
                    <Checkbox
                      checked={chosen.has(m.item.id)}
                      onCheckedChange={(on) => {
                        const next = new Set(chosen);
                        if (on) next.add(m.item.id);
                        else next.delete(m.item.id);
                        setChosen(next);
                      }}
                      aria-label={`Move ${m.item.name}`}
                    />
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="block truncate font-medium">{m.item.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {d.from} → {d.to}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" className="h-11" onClick={onClose} disabled={busy}>
            Close
          </Button>
          {moves.length > 0 && (
            <Button className="h-11" onClick={apply} disabled={busy || picked.length === 0}>
              Move {picked.length}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
