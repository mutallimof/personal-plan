import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChefHat, Plus, Receipt, Search, Settings } from "lucide-react";
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
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search"
            placeholder="Search"
            className="h-11 rounded-xl pl-9 text-base sm:text-sm"
            value={search.q ?? ""}
            onChange={(e) => void navigate({ search: { ...search, q: e.target.value || undefined }, replace: true })}
            onKeyDown={(e) => e.key === "Enter" && search.q && void openSheet("items")}
          />
        </div>
        <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" aria-label="Settings" onClick={() => void openSheet("settings")}>
          <Settings className="h-5 w-5" />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button className="h-11" onClick={() => void openSheet("receipt")}>
          <Receipt className="mr-1 h-4 w-4" /> Add receipt
        </Button>
        <Button variant="outline" className="h-11" onClick={() => setAdding(true)}>
          <Plus className="mr-1 h-4 w-4" /> Add item
        </Button>
        <Button variant="outline" className="h-11" onClick={() => void openSheet("cook")}>
          <ChefHat className="mr-1 h-4 w-4" /> Cook
        </Button>
        <Button variant="ghost" className="h-11 text-muted-foreground" onClick={() => void openSheet("items")}>
          All items
        </Button>
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
