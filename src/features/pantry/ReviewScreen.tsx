import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { categoryOptions, type CategoryOption } from "./category-labels";
import { placesAccepting } from "./locations";
import { isCategory, isUnit, UNITS, type PantryLocation } from "./model";
import type { IgnoredLine } from "./receipt";
import { applySuggestion, canSave, confirmLine, editLine, isLowConfidence, lineProblem, toggleSkip, unresolvedCount, type ReviewLine } from "./review";
import { asOptions, Choice, locationOptions, QuantityField } from "./ui";

const STATUS: Record<ReviewLine["status"], string> = { matched: "Known", uncertain: "Check", unknown: "Unknown" };

const REASON: Record<IgnoredLine["reason"], string> = {
  deposit: "Deposit",
  discount: "Discount",
  bag: "Bag",
  total: "Total",
  tax: "Tax",
  payment: "Payment",
  loyalty: "Points",
};

/** Place choices for a category: the places that accept it, the current place, and "Any place" for none. */
function placeChoices(locations: readonly PantryLocation[], category: string, current: string | null) {
  const accepting = placesAccepting(locations, category);
  const pool = accepting.length ? accepting : locations;
  const ids = new Set(pool.map((p) => p.id));
  const extra = current && !ids.has(current) ? locations.filter((p) => p.id === current) : [];
  return locationOptions([...pool, ...extra]);
}

function Row({
  line,
  locations,
  categories,
  onChange,
}: {
  line: ReviewLine;
  locations: readonly PantryLocation[];
  categories: readonly CategoryOption[];
  onChange: (next: ReviewLine) => void;
}) {
  const needs = !line.skip && !line.confirmed;
  const problem = line.skip ? null : lineProblem(line);
  const label = "space-y-1 text-xs text-muted-foreground";
  return (
    <li className={cn("space-y-3 rounded-2xl border p-3", needs ? "border-warning-ink/40 bg-warning-soft/50" : "bg-card shadow-card", line.skip && "opacity-50")}>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{line.rawText}</span>
        {line.confidence !== null && (
          <span className={cn("text-xs tabular-nums", isLowConfidence(line) ? "font-semibold text-warning-ink" : "text-muted-foreground")}>
            {Math.round(line.confidence)}%
          </span>
        )}
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            needs ? "bg-warning-soft text-warning-ink" : "bg-secondary text-secondary-foreground",
          )}
        >
          {line.status === "matched" && isLowConfidence(line) ? "Unsure" : STATUS[line.status]}
        </span>
        {line.price !== null && <span className="text-xs tabular-nums text-muted-foreground">{line.price.toFixed(2)}</span>}
        {line.autoSkip || (line.category === "household" && line.skip) ? null : (
          <Button variant="ghost" className="h-11 px-3" onClick={() => onChange(toggleSkip(line))}>
            {line.skip ? "Undo" : "Skip"}
          </Button>
        )}
      </div>

      {line.category === "household" && (
        <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Not food</span>
          <span className="flex items-center gap-2">
            Track anyway
            <Switch checked={!line.skip} onCheckedChange={() => onChange(toggleSkip(line))} aria-label="Track anyway" />
          </span>
        </label>
      )}

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
                options={categories}
                onChange={(c) => isCategory(c) && onChange(editLine(line, { category: c }, locations))}
              />
            </label>
            <label className={cn(label, "col-span-2 lg:col-span-1")}>
              Place
              <Choice
                label="Place"
                value={line.locationId ?? ""}
                options={placeChoices(locations, line.category, line.locationId)}
                empty="Any place"
                onChange={(id) => onChange(editLine(line, { locationId: id || null }))}
              />
            </label>
          </div>
          {line.suggestion && !line.edited && (
            <div className="flex items-center gap-2 rounded-xl bg-background px-3 py-2 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{line.suggestion.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  AI · {line.suggestion.category}
                  {line.suggestion.kind ? ` · ${line.suggestion.kind}` : ""}
                </span>
              </span>
              <Button variant="outline" className="h-11" onClick={() => onChange(applySuggestion(line, locations))}>
                Use
              </Button>
            </div>
          )}
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
  checking = 0,
  categories = categoryOptions([]),
  ignored = [],
  onRestore,
}: {
  lines: readonly ReviewLine[];
  locations: readonly PantryLocation[];
  store: string;
  onStore: (s: string) => void;
  onChange: (next: ReviewLine[]) => void;
  onSave: () => void;
  onBack: () => void;
  saving: boolean;
  /** Number of lines the AI check is working on right now. */
  checking?: number;
  categories?: readonly CategoryOption[];
  /** Lines the parser left out (deposits, discounts, bags, totals, payment). */
  ignored?: readonly IgnoredLine[];
  onRestore?: (line: IgnoredLine) => void;
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

      {checking > 0 && (
        <p role="status" className="text-sm text-muted-foreground">
          Checking {checking} {checking === 1 ? "line" : "lines"}…
        </p>
      )}

      <ul className="space-y-3">
        {lines.map((l) => (
          <Row key={l.id} line={l} locations={locations} categories={categories} onChange={(next) => onChange(lines.map((x) => (x.id === l.id ? next : x)))} />
        ))}
      </ul>

      {ignored.length > 0 && (
        <details className="rounded-2xl border bg-card px-3">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm text-muted-foreground">
            Ignored lines ({ignored.length})
          </summary>
          <ul className="divide-y pb-1">
            {ignored.map((g) => (
              <li key={`${g.lineNo}-${g.text}`} className="flex min-h-11 items-center gap-2 py-1 text-sm">
                <span className="min-w-0 flex-1 truncate">{g.text}</span>
                <span className="text-xs text-muted-foreground">{REASON[g.reason]}</span>
                {g.total_price !== null && <span className="text-xs tabular-nums text-muted-foreground">{g.total_price.toFixed(2)}</span>}
                {g.restore && onRestore && (
                  <Button variant="outline" className="h-11" onClick={() => onRestore(g)}>
                    Restore
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="sticky bottom-[4.5rem] z-10 rounded-2xl border bg-background p-3 shadow-sm md:bottom-4">
        <Button className="h-12 w-full" disabled={saving || !canSave(lines)} onClick={onSave}>
          {open > 0 ? `${open} to check` : `Save ${count} ${count === 1 ? "item" : "items"}`}
        </Button>
      </div>
    </div>
  );
}
