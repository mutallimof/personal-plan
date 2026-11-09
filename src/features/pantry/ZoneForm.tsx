import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adoptZone, changedZones, possibleParents, setZoneRect, type Zone } from "./kitchen";
import { kitchen } from "./kitchen-data";
import { isLocationKind, LOCATION_KINDS, type PantryLocation } from "./model";
import { asOptions, Choice, locationOptions } from "./ui";

const num = (s: string) => (s.trim() === "" ? Number.NaN : Number(s));
const RECT_LABELS = { x: "X", y: "Y", width: "Width", height: "Height" } as const;

/** Edits one zone: name, kind, linked place, parent, position and size. */
export function ZoneForm({
  zone,
  zones,
  locations,
  onSaved,
  onDelete,
}: {
  zone: Zone;
  zones: readonly Zone[];
  locations: readonly PantryLocation[];
  onSaved: () => Promise<void>;
  onDelete: () => void;
}) {
  const [name, setName] = useState(zone.name);
  const [kind, setKind] = useState(zone.kind);
  const [placeId, setPlaceId] = useState(zone.location_id ?? "");
  const [parentId, setParentId] = useState(zone.parent_id ?? "");
  const [rect, setRect] = useState({ x: String(zone.x), y: String(zone.y), width: String(zone.width), height: String(zone.height) });
  const [busy, setBusy] = useState(false);

  const values = { x: num(rect.x), y: num(rect.y), width: num(rect.width), height: num(rect.height) };
  const valid = name.trim().length > 0 && Object.values(values).every(Number.isFinite) && isLocationKind(kind);

  async function save() {
    if (!valid || !isLocationKind(kind)) return;
    setBusy(true);
    try {
      let next = parentId === (zone.parent_id ?? "") ? [...zones] : adoptZone(zones, zone.id, parentId || null);
      next = setZoneRect(next, zone.id, values);
      await kitchen.updateZone(zone.id, { name: name.trim(), kind, location_id: placeId || null, parent_id: parentId || null });
      await kitchen.saveRects(changedZones(zones, next));
      await onSaved();
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const label = "space-y-1 text-xs text-muted-foreground";
  const input = "h-11 text-base sm:text-sm";
  const parents = possibleParents(zones, zone.id).map((z) => ({ value: z.id, label: z.name }));
  return (
    <div className="space-y-3 rounded-2xl bg-card p-4">
      <label className={label}>
        Name
        <Input className={input} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          Kind
          <Choice label="Kind" value={kind} onChange={setKind} options={asOptions(LOCATION_KINDS)} />
        </label>
        <label className={label}>
          Inside
          <Choice label="Inside" value={parentId} onChange={setParentId} options={parents} empty="Nothing" />
        </label>
      </div>
      <label className={label}>
        Place
        <Choice label="Place" value={placeId} onChange={setPlaceId} options={locationOptions(locations)} empty="Not linked" />
      </label>
      <div className="grid grid-cols-4 gap-2">
        {(Object.keys(RECT_LABELS) as (keyof typeof RECT_LABELS)[]).map((k) => (
          <label key={k} className={label}>
            {RECT_LABELS[k]}
            <Input
              className={input}
              type="number"
              step="0.5"
              inputMode="decimal"
              value={rect[k]}
              onChange={(e) => setRect({ ...rect, [k]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="h-12" disabled={busy} onClick={onDelete}>
          Delete
        </Button>
        <Button className="h-12 flex-1" disabled={busy || !valid} onClick={save}>
          Save
        </Button>
      </div>
    </div>
  );
}
