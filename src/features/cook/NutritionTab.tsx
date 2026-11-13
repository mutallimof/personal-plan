import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Empty, Loading, QueryError } from "@/components/states";
import { asOptions, Choice } from "@/features/pantry/ui";
import { cook, nutritionQuery, useInvalidateCook, type NutritionDbRow } from "./data";
import { EatenSection } from "./EatenSection";
import { ingredientKey } from "./names";
import { BASIS_LABEL, isBasis, type NutritionBasis } from "./nutrition";

const BASES = Object.keys(BASIS_LABEL);

export function NutritionTab() {
  const rows = useQuery(nutritionQuery);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<NutritionDbRow | "new" | null>(null);

  if (rows.isLoading) return <Loading rows={3} className="h-16" />;
  if (rows.isError || !rows.data) return <QueryError onRetry={() => void rows.refetch()} />;

  const q = ingredientKey(query);
  const shown = rows.data.filter((r) => !q || ingredientKey(r.name).includes(q));

  return (
    <div className="space-y-6">
      <EatenSection />
      <div className="space-y-4">
      <h2 className="text-xl font-semibold">Foods</h2>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search foods" placeholder="Search foods" className="h-11 pl-9 text-base sm:text-sm" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Button className="h-11 shrink-0" onClick={() => setEditing("new")}>
          <Plus className="mr-1 h-4 w-4" /> Add
        </Button>
      </div>

      {!shown.length ? (
        <Empty>Nothing found.</Empty>
      ) : (
        <ul className="space-y-2">
          {shown.map((r) => (
            <li key={r.id}>
              <button type="button" className="tile press w-full p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setEditing(r)}>
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{r.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{isBasis(r.basis) ? BASIS_LABEL[r.basis] : r.basis}</span>
                </span>
                <span className="block text-sm text-muted-foreground">
                  {r.kcal} kcal · {r.protein_g} g protein
                  {r.carbs_g != null ? ` · ${r.carbs_g} g carbs` : ""}
                  {r.fat_g != null ? ` · ${r.fat_g} g fat` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing && <NutritionDialog row={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
      </div>
    </div>
  );
}

function NutritionDialog({ row, onClose }: { row?: NutritionDbRow | undefined; onClose: () => void }) {
  const invalidate = useInvalidateCook();
  const [name, setName] = useState(row?.name ?? "");
  const [basis, setBasis] = useState<string>(row?.basis ?? "100g");
  const [kcal, setKcal] = useState(row ? String(row.kcal) : "");
  const [protein, setProtein] = useState(row ? String(row.protein_g) : "");
  const [carbs, setCarbs] = useState(row?.carbs_g != null ? String(row.carbs_g) : "");
  const [fat, setFat] = useState(row?.fat_g != null ? String(row.fat_g) : "");
  const [busy, setBusy] = useState(false);

  const k = Number(kcal);
  const p = Number(protein);
  // carbs and fat are optional: empty means "not in the table"
  const optional = (text: string) => (text.trim() === "" ? null : Number(text));
  const c = optional(carbs);
  const f = optional(fat);
  const optionalOk = (v: number | null) => v === null || (Number.isFinite(v) && v >= 0);
  const valid = name.trim().length > 0 && isBasis(basis) && kcal !== "" && protein !== "" && k >= 0 && p >= 0 && Number.isFinite(k) && Number.isFinite(p) && optionalOk(c) && optionalOk(f);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
      await invalidate();
      onClose();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not save";
      toast.error(/duplicate|unique/i.test(message) ? "That food is already in the list for this basis." : message);
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{row ? "Edit food" : "Add food"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input aria-label="Food name" placeholder="Name" className="h-11 text-base sm:text-sm" value={name} onChange={(e) => setName(e.target.value)} />
          <Choice label="Basis" value={basis} onChange={setBasis} options={BASES.map((b) => ({ value: b, label: BASIS_LABEL[b as NutritionBasis] }))} />
          <div className="grid grid-cols-2 gap-2">
            <Input aria-label="kcal" placeholder="kcal" type="number" min={0} step="any" inputMode="decimal" className="h-11 text-base sm:text-sm" value={kcal} onChange={(e) => setKcal(e.target.value)} />
            <Input aria-label="Protein (g)" placeholder="Protein (g)" type="number" min={0} step="any" inputMode="decimal" className="h-11 text-base sm:text-sm" value={protein} onChange={(e) => setProtein(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input aria-label="Carbs (g), optional" placeholder="Carbs (g), optional" type="number" min={0} step="any" inputMode="decimal" className="h-11 text-base sm:text-sm" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
            <Input aria-label="Fat (g), optional" placeholder="Fat (g), optional" type="number" min={0} step="any" inputMode="decimal" className="h-11 text-base sm:text-sm" value={fat} onChange={(e) => setFat(e.target.value)} />
          </div>
          {row && row.source !== "own" && <p className="text-xs text-muted-foreground">{row.source}</p>}
          <Button className="h-12 w-full" disabled={!valid || busy} onClick={() => void run(() => cook.saveNutrition({ name, basis, kcal: k, protein_g: p, carbs_g: c, fat_g: f }, row?.id))}>
            Save
          </Button>
          {row && (
            <Button variant="ghost" className="h-11 w-full text-destructive" disabled={busy} onClick={() => void run(() => cook.deleteNutrition(row.id))}>
              Delete
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
