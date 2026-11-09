import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CATEGORIES, isCategory, isUnit, UNITS, type PantryLocation } from "./model";
import { canSave, confirmLine, editLine, lineProblem, toggleSkip, unresolvedCount, type ReviewLine } from "./review";
import { asOptions, Choice, locationOptions, QuantityField } from "./ui";

const STATUS: Record<ReviewLine["status"], string> = { matched: "Known", uncertain: "Check", unknown: "Unknown" };

function Row({
  line,
  locations,
  onChange,
}: {
  line: ReviewLine;
  locations: readonly PantryLocation[];
  onChange: (next: ReviewLine) => void;
}) {
  const needs = !line.skip && !line.confirmed;
  const problem = line.skip ? null : lineProblem(line);
  const label = "space-y-1 text-xs text-muted-foreground";
  return (
    <li className={cn("space-y-3 rounded-2xl border p-3", needs ? "border-amber-400 bg-amber-50" : "bg-card", line.skip && "opacity-50")}>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{line.rawText}</span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            needs ? "bg-amber-200 text-amber-950" : "bg-secondary text-secondary-foreground",
          )}
        >
          {STATUS[line.status]}
        </span>
        <Button variant="ghost" className="h-11 px-3" onClick={() => onChange(toggleSkip(line))}>
          {line.skip ? "Undo" : "Skip"}
        </Button>
      </div>

      {!line.skip && (
        <>
          <Input
            aria-label="Name"
            className="h-11 bg-background text-base sm:text-sm"
            value={line.name}
            onChange={(e) => onChange(editLine(line, { name: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className={cn(label, "col-span-2 lg:col-span-1")}>
              Quantity
              <QuantityField
                value={line.quantity}
                unit={line.unit}
                onChange={(quantity) => onChange(editLine(line, { quantity }))}
              />
            </div>
            <label className={label}>
              Unit
              <Choice
                label="Unit"
                value={line.unit}
                options={asOptions(UNITS)}
                onChange={(u) => isUnit(u) && onChange(editLine(line, { unit: u }))}
              />
            </label>
            <label className={label}>
              Category
              <Choice
                label="Category"
                value={line.category}
                options={asOptions(CATEGORIES)}
                onChange={(c) => isCategory(c) && onChange(editLine(line, { category: c }))}
              />
            </label>
            <label className={cn(label, "col-span-2 lg:col-span-1")}>
              Place
              <Choice
                label="Place"
                value={line.locationId ?? ""}
                options={locationOptions(locations)}
                empty="No place"
                onChange={(id) => onChange(editLine(line, { locationId: id || null }))}
              />
            </label>
          </div>
          {problem && <p className="text-xs text-destructive">{problem}</p>}
          {needs && (
            <Button variant="outline" className="h-11 w-full bg-background" onClick={() => onChange(confirmLine(line))}>
              <Check className="mr-1 h-4 w-4" /> Looks right
            </Button>
          )}
        </>
      )}
    </li>
  );
}

export function ReviewScreen({
  lines,
  locations,
  store,
  onStore,
  onChange,
  onSave,
  onBack,
  saving,
}: {
  lines: readonly ReviewLine[];
  locations: readonly PantryLocation[];
  store: string;
  onStore: (s: string) => void;
  onChange: (next: ReviewLine[]) => void;
  onSave: () => void;
  onBack: () => void;
  saving: boolean;
}) {
  const open = unresolvedCount(lines);
  const count = lines.filter((l) => !l.skip).length;
  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <label className="min-w-0 flex-1 space-y-1 text-xs text-muted-foreground">
          Store
          <Input className="h-11 text-base sm:text-sm" value={store} onChange={(e) => onStore(e.target.value)} />
        </label>
        <Button variant="outline" className="h-11" onClick={onBack} disabled={saving}>
          Back
        </Button>
      </div>

      <ul className="space-y-3">
        {lines.map((l) => (
          <Row key={l.id} line={l} locations={locations} onChange={(next) => onChange(lines.map((x) => (x.id === l.id ? next : x)))} />
        ))}
      </ul>

      <div className="sticky bottom-[4.5rem] z-10 rounded-2xl border bg-background p-3 shadow-sm md:bottom-4">
        <Button className="h-12 w-full" disabled={saving || !canSave(lines)} onClick={onSave}>
          {open > 0 ? `${open} to check` : `Save ${count} ${count === 1 ? "item" : "items"}`}
        </Button>
      </div>
    </div>
  );
}
