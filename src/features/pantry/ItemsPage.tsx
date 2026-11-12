import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Empty, Loading, QueryError } from "@/components/states";
import { itemsQuery, locationsQuery, pantry, useCategoryOptions, useInvalidatePantry } from "./data";
import { formatAmount } from "./amounts";
import { ItemDialog } from "./ItemDialog";
import { OrganizeDialog } from "./OrganizeDialog";
import { proposeMoves } from "./organize";
import { filterItems, groupByLocation, NO_FILTER, roundQty, type ItemFilter } from "./items";
import { emojiForCategory } from "./categories";
import { isUnit, type PantryItem } from "./model";
import { Choice, ExpiryBadge, locationOptions, Stepper } from "./ui";

type Dialog = { item?: PantryItem } | { organize: true } | null;

function ItemRow({ item, today, onEdit }: { item: PantryItem; today: Date; onEdit: () => void }) {
  const invalidate = useInvalidatePantry();
  const unit = isUnit(item.unit) ? item.unit : "pieces";

  async function change(next: number) {
    try {
      if (next > 0) {
        await pantry.updateItem(item.id, { quantity: roundQty(next) });
      } else {
        await pantry.removeItem(item.id);
        toast(`Removed ${item.name}`, {
          action: {
            label: "Undo",
            onClick: () => {
              const { id: _id, user_id: _user, added_at: _added, ...rest } = item;
              pantry.addItem(rest).then(invalidate, () => toast.error("Could not undo"));
            },
          },
        });
      }
      await invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  }

  return (
    <li className="flex items-center gap-2 px-3 py-2">
      <button type="button" onClick={onEdit} className="min-h-11 min-w-0 flex-1 text-left" aria-label={`Edit ${item.name}`}>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="truncate font-medium">{item.name}</span>
          <ExpiryBadge expiresOn={item.expires_on} today={today} />
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {emojiForCategory(item.category)} {item.category}
          {item.note ? ` · ${item.note}` : ""}
        </span>
      </button>
      <Stepper value={item.quantity} unit={unit} onChange={change}>
        <span className="min-w-16 text-center text-sm tabular-nums">
          {formatAmount(item.quantity, item.unit)}
        </span>
      </Stepper>
    </li>
  );
}

export function ItemsPage({ initialQuery = "" }: { initialQuery?: string }) {
  const items = useQuery(itemsQuery);
  const categories = useCategoryOptions();
  const invalidateAll = useInvalidatePantry();
  const locations = useQuery(locationsQuery);
  const [filter, setFilter] = useState<ItemFilter>({ ...NO_FILTER, query: initialQuery });
  const [dialog, setDialog] = useState<Dialog>(null);
  const today = useMemo(() => new Date(), []);

  const moves = useMemo(() => proposeMoves(items.data ?? [], locations.data ?? []), [items.data, locations.data]);
  const needsCategory = useMemo(
    () => filterItems(items.data ?? [], locations.data ?? [], filter).filter((i) => i.category === "other"),
    [items.data, locations.data, filter],
  );
  const groups = useMemo(
    () => groupByLocation(filterItems(items.data ?? [], locations.data ?? [], filter), locations.data ?? []),
    [items.data, locations.data, filter],
  );

  if (items.isLoading || locations.isLoading) return <Loading rows={3} className="h-28" />;
  if (items.isError || locations.isError) {
    return (
      <QueryError
        onRetry={() => {
          void items.refetch();
          void locations.refetch();
        }}
      />
    );
  }

  const places = locations.data ?? [];
  const filtering = filter.query || filter.category || filter.locationId;

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search"
              placeholder="Search"
              className="h-11 rounded-xl pl-9 text-base sm:text-sm"
              value={filter.query}
              onChange={(e) => setFilter({ ...filter, query: e.target.value })}
            />
          </div>
          {moves.length > 0 && (
            <Button variant="outline" className="h-11" onClick={() => setDialog({ organize: true })}>
              Organize
            </Button>
          )}
          <Button className="h-11" onClick={() => setDialog({})}>
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Choice
            label="Category"
            value={filter.category}
            onChange={(category) => setFilter({ ...filter, category })}
            options={categories}
            empty="All categories"
          />
          <Choice
            label="Place"
            value={filter.locationId}
            onChange={(locationId) => setFilter({ ...filter, locationId })}
            options={locationOptions(places)}
            empty="All places"
          />
        </div>
      </div>

      {needsCategory.length > 0 && (
        <section className="space-y-1.5">
          <h2 className="eyebrow px-1">Needs a category · {needsCategory.length}</h2>
          <ul className="tile divide-y">
            {needsCategory.map((i) => (
              <li key={i.id} className="flex items-center gap-2 px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{i.name}</span>
                <Choice
                  label={`Category of ${i.name}`}
                  className="w-44"
                  value="other"
                  options={categories}
                  onChange={(category) => {
                    if (!category || category === "other") return;
                    pantry.updateItem(i.id, { category }).then(
                      () => invalidateAll(),
                      () => toast.error("Could not save"),
                    );
                  }}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {groups.length === 0 ? (
        <Empty
          action={
            filtering ? (
              <Button variant="outline" className="h-11" onClick={() => setFilter(NO_FILTER)}>
                Clear filters
              </Button>
            ) : (
              <Button className="h-11" onClick={() => setDialog({})}>
                Add your first item
              </Button>
            )
          }
        >
          {filtering ? "Nothing matches." : "Your pantry is empty."}
        </Empty>
      ) : (
        groups.map((g) => (
          <section key={g.id ?? "none"} className="space-y-1.5">
            <h2 className="eyebrow px-1">
              {g.label} · {g.items.length}
            </h2>
            <ul className="tile divide-y">
              {g.items.map((i) => (
                <ItemRow key={i.id} item={i} today={today} onEdit={() => setDialog({ item: i })} />
              ))}
            </ul>
          </section>
        ))
      )}

      {dialog && "organize" in dialog && <OrganizeDialog moves={moves} locations={places} onClose={() => setDialog(null)} />}
      {dialog && !("organize" in dialog) && (
        <ItemDialog
          key={dialog.item?.id ?? "new"}
          item={dialog.item}
          locations={places}
          defaultLocationId={filter.locationId}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
