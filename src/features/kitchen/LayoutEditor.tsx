import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Plus, RotateCcw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loading, QueryError } from "@/components/states";
import { locationsQuery, useInvalidatePantry } from "@/features/pantry/data";
import type { PantryLocation } from "@/features/pantry/model";
import { AcceptsEditor } from "./AcceptsEditor";
import { LOCATION_KINDS } from "@/features/pantry/model";
import { asOptions, Choice } from "@/features/pantry/ui";
import {
  COMPARTMENT_KINDS,
  DOORS,
  addHotspot,
  exportLayout,
  parseLayout,
  removeHotspot,
  uniqueKey,
  updateHotspot,
  type Compartment,
  type Hotspot,
  type Layout,
} from "./layout";
import { layoutQuery, saveLayout } from "./layout-data";
import { DEFAULT_LAYOUT } from "./legacy";

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const field = "space-y-1 text-xs text-muted-foreground";
const input = "h-11 text-base sm:text-sm";

function Num({
  label,
  value,
  onChange,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
}) {
  return (
    <label className={field}>
      {label}
      <Input
        className={input}
        type="number"
        min={min}
        step="0.5"
        inputMode="decimal"
        value={value}
        onChange={(e) =>
          e.target.value !== "" &&
          Number.isFinite(Number(e.target.value)) &&
          onChange(Number(e.target.value))
        }
      />
    </label>
  );
}

function HotspotForm({
  h,
  placeNames,
  places,
  onChange,
  onDelete,
}: {
  h: Hotspot;
  placeNames: readonly string[];
  places: readonly PantryLocation[];
  onChange: (patch: Partial<Omit<Hotspot, "key">>) => void;
  onDelete: () => void;
}) {
  const setComp = (i: number, patch: Partial<Compartment>) =>
    onChange({ compartments: h.compartments.map((c, k) => (k === i ? { ...c, ...patch } : c)) });
  return (
    <div className="space-y-3 tile p-4">
      <datalist id="layout-places">
        {placeNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <label className={field}>
        Name
        <Input
          className={input}
          value={h.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={field}>
          Door
          <Choice
            label="Door"
            value={h.door}
            onChange={(door) => onChange({ door: door as Hotspot["door"] })}
            options={asOptions(DOORS)}
          />
        </label>
        <label className={field}>
          Kind
          <Choice
            label="Kind"
            value={h.kind}
            onChange={(kind) => onChange({ kind: kind as Hotspot["kind"] })}
            options={asOptions(LOCATION_KINDS)}
          />
        </label>
        <Num
          label="Shelves"
          value={h.shelves}
          min={1}
          onChange={(shelves) => onChange({ shelves })}
        />
        <label className={field}>
          Place
          <Input
            className={input}
            list="layout-places"
            aria-label="Place"
            value={h.location ?? ""}
            onChange={(e) => onChange({ location: e.target.value || null })}
          />
        </label>
        <div className="col-span-2">
          <AcceptsEditor placeName={h.location} places={places} />
        </div>
        <Num label="X" value={h.x} onChange={(x) => onChange({ x })} />
        <Num label="Y" value={h.y} onChange={(y) => onChange({ y })} />
        <Num label="Width" value={h.width} min={6} onChange={(width) => onChange({ width })} />
        <Num label="Height" value={h.height} min={6} onChange={(height) => onChange({ height })} />
      </div>

      {(h.kind === "fridge" || h.kind === "freezer" || h.compartments.length > 0) && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Compartments</p>
          {h.compartments.map((c, i) => (
            <div key={c.key} className="grid grid-cols-[1fr_6.5rem_auto] gap-2">
              <Input
                aria-label={`Compartment ${i + 1} name`}
                className={input}
                value={c.name}
                onChange={(e) => setComp(i, { name: e.target.value })}
              />
              <Choice
                label={`Compartment ${i + 1} kind`}
                value={c.kind}
                onChange={(kind) => setComp(i, { kind: kind as Compartment["kind"] })}
                options={asOptions(COMPARTMENT_KINDS)}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11"
                aria-label={`Remove compartment ${i + 1}`}
                onClick={() => onChange({ compartments: h.compartments.filter((_, k) => k !== i) })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Input
                aria-label={`Compartment ${i + 1} place`}
                placeholder="Place"
                list="layout-places"
                className={`${input} col-span-3`}
                value={c.location ?? ""}
                onChange={(e) => setComp(i, { location: e.target.value || null })}
              />
              <div className="col-span-3">
                <AcceptsEditor placeName={c.location} places={places} />
              </div>
            </div>
          ))}
          <Button
            variant="outline"
            className="h-11 w-full"
            onClick={() => {
              const key = uniqueKey(
                h.compartments.map((c) => c.key),
                "part",
              );
              onChange({
                compartments: [
                  ...h.compartments,
                  { key, name: "New part", kind: "shelf", location: null },
                ],
              });
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> Add compartment
          </Button>
        </div>
      )}
      <Button variant="outline" className="h-11 w-full text-destructive" onClick={onDelete}>
        <Trash2 className="mr-1 h-4 w-4" /> Delete {h.name}
      </Button>
    </div>
  );
}

/** Edits the kitchen layout as a list of cabinets. Changes are kept in a draft until Save. */
export function LayoutEditor() {
  const layoutQ = useQuery(layoutQuery);
  const placesQ = useQuery(locationsQuery);
  const invalidate = useInvalidatePantry();
  const [draft, setDraft] = useState<Layout | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (layoutQ.isLoading || placesQ.isLoading) return <Loading rows={2} className="h-24" />;
  if (!layoutQ.data || !placesQ.data) return <QueryError onRetry={() => void layoutQ.refetch()} />;

  const saved = layoutQ.data;
  const layout = draft ?? saved;
  const current = layout.hotspots.find((h) => h.key === selected) ?? null;
  const edit = (next: Layout) => setDraft(next);

  async function save() {
    if (!draft) return;
    setBusy(true);
    try {
      await saveLayout(draft);
      await invalidate();
      setDraft(null);
      toast.success("Layout saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function onImport(file: File | undefined) {
    if (!file) return;
    const { layout: next, errors } = parseLayout(await file.text());
    if (!next) {
      toast.error(
        `${errors.length} ${errors.length === 1 ? "problem" : "problems"}: ${errors[0] ?? ""}`,
      );
      return;
    }
    setDraft(next);
    setSelected(null);
    toast.success(`Loaded ${next.hotspots.length} spots. Press Save to keep them.`);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <Button
          className="h-11"
          onClick={() => {
            const next = addHotspot(layout);
            edit(next);
            setSelected(next.hotspots.at(-1)?.key ?? null);
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> Add spot
        </Button>
        <Button
          variant="outline"
          className="h-11"
          onClick={() => {
            edit(DEFAULT_LAYOUT);
            setSelected(null);
          }}
        >
          <RotateCcw className="mr-1 h-4 w-4" /> Default
        </Button>
        <Button variant="outline" className="h-11" onClick={() => fileRef.current?.click()}>
          <Upload className="mr-1 h-4 w-4" /> Import
        </Button>
        <Button
          variant="outline"
          className="h-11"
          onClick={() => download("kitchen-layout.json", exportLayout(layout))}
        >
          <Download className="mr-1 h-4 w-4" /> Export
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="Layout file"
          onChange={(e) => {
            void onImport(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      <ul className="tile divide-y">
        {layout.hotspots.map((h) => (
          <li key={h.key}>
            <button
              type="button"
              aria-pressed={h.key === selected}
              onClick={() => setSelected(h.key === selected ? null : h.key)}
              className="flex min-h-12 w-full items-center justify-between px-4 text-left text-sm"
            >
              <span className="font-medium">{h.name}</span>
              <span className="text-muted-foreground">{h.door}</span>
            </button>
          </li>
        ))}
      </ul>

      {current && (
        <HotspotForm
          key={current.key}
          h={current}
          placeNames={placesQ.data.map((p) => p.name)}
          places={placesQ.data}
          onChange={(patch) => edit(updateHotspot(layout, current.key, patch))}
          onDelete={() => {
            edit(removeHotspot(layout, current.key));
            setSelected(null);
          }}
        />
      )}

      {draft && (
        <div className="sticky bottom-3 flex gap-2">
          <Button
            variant="outline"
            className="h-12"
            disabled={busy}
            onClick={() => {
              setDraft(null);
              setSelected(null);
            }}
          >
            Discard
          </Button>
          <Button className="h-12 flex-1" disabled={busy} onClick={save}>
            Save
          </Button>
        </div>
      )}
    </div>
  );
}
