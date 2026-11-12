import { useEffect, useState, type ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { addQty, expiryLabel, expiryState } from "./items";
import { stepFor, type PantryLocation, type Unit } from "./model";
import { locationPath, sortLocations } from "./locations";

/** Select that takes plain string options and an optional "empty" choice (Radix forbids an empty value). */
export function Choice({
  value,
  onChange,
  options,
  empty,
  label,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly { value: string; label: string }[];
  /** Label for the "nothing chosen" option; omit when a value is required. */
  empty?: string;
  label: string;
  className?: string;
}) {
  const NONE = "__none__";
  return (
    <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
      <SelectTrigger aria-label={label} className={cn("h-11 rounded-xl bg-background text-base sm:text-sm", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {empty !== undefined && <SelectItem value={NONE}>{empty}</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export const asOptions = (values: readonly string[]) => values.map((v) => ({ value: v, label: v }));

export function locationOptions(locations: readonly PantryLocation[]) {
  return sortLocations(locations).map((l) => ({ value: l.id, label: locationPath(locations, l.id) }));
}

/** Round +/- buttons around a quantity. */
export function Stepper({
  value,
  unit,
  onChange,
  children,
}: {
  value: number;
  unit: Unit;
  onChange: (next: number) => void;
  children?: ReactNode;
}) {
  const step = stepFor(unit);
  const btn =
    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <div className="flex items-center gap-1">
      <button type="button" aria-label="Less" className={btn} onClick={() => onChange(addQty(value, -step))}>
        <Minus className="h-4 w-4" />
      </button>
      {children}
      <button type="button" aria-label="More" className={btn} onClick={() => onChange(addQty(value, step))}>
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Quantity with -/+ buttons. Typing works freely; only valid numbers are passed on. */
export function QuantityField({ value, unit, onChange }: { value: number; unit: Unit; onChange: (next: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText((t) => (Number(t) === value ? t : String(value)));
  }, [value]);
  return (
    <Stepper value={value} unit={unit} onChange={(n) => onChange(Math.max(0, n))}>
      <Input
        aria-label="Quantity"
        type="number"
        min={0}
        step="any"
        inputMode="decimal"
        className="h-11 min-w-0 text-center text-base sm:text-sm"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value !== "" && Number.isFinite(n) && n >= 0) onChange(n);
        }}
      />
    </Stepper>
  );
}

/** Red "Expired" or amber "Tomorrow" marker; nothing for items that are fine. */
export function ExpiryBadge({ expiresOn, today }: { expiresOn: string | null; today: Date }) {
  const state = expiryState(expiresOn, today);
  if (state !== "soon" && state !== "expired") return null;
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        state === "expired" ? "bg-destructive/10 text-destructive" : "bg-warning-soft text-warning-ink",
      )}
    >
      {expiryLabel(expiresOn, today)}
    </span>
  );
}
