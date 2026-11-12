import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { itemsQuery } from "@/features/pantry/data";
import { sameIngredient } from "./names";
import { missingText, type LineStatus } from "./can-cook";
import { shopping, shoppingQuery, useInvalidateCook } from "./data";
import { describeAdd, planShoppingAdd } from "./shopping";

/**
 * The ingredients of a recipe that are not fully in the pantry, each with a checkbox, and one button that adds the
 * ticked ones to the shopping list. Nothing is added until the button is pressed, and what is in stock or already on
 * the list is skipped (the check runs again on the current data when the button is pressed).
 */
export function MissingToList({ missing }: { missing: readonly LineStatus[] }) {
  const list = useQuery(shoppingQuery);
  const qc = useQueryClient();
  const invalidate = useInvalidateCook();
  const [unticked, setUnticked] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const onList = (l: LineStatus) => (list.data ?? []).some((e) => !e.done && sameIngredient(e.name, l.need.name));
  const selected = missing.filter((l) => !onList(l) && !unticked.has(l.need.name));

  function toggle(name: string) {
    setUnticked((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function add() {
    setBusy(true);
    try {
      // read the pantry and the list again, so a stale screen cannot add something that is in stock or listed
      const [stock, current] = await Promise.all([
        qc.fetchQuery({ ...itemsQuery, staleTime: 0 }),
        qc.fetchQuery({ ...shoppingQuery, staleTime: 0 }),
      ]);
      const plan = planShoppingAdd(selected, stock, current);
      if (plan.add.length) await shopping.add(plan.add);
      await invalidate();
      toast.success(describeAdd(plan.add.length, plan.skipped));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add");
    } finally {
      setBusy(false);
    }
  }

  if (!missing.length) return null;
  return (
    <div className="space-y-1 text-sm">
      <p className="font-medium">
        Missing {missing.length} {missing.length === 1 ? "ingredient" : "ingredients"}
      </p>
      <ul>
        {missing.map((l) => {
          const listed = onList(l);
          return (
            <li key={l.need.name}>
              <label className="flex min-h-11 items-center gap-3">
                <input
                  type="checkbox"
                  className="h-5 w-5 shrink-0"
                  checked={!listed && !unticked.has(l.need.name)}
                  disabled={listed}
                  onChange={() => toggle(l.need.name)}
                />
                <span className="min-w-0 flex-1">{missingText(l)}</span>
                {listed && <span className="shrink-0 text-xs text-muted-foreground">on your list</span>}
              </label>
            </li>
          );
        })}
      </ul>
      <Button variant="outline" className="h-11" disabled={busy || !selected.length} onClick={() => void add()}>
        Add selected to shopping list
      </Button>
    </div>
  );
}
