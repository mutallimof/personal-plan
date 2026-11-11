import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Empty, Loading, QueryError } from "@/components/states";
import { cn } from "@/lib/utils";
import { shopping, shoppingQuery, useInvalidateCook } from "./data";

/** A plain shopping list: things the chat adds, and things you type. */
export function ShoppingTab() {
  const list = useQuery(shoppingQuery);
  const invalidate = useInvalidateCook();
  const [text, setText] = useState("");

  async function run(fn: () => Promise<void>) {
    try {
      await fn();
      await invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  }

  if (list.isLoading) return <Loading rows={3} className="h-14" />;
  if (list.isError || !list.data) return <QueryError onRetry={() => void list.refetch()} />;
  const items = list.data;

  return (
    <div className="space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const name = text.trim();
          if (!name) return;
          setText("");
          void run(() => shopping.add([{ name }]));
        }}
      >
        <Input aria-label="Add to shopping list" placeholder="Add something" className="h-11 text-base sm:text-sm" value={text} onChange={(e) => setText(e.target.value)} />
        <Button type="submit" className="h-11 shrink-0">
          Add
        </Button>
      </form>
      {!items.length ? (
        <Empty>Nothing to buy.</Empty>
      ) : (
        <ul className="divide-y rounded-2xl bg-card">
          {items.map((i) => (
            <li key={i.id} className="flex min-h-12 items-center gap-3 px-4">
              <input
                type="checkbox"
                className="h-5 w-5 accent-primary"
                aria-label={`Bought ${i.name}`}
                checked={i.done}
                onChange={(e) => void run(() => shopping.setDone(i.id, e.target.checked))}
              />
              <span className={cn("min-w-0 flex-1 truncate text-sm", i.done && "text-muted-foreground line-through")}>
                {i.name}
                {i.quantity ? <span className="text-muted-foreground"> · {i.quantity} {i.unit ?? ""}</span> : null}
              </span>
              <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={`Remove ${i.name}`} onClick={() => void run(() => shopping.remove(i.id))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {items.some((i) => i.done) && (
        <Button variant="outline" className="h-11 w-full" onClick={() => void run(shopping.clearDone)}>
          Clear bought
        </Button>
      )}
    </div>
  );
}
