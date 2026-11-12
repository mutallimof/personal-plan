import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Plus, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Empty, Loading, QueryError } from "@/components/states";
import { toDraft, exportAliases, parseAliasFile, type Alias } from "./aliases";
import { aliasesQuery, dictionary, writeAliases } from "./dictionary-data";
import { useCategoryOptions, useInvalidatePantry } from "./data";
import { normalizeReceiptText } from "./normalize";
import { LOCATION_KINDS, UNITS } from "./model";
import { IconPicker } from "./icons/IconPicker";
import { ItemIcon } from "./icons/ItemIcon";
import { resolveIcon } from "./icons/registry";
import { asOptions, Choice } from "./ui";

function AliasDialog({ alias, onClose }: { alias?: Alias | undefined; onClose: () => void }) {
  const invalidate = useInvalidatePantry();
  const categories = useCategoryOptions();
  const [raw, setRaw] = useState(alias?.raw_text ?? "");
  const [store, setStore] = useState(alias?.store ?? "");
  const [name, setName] = useState(alias?.product_name ?? "");
  const [category, setCategory] = useState(alias?.category ?? "other");
  const [kind, setKind] = useState(alias?.default_location_kind ?? "");
  const [unit, setUnit] = useState(alias?.default_unit ?? "pieces");
  const [qty, setQty] = useState(
    alias?.default_quantity != null ? String(alias.default_quantity) : "",
  );
  const [icon, setIcon] = useState<string | null>(alias?.icon ?? null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  const draft = toDraft({
    raw_text: raw,
    store,
    product_name: name,
    category,
    default_location_kind: kind || null,
    default_unit: unit,
    default_quantity: qty.trim() === "" ? null : Number(qty),
    icon,
  });

  async function save() {
    if (typeof draft === "string") return;
    setBusy(true);
    try {
      if (alias) await dictionary.update(alias.id, draft);
      else await writeAliases([draft]);
      await invalidate();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
      setBusy(false);
    }
  }

  async function remove() {
    if (!alias) return;
    setBusy(true);
    try {
      await dictionary.remove(alias.id);
      await invalidate();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove");
      setBusy(false);
    }
  }

  const label = "space-y-1 text-xs text-muted-foreground";
  const input = "h-11 text-base sm:text-sm";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{alias ? "Edit entry" : "Add entry"}</DialogTitle>
        </DialogHeader>
        {picking ? (
          <IconPicker value={icon} onPick={setIcon} onDone={() => setPicking(false)} />
        ) : (
          <div className="space-y-4">
            <label className={label}>
              Receipt text
              <Input
                className={input}
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                autoFocus={!alias}
              />
            </label>
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
                Product
                <Input className={input} value={name} onChange={(e) => setName(e.target.value)} />
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
                Usual place
                <Choice
                  label="Usual place"
                  value={kind}
                  onChange={setKind}
                  options={asOptions(LOCATION_KINDS)}
                  empty="Any"
                />
              </label>
              <label className={label}>
                Unit
                <Choice label="Unit" value={unit} onChange={setUnit} options={asOptions(UNITS)} />
              </label>
              <label className={label}>
                Quantity
                <Input
                  className={input}
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </label>
            </div>
            <label className={label}>
              Store (optional)
              <Input className={input} value={store} onChange={(e) => setStore(e.target.value)} />
            </label>
            {typeof draft === "string" && raw + name !== "" && (
              <p className="text-xs text-destructive">{draft}</p>
            )}
            <div className="flex gap-2">
              {alias && (
                <Button variant="outline" className="h-12" disabled={busy} onClick={remove}>
                  Delete
                </Button>
              )}
              <Button
                className="h-12 flex-1"
                disabled={busy || typeof draft === "string"}
                onClick={save}
              >
                Save
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function DictionaryPage() {
  const { data, isLoading, isError, refetch } = useQuery(aliasesQuery);
  const invalidate = useInvalidatePantry();
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<{ alias?: Alias } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const shown = useMemo(() => {
    const q = normalizeReceiptText(query);
    const raw = query.trim().toLowerCase();
    return (data ?? []).filter(
      (a) => !raw || (q && a.raw_text.includes(q)) || a.product_name.toLowerCase().includes(raw),
    );
  }, [data, query]);

  async function onImport(file: File | undefined) {
    if (!file) return;
    const { drafts, errors } = parseAliasFile(await file.text());
    if (!drafts.length) {
      toast.error(errors[0] ?? "Nothing to import");
      return;
    }
    try {
      const { added, updated } = await writeAliases(drafts);
      await invalidate();
      toast.success(`Imported ${added + updated} (${added} new, ${updated} updated)`);
      if (errors.length) toast.error(`${errors.length} skipped. ${errors[0]}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not import");
    }
  }

  function onExport() {
    const url = URL.createObjectURL(
      new Blob([exportAliases(data ?? [])], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "pantry-dictionary.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) return <Loading rows={4} className="h-16" />;
  if (isError) return <QueryError onRetry={() => refetch()} />;

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
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button className="h-11" onClick={() => setDialog({})}>
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-11" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-1 h-4 w-4" /> Import
          </Button>
          <Button variant="outline" className="h-11" onClick={onExport} disabled={!data?.length}>
            <Download className="mr-1 h-4 w-4" /> Export
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label="Import file"
            onChange={(e) => {
              void onImport(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {shown.length === 0 ? (
        <Empty>{query ? "Nothing matches." : "The dictionary is empty."}</Empty>
      ) : (
        <ul className="tile divide-y">
          {shown.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => setDialog({ alias: a })}
                className="flex min-h-14 w-full flex-col justify-center px-4 py-2 text-left"
              >
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {a.raw_text}
                </span>
                <span className="truncate text-sm font-medium">
                  {a.product_name}
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    · {a.category}
                    {a.store ? ` · ${a.store}` : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {dialog && (
        <AliasDialog
          key={dialog.alias?.id ?? "new"}
          alias={dialog.alias}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
