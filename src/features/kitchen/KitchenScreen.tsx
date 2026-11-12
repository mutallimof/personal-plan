import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, MoveRight, Trash2 } from "lucide-react";
import { Loading, QueryError } from "@/components/states";
import { itemsQuery, locationsQuery, pantry, useInvalidatePantry } from "@/features/pantry/data";
import { aliasesQuery } from "@/features/pantry/dictionary-data";
import { ItemIcon } from "@/features/pantry/icons/ItemIcon";
import { aliasIconMap, iconForItem } from "@/features/pantry/icons/registry";
import { ItemDialog } from "@/features/pantry/ItemDialog";
import type { PantryItem } from "@/features/pantry/model";
import { Choice, locationOptions } from "@/features/pantry/ui";
import { badgeText, interiorRows, type Row } from "./interior";
import { contentsOf } from "./contents";
import type { Hotspot } from "./layout";
import { layoutQuery } from "./layout-data";
import { placeByName, searchItems, type SearchHit } from "./locate";
import { KitchenScene } from "./KitchenScene";

type Props = {
  query: string;
  openKey: string | null;
  highlightItemId: string | null;
  onOpen: (key: string, itemId?: string) => void;
  onClose: () => void;
  /** A search result that is not on the kitchen: show it in the full list. */
  onShowList: () => void;
};

type Dialog =
  | { kind: "edit"; item: PantryItem }
  | { kind: "add"; locationId: string }
  | { kind: "move"; item: PantryItem }
  | null;

export function KitchenScreen({
  query,
  openKey,
  highlightItemId,
  onOpen,
  onClose,
  onShowList,
}: Props) {
  const layoutQ = useQuery(layoutQuery);
  const itemsQ = useQuery(itemsQuery);
  const placesQ = useQuery(locationsQuery);
  const aliasesQ = useQuery(aliasesQuery);
  const invalidate = useInvalidatePantry();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [rowList, setRowList] = useState<{ hotspot: string; row: string } | null>(null);
  const aliasIcons = useMemo(() => aliasIconMap(aliasesQ.data ?? []), [aliasesQ.data]);

  useEffect(() => {
    if (!openKey || dialog) return;
    const on = (e: KeyboardEvent) => e.key === "Escape" && !e.defaultPrevented && onClose();
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [openKey, dialog, onClose]);

  if (layoutQ.isLoading || itemsQ.isLoading || placesQ.isLoading)
    return <Loading rows={1} className="h-80" />;
  if (!layoutQ.data || !itemsQ.data || !placesQ.data) {
    return (
      <QueryError
        onRetry={() => {
          void layoutQ.refetch();
          void itemsQ.refetch();
          void placesQ.refetch();
        }}
      />
    );
  }
  const layout = layoutQ.data;
  const items = itemsQ.data;
  const places = placesQ.data;
  const hits = searchItems(items, places, layout, query);

  async function run(job: () => Promise<void>, ok?: string) {
    try {
      await job();
      await invalidate();
      if (ok) toast.success(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  }

  function dropOnRow(item: PantryItem, _h: Hotspot, row: Row) {
    const place = placeByName(places, row.place);
    if (!place) {
      toast.error(`${row.label ?? "That spot"} has no place yet.`);
      return;
    }
    const shelf = row.shelf;
    if (item.location_id === place.id) {
      if (shelf !== null && shelf !== item.shelf)
        void run(() => pantry.updateItem(item.id, { shelf }));
      return;
    }
    void run(() => pantry.moveItem(item, place.id, shelf), `Moved ${item.name}`);
  }

  function pick(hit: SearchHit) {
    if (hit.spot) onOpen(hit.spot.hotspot.key, hit.item.id);
    else onShowList();
  }

  const listed = rowList
    ? (() => {
        const h = layout.hotspots.find((x) => x.key === rowList.hotspot);
        const row = h ? interiorRows(h).find((r) => r.id === rowList.row) : undefined;
        if (!h || !row) return null;
        return { h, row, items: contentsOf(layout, items, places).get(h.key)?.get(row.id) ?? [] };
      })()
    : null;
  const moving = dialog?.kind === "move" ? dialog.item : null;

  return (
    <div className="space-y-3">
      {query.trim() !== "" && (
        <ul className="tile divide-y" aria-label="Search results">
          {hits.map((h) => (
            <li key={h.item.id}>
              <button
                type="button"
                onClick={() => pick(h)}
                className="flex min-h-12 w-full items-center gap-3 px-3 text-left"
              >
                <ItemIcon icon={iconForItem(h.item, aliasIcons)} className="h-8 w-8 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{h.item.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {h.spot ? h.path : `${h.path} · not on the map`}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {hits.length === 0 && (
            <li className="px-4 py-3 text-sm text-muted-foreground">Nothing found.</li>
          )}
        </ul>
      )}

      <KitchenScene
        layout={layout}
        items={items}
        locations={places}
        aliasIcons={aliasIcons}
        openKey={openKey}
        highlightItemId={highlightItemId}
        onOpen={(key) => onOpen(key)}
        onClose={onClose}
        onSelectItem={(item) => setDialog({ kind: "edit", item })}
        onDropOnRow={dropOnRow}
        onDropOutside={(item) => setDialog({ kind: "move", item })}
        onOpenRow={(h, row) => setRowList({ hotspot: h.key, row: row.id })}
        onAdd={(h, row) => setRowList({ hotspot: h.key, row: row.id })}
      />
      <p className="text-center text-xs text-muted-foreground">
        Icons:{" "}
        <a
          className="underline"
          href="https://github.com/jdecked/twemoji"
          target="_blank"
          rel="noreferrer"
        >
          Twemoji
        </a>
        , CC-BY 4.0
      </p>

      {listed && !dialog && (
        <Dialog open onOpenChange={(o) => !o && setRowList(null)}>
          <DialogContent className="max-h-[85dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{listed.row.label ?? listed.h.name}</DialogTitle>
            </DialogHeader>
            {listed.items.length > 0 && (
              <ul className="tile divide-y" aria-label="Items">
                {listed.items.map((it) => (
                  <li key={it.id} className="flex items-center gap-2 py-2 pl-3 pr-1">
                    <ItemIcon icon={iconForItem(it, aliasIcons)} className="h-8 w-8 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{it.name}</span>
                      <span className="block text-xs text-muted-foreground">{badgeText(it)}</span>
                    </span>
                    <Button type="button" variant="ghost" size="icon" className="h-11 w-11" aria-label={`Edit ${it.name}`} onClick={() => setDialog({ kind: "edit", item: it })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-11 w-11" aria-label={`Move ${it.name}`} onClick={() => setDialog({ kind: "move", item: it })}>
                      <MoveRight className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-11 w-11" aria-label={`Remove ${it.name}`} onClick={() => void run(() => pantry.removeItem(it.id), `Removed ${it.name}`)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <Button
              className="h-12"
              onClick={() =>
                setDialog({ kind: "add", locationId: placeByName(places, listed.row.place)?.id ?? "" })
              }
            >
              <Plus className="mr-1 h-4 w-4" /> Add
            </Button>
          </DialogContent>
        </Dialog>
      )}
      {dialog?.kind === "edit" && (
        <ItemDialog
          key={dialog.item.id}
          item={dialog.item}
          locations={places}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "add" && (
        <ItemDialog
          locations={places}
          defaultLocationId={dialog.locationId}
          onClose={() => setDialog(null)}
        />
      )}
      {moving && (
        <MoveDialog
          item={moving}
          onClose={() => setDialog(null)}
          onMove={(id) => run(() => pantry.moveItem(moving, id || null), `Moved ${moving.name}`)}
          places={places}
        />
      )}
    </div>
  );
}

function MoveDialog({
  item,
  places,
  onMove,
  onClose,
}: {
  item: PantryItem;
  places: Parameters<typeof locationOptions>[0];
  onMove: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const [target, setTarget] = useState(item.location_id ?? "");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move {item.name}</DialogTitle>
        </DialogHeader>
        <Choice
          label="Place"
          value={target}
          onChange={setTarget}
          options={locationOptions(places)}
          empty="No place"
        />
        <Button
          className="h-12"
          onClick={async () => {
            await onMove(target);
            onClose();
          }}
        >
          Move
        </Button>
      </DialogContent>
    </Dialog>
  );
}
