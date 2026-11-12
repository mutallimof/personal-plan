import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { pantry, useCategoryOptions, useInvalidatePantry } from "@/features/pantry/data";
import type { PantryLocation } from "@/features/pantry/model";

/**
 * Which categories a pantry place accepts. New items of an accepted category are put in the first place that
 * accepts them. Saved right away (it belongs to the place, not to the layout draft).
 */
export function AcceptsEditor({ placeName, places }: { placeName: string | null; places: readonly PantryLocation[] }) {
  const categories = useCategoryOptions();
  const invalidate = useInvalidatePantry();
  const place = placeName ? places.find((p) => p.name.trim().toLowerCase() === placeName.trim().toLowerCase()) : undefined;
  if (!place) return null;
  const accepted = new Set(place.accepts ?? []);

  async function toggle(key: string) {
    if (!place) return;
    const next = new Set(accepted);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    try {
      await pantry.setAccepts(place.id, [...next]);
      await invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  }

  return (
    <div className="space-y-1" role="group" aria-label={`Accepts in ${place.name}`}>
      <p className="text-xs text-muted-foreground">Accepts</p>
      <div className="flex flex-wrap gap-1.5">
        {categories.map((c) => {
          const on = accepted.has(c.value);
          return (
            <button
              key={c.value}
              type="button"
              aria-pressed={on}
              onClick={() => void toggle(c.value)}
              className={cn(
                "min-h-9 rounded-full border px-3 text-xs",
                on ? "border-primary bg-primary/10 font-medium text-foreground" : "bg-background text-muted-foreground",
              )}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
