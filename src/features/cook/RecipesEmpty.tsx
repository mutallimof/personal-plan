import { useRef, useState } from "react";
import { FileUp, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cook, useInvalidateCook } from "./data";
import { parseRecipeImport } from "./recipe-import";

type Props = {
  onAdd: () => void;
  /** Opens Settings on the AI page. */
  onOpenSettings: () => void;
  aiChat: boolean;
};

/** Shown while there are no recipes: add one, import some, and a hint when the AI chat is off. */
export function RecipesEmpty({ onAdd, onOpenSettings, aiChat }: Props) {
  const file = useRef<HTMLInputElement>(null);
  const invalidate = useInvalidateCook();
  const [busy, setBusy] = useState(false);

  async function onFile(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    try {
      const parsed = parseRecipeImport(await f.text());
      if ("error" in parsed) {
        toast.error(parsed.error);
        return;
      }
      for (const d of parsed.drafts) await cook.saveRecipe(d);
      await invalidate();
      const n = parsed.drafts.length;
      toast.success(`Imported ${n} ${n === 1 ? "recipe" : "recipes"}${parsed.skipped ? `, skipped ${parsed.skipped}` : ""}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not import");
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-dashed border-input p-8 text-center">
      <p className="text-sm text-muted-foreground">No recipes yet.</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button className="h-11" onClick={onAdd}>
          <Plus className="mr-1 h-4 w-4" /> Add recipe
        </Button>
        <Button variant="outline" className="h-11" disabled={busy} onClick={() => file.current?.click()}>
          <FileUp className="mr-1 h-4 w-4" /> Import recipes (JSON)
        </Button>
        <input ref={file} type="file" accept="application/json,.json" className="sr-only" aria-label="Recipes file" onChange={(e) => void onFile(e.target.files?.[0])} />
      </div>
      {!aiChat && (
        <p className="text-xs text-muted-foreground">
          AI cooking chat is off.{" "}
          <button type="button" className="min-h-11 font-semibold text-primary-ink underline underline-offset-2" onClick={onOpenSettings}>
            Turn it on in Settings
          </button>
        </p>
      )}
    </div>
  );
}
