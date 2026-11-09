import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { childrenOf, itemsInZone, type Zone } from "./kitchen";
import { CATEGORY_EMOJI, isCategory, type PantryItem } from "./model";
import { ExpiryBadge } from "./ui";

function ItemLine({ item, today, onEdit }: { item: PantryItem; today: Date; onEdit: (i: PantryItem) => void }) {
  return (
    <li>
      <button type="button" onClick={() => onEdit(item)} className="flex min-h-11 w-full items-center gap-3 px-3 text-left" aria-label={`Edit ${item.name}`}>
        <span aria-hidden>{isCategory(item.category) ? CATEGORY_EMOJI[item.category] : CATEGORY_EMOJI.other}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.name}</span>
        <ExpiryBadge expiresOn={item.expires_on} today={today} />
        <span className="text-sm tabular-nums text-muted-foreground">
          {item.quantity} {item.unit}
        </span>
      </button>
    </li>
  );
}

function Section({
  zone,
  items,
  today,
  heading,
  onEdit,
  onAdd,
}: {
  zone: Zone;
  items: readonly PantryItem[];
  today: Date;
  heading: string;
  onEdit: (i: PantryItem) => void;
  onAdd: (z: Zone) => void;
}) {
  const own = itemsInZone(items, zone);
  return (
    <section className="space-y-1.5">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {heading} · {own.length}
        </h3>
        {zone.location_id && (
          <Button variant="ghost" className="h-11 px-3" onClick={() => onAdd(zone)} aria-label={`Add item to ${zone.name}`}>
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>
      {own.length > 0 && (
        <ul className="divide-y rounded-2xl bg-card">
          {own.map((i) => (
            <ItemLine key={i.id} item={i} today={today} onEdit={onEdit} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** What is in a zone: its own items, then each compartment inside it. */
export function ZoneDetails({
  zone,
  zones,
  items,
  today,
  onEdit,
  onAdd,
}: {
  zone: Zone;
  zones: readonly Zone[];
  items: readonly PantryItem[];
  today: Date;
  onEdit: (i: PantryItem) => void;
  onAdd: (z: Zone) => void;
}) {
  const kids = childrenOf(zones, zone.id);
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{zone.name}</h2>
      {!zone.location_id && <p className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Not linked to a place.</p>}
      {zone.location_id && <Section zone={zone} items={items} today={today} heading={kids.length ? "Loose" : "Items"} onEdit={onEdit} onAdd={onAdd} />}
      {kids.map((k) => (
        <Section key={k.id} zone={k} items={items} today={today} heading={k.name} onEdit={onEdit} onAdd={onAdd} />
      ))}
    </div>
  );
}
