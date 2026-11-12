import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { pantry, useCategoryOptions, useInvalidatePantry } from "./data";
import { IconPicker } from "./icons/IconPicker";
import { ItemIcon } from "./icons/ItemIcon";
import { resolveIcon } from "./icons/registry";
import {
  isCategory,
  isUnit,
  UNITS,
  type PantryItem,
  type PantryLocation,
} from "./model";
import { asOptions, Choice, locationOptions, Stepper } from "./ui";

type Props = {
  /** Item to edit; omit to add a new one. */
  item?: PantryItem | undefined;
  locations: readonly PantryLocation[];
  /** Place preselected for a new item. */
  defaultLocationId?: string;
  onClose: () => void;
};

export function ItemDialog({ item, locations, defaultLocationId = "", onClose }: Props) {
  const invalidate = useInvalidatePantry();
  const categories = useCategoryOptions();
  const [name, setName] = useState(item?.name ?? "");
  const [quantity, setQuantity] = useState(item ? String(item.quantity) : "1");
  const [unit, setUnit] = useState(item?.unit ?? "pieces");
  const [category, setCategory] = useState(item?.category ?? "other");
  const [locationId, setLocationId] = useState(item ? (item.location_id ?? "") : defaultLocationId);
  const [expires, setExpires] = useState(item?.expires_on ?? "");
  const [note, setNote] = useState(item?.note ?? "");
  const [icon, setIcon] = useState<string | null>(item?.icon ?? null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  const qty = Number(quantity);
  const valid = name.trim().length > 0 && Number.isFinite(qty) && qty >= 0;

  async function save() {
    if (!valid || !isUnit(unit) || !isCategory(category)) return;
    setBusy(true);
    const fields = {
      name: name.trim(),
      quantity: qty,
      unit,
      category,
      location_id: locationId || null,
      expires_on: expires || null,
      note: note.trim() || null,
      icon,
    };
    try {
      if (item) {
        await pantry.updateItem(item.id, fields);
      } else {
        const merged = await pantry.addItem(fields);
        if (merged) toast.success(`Added to your ${merged.name}`);
      }
      await invalidate();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!item) return;
    setBusy(true);
    try {
      await pantry.removeItem(item.id);
      await invalidate();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove");
      setBusy(false);
    }
  }

  const label = "space-y-1 text-xs text-muted-foreground";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? "Edit item" : "Add item"}</DialogTitle>
        </DialogHeader>
        {picking ? (
          <IconPicker value={icon} onPick={setIcon} onDone={() => setPicking(false)} />
        ) : (
          <div className="space-y-4">
            <div className="flex items-end gap-3">
              <button
                type="button"
                aria-label="Change icon"
                onClick={() => setPicking(true)}
                className="flex h-14 w-14 shrink-0 items-center justify-center tile focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ItemIcon icon={resolveIcon({ icon, name, category })} className="h-10 w-10" />
              </button>
              <label className={`${label} min-w-0 flex-1`}>
                Name
                <Input
                  className="h-11 text-base sm:text-sm"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus={!item}
                />
              </label>
            </div>

            <div className="grid grid-cols-[1fr_7rem] items-end gap-3">
              <div className={label}>
                Quantity
                <Stepper
                  value={qty || 0}
                  unit={isUnit(unit) ? unit : "pieces"}
                  onChange={(n) => setQuantity(String(Math.max(0, n)))}
                >
                  <Input
                    aria-label="Quantity"
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    className="h-11 min-w-0 text-center text-base sm:text-sm"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </Stepper>
              </div>
              <label className={label}>
                Unit
                <Choice label="Unit" value={unit} onChange={setUnit} options={asOptions(UNITS)} />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className={label}>
                Category
                <Choice
                  label="Category"
                  value={category}
                  onChange={setCategory}
                  options={categories}
                />
              </label>
              <label className={label}>
                Place
                <Choice
                  label="Place"
                  value={locationId}
                  onChange={setLocationId}
                  options={locationOptions(locations)}
                  empty="No place"
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className={label}>
                Expires
                <Input
                  type="date"
                  className="h-11 text-base sm:text-sm"
                  value={expires}
                  onChange={(e) => setExpires(e.target.value)}
                />
              </label>
              <label className={label}>
                Note
                <Input
                  className="h-11 text-base sm:text-sm"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
            </div>

            <div className="flex gap-2">
              {item && (
                <Button variant="outline" className="h-12" disabled={busy} onClick={remove}>
                  Remove
                </Button>
              )}
              <Button className="h-12 flex-1" disabled={busy || !valid} onClick={save}>
                {item ? "Save" : "Add"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
