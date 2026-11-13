import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ItemIcon } from "./ItemIcon";
import { searchIcons } from "./registry";

type Props = {
  /** The icon chosen now; null means the automatic one. */
  value: string | null;
  onPick: (key: string | null) => void;
  onDone: () => void;
};

/** Searchable grid of product pictures. "Automatic" goes back to the picture the app would choose. */
export function IconPicker({ value, onPick, onDone }: Props) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => searchIcons(query), [query]);
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search icons"
            placeholder="Search icons"
            className="h-11 rounded-xl pl-9 text-base sm:text-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
        <Button variant="outline" className="h-11" onClick={() => onPick(null)}>
          Automatic
        </Button>
      </div>
      <ul className="grid max-h-72 grid-cols-5 gap-1 overflow-y-auto sm:grid-cols-6">
        {shown.map((i) => (
          <li key={i.key}>
            <button
              type="button"
              aria-label={i.label}
              title={i.label}
              aria-pressed={value === i.key}
              onClick={() => onPick(i.key)}
              className={cn(
                "flex h-12 w-full items-center justify-center rounded-xl border border-transparent hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                value === i.key && "border-primary bg-card",
              )}
            >
              <ItemIcon icon={i.key} className="h-8 w-8" />
            </button>
          </li>
        ))}
        {shown.length === 0 && (
          <li className="col-span-full py-6 text-center text-sm text-muted-foreground">
            No icon found.
          </li>
        )}
      </ul>
      <Button className="h-11 w-full" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}
