import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChefHat, List, Plus, Receipt, Search, Settings, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CookPage } from "@/features/cook/CookPage";
import { locationsQuery } from "./data";
import { ItemDialog } from "./ItemDialog";
import { ItemsPage } from "./ItemsPage";
import { KitchenScreen } from "@/features/kitchen/KitchenScreen";
import { PantrySheet } from "./PantrySheet";
import { ReceiptPage } from "./ReceiptPage";
import { SettingsSheet } from "./SettingsSheet";
import type { PantrySearch, Sheet } from "./sheets";

/** One of the four things you do from the kitchen: a big target with the icon above the word. */
function Action({ icon: Icon, label, primary = false, onClick }: { icon: LucideIcon; label: string; primary?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="tile press flex min-h-[4.75rem] flex-col items-center justify-center gap-1.5 px-1 py-2.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className={primary ? "flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground" : "flex h-9 w-9 items-center justify-center rounded-full bg-secondary"}>
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      {label}
    </button>
  );
}

/** The Pantry screen: the kitchen with a few buttons. Everything else opens as a sheet over it. */
export function PantryHome({ search }: { search: PantrySearch }) {
  const navigate = useNavigate({ from: "/pantry/" });
  const places = useQuery(locationsQuery);
  const [adding, setAdding] = useState(false);

  const pushed = useRef(false);
  const onOpen = (key: string, item?: string) => {
    pushed.current = true;
    void navigate({ search: { ...search, open: key, item, q: undefined } });
  };
  const onClose = () => {
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else void navigate({ search: { ...search, open: undefined, item: undefined }, replace: true });
  };
  const go = (next: PantrySearch) => navigate({ search: next });
  const openSheet = (sheet: Sheet) => go({ ...search, sheet });
  const closeSheet = () => go({ ...search, sheet: undefined, section: undefined });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search"
            placeholder="Search"
            className="h-12 rounded-full pl-11 text-base sm:text-sm"
            value={search.q ?? ""}
            onChange={(e) => void navigate({ search: { ...search, q: e.target.value || undefined }, replace: true })}
            onKeyDown={(e) => e.key === "Enter" && search.q && void openSheet("items")}
          />
        </div>
        <Button variant="outline" size="icon" className="h-12 w-12 shrink-0" aria-label="Settings" onClick={() => void openSheet("settings")}>
          <Settings className="h-5 w-5" />
        </Button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <Action primary icon={Receipt} label="Add receipt" onClick={() => void openSheet("receipt")} />
        <Action icon={Plus} label="Add item" onClick={() => setAdding(true)} />
        <Action icon={ChefHat} label="Cook" onClick={() => void openSheet("cook")} />
        <Action icon={List} label="All items" onClick={() => void openSheet("items")} />
      </div>

      <KitchenScreen
        query={search.q ?? ""}
        openKey={search.open ?? null}
        highlightItemId={search.item ?? null}
        onOpen={onOpen}
        onClose={onClose}
        onShowList={() => void openSheet("items")}
      />

      {search.sheet === "receipt" && (
        <PantrySheet title="Add receipt" onClose={() => void closeSheet()}>
          <ReceiptPage />
        </PantrySheet>
      )}
      {search.sheet === "cook" && (
        <PantrySheet title="Cook" onClose={() => void closeSheet()}>
          <CookPage />
        </PantrySheet>
      )}
      {search.sheet === "items" && (
        <PantrySheet title="All items" onClose={() => void closeSheet()}>
          <ItemsPage initialQuery={search.q ?? ""} />
        </PantrySheet>
      )}
      {search.sheet === "settings" && (
        <SettingsSheet section={search.section} onSection={(section) => void go({ ...search, section })} onClose={() => void closeSheet()} />
      )}
      {adding && places.data && <ItemDialog locations={places.data} onClose={() => setAdding(false)} />}
    </div>
  );
}
