import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Plus, RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loading, QueryError } from "@/components/states";
import { itemsQuery, locationsQuery, pantry, useInvalidatePantry } from "./data";
import { ItemDialog } from "./ItemDialog";
import { KitchenMap } from "./KitchenMap";
import { DEFAULT_LAYOUT, changedZones, childrenOf, descendantIds, exportLayout, itemsInZone, parseLayout, type Layout, type Zone } from "./kitchen";
import { applyLayout, kitchen, zonesQuery } from "./kitchen-data";
import type { PantryItem } from "./model";
import { ZoneDetails } from "./ZoneDetails";
import { ZoneForm } from "./ZoneForm";

type ItemDialogState = { item?: PantryItem; locationId?: string } | null;
type Confirm = { title: string; description: string; action: string; run: () => Promise<void> } | null;

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function KitchenPage() {
  const zonesQ = useQuery(zonesQuery);
  const itemsQ = useQuery(itemsQuery);
  const locationsQ = useQuery(locationsQuery);
  const invalidate = useInvalidatePantry();
  const today = useMemo(() => new Date(), []);
  const [editing, setEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoomId, setZoomId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Zone[] | null>(null);
  const [itemDialog, setItemDialog] = useState<ItemDialogState>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (zonesQ.isLoading || itemsQ.isLoading || locationsQ.isLoading) return <Loading rows={2} className="h-56" />;
  if (zonesQ.isError || itemsQ.isError || locationsQ.isError || !zonesQ.data || !itemsQ.data || !locationsQ.data) {
    return (
      <QueryError
        onRetry={() => {
          void zonesQ.refetch();
          void itemsQ.refetch();
          void locationsQ.refetch();
        }}
      />
    );
  }
  const saved = zonesQ.data;
  const zones = draft ?? saved;
  const items = itemsQ.data;
  const places = locationsQ.data;
  const selected = zones.find((z) => z.id === selectedId) ?? null;
  const zoomed = zones.find((z) => z.id === zoomId) ?? null;

  function select(id: string | null) {
    setSelectedId(id);
    if (id && !editing && childrenOf(zones, id).length) setZoomId(id);
  }

  function zoomOut() {
    setZoomId(zoomed?.parent_id ?? null);
    setSelectedId(zoomed?.id ?? null);
  }

  async function commit(before: Zone[], after: Zone[]) {
    setDraft(after);
    try {
      await kitchen.saveRects(changedZones(before, after));
      await invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setDraft(null);
    }
  }

  async function moveItem(item: PantryItem, target: Zone) {
    if (!target.location_id) {
      toast.error(`${target.name} is not linked to a place.`);
      return;
    }
    if (item.location_id === target.location_id) return;
    try {
      await pantry.moveItem(item, target.location_id);
      await invalidate();
      toast.success(`Moved ${item.name} to ${target.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not move");
    }
  }

  async function addZone() {
    try {
      const z = await kitchen.addZone("New zone", "other", { x: 5, y: 5, width: 20, height: 12 }, zones.length);
      await invalidate();
      setSelectedId(z.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add");
    }
  }

  /** Runs a layout replacement or zone deletion after the person confirmed. */
  async function runConfirmed() {
    const c = confirm;
    setConfirm(null);
    if (!c) return;
    try {
      await c.run();
      setSelectedId(null);
      setZoomId(null);
      await invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  function askReplace(layout: Layout, title: string) {
    setConfirm({
      title,
      description: "Your pantry places and items stay as they are.",
      action: "Replace",
      run: () => applyLayout(layout),
    });
  }

  async function onImport(file: File | undefined) {
    if (!file) return;
    const { layout, errors } = parseLayout(await file.text());
    if (!layout) {
      toast.error(`${errors.length} ${errors.length === 1 ? "problem" : "problems"}. ${errors[0] ?? ""}`);
      return;
    }
    askReplace(layout, `Replace your layout with ${layout.zones.length} zones?`);
  }

  const overview = zones.filter((z) => !z.parent_id);
  const countIn = (z: Zone) => [z, ...descendantIds(zones, z.id).map((id) => zones.find((o) => o.id === id) as Zone)].reduce((n, o) => n + itemsInZone(items, o).length, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {zoomed && !editing && (
          <Button variant="ghost" className="h-11 px-3" onClick={zoomOut}>
            <ArrowLeft className="mr-1 h-4 w-4" /> {zoomed.parent_id ? "Back" : "Kitchen"}
          </Button>
        )}
        <Button
          variant={editing ? "default" : "outline"}
          className="ml-auto h-11"
          onClick={() => {
            setEditing(!editing);
            setDraft(null);
          }}
        >
          {editing ? "Done" : "Edit layout"}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <KitchenMap
          zones={zones}
          items={items}
          selectedId={selectedId}
          zoomId={editing ? null : zoomId}
          editing={editing}
          onSelect={select}
          onDraft={setDraft}
          onCommit={commit}
          onMoveItem={moveItem}
        />

        <aside className="space-y-4">
          {editing ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Button className="h-11" onClick={addZone}>
                  <Plus className="mr-1 h-4 w-4" /> Add zone
                </Button>
                <Button variant="outline" className="h-11" onClick={() => askReplace(DEFAULT_LAYOUT, "Go back to the default layout?")}>
                  <RotateCcw className="mr-1 h-4 w-4" /> Default
                </Button>
                <Button variant="outline" className="h-11" onClick={() => fileRef.current?.click()}>
                  <Upload className="mr-1 h-4 w-4" /> Import
                </Button>
                <Button variant="outline" className="h-11" disabled={!saved.length} onClick={() => download("kitchen-layout.json", exportLayout(saved, places))}>
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
              {selected && (
                <ZoneForm
                  key={`${selected.id}:${selected.name}:${selected.x}:${selected.y}:${selected.width}:${selected.height}:${selected.parent_id}:${selected.location_id}`}
                  zone={selected}
                  zones={zones}
                  locations={places}
                  onSaved={invalidate}
                  onDelete={() =>
                    setConfirm({
                      title: `Delete ${selected.name}?`,
                      description: "Zones inside it go too. The place and its items stay.",
                      action: "Delete",
                      run: () => kitchen.removeZone(selected.id),
                    })
                  }
                />
              )}
            </>
          ) : selected ? (
            <ZoneDetails
              zone={selected}
              zones={zones}
              items={items}
              today={today}
              onEdit={(item) => setItemDialog({ item })}
              onAdd={(z) => setItemDialog({ locationId: z.location_id ?? "" })}
            />
          ) : (
            <ul className="divide-y rounded-2xl bg-card">
              {overview.map((z) => (
                <li key={z.id}>
                  <button type="button" onClick={() => select(z.id)} className="flex min-h-12 w-full items-center justify-between px-4 text-left text-sm">
                    <span className="font-medium">{z.name}</span>
                    <span className="tabular-nums text-muted-foreground">{countIn(z)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      {itemDialog && (
        <ItemDialog
          key={itemDialog.item?.id ?? "new"}
          item={itemDialog.item}
          locations={places}
          defaultLocationId={itemDialog.locationId ?? ""}
          onClose={() => setItemDialog(null)}
        />
      )}

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">Cancel</AlertDialogCancel>
            <AlertDialogAction className="h-11" onClick={runConfirmed}>
              {confirm?.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
