import type { ReactNode } from "react";
import { BookText, ChevronRight, LayoutGrid, Salad, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NutritionTab } from "@/features/cook/NutritionTab";
import { AiCheckSetting } from "./AiCheckSetting";
import { DictionaryPage } from "./DictionaryPage";
import { KitchenPage } from "./KitchenPage";
import { PantrySheet } from "./PantrySheet";
import type { SettingsSection } from "./sheets";

const SECTIONS: readonly { id: SettingsSection; label: string; icon: ReactNode }[] = [
  { id: "dictionary", label: "Dictionary", icon: <BookText className="h-5 w-5" /> },
  { id: "nutrition", label: "Nutrition table", icon: <Salad className="h-5 w-5" /> },
  { id: "ai", label: "AI check", icon: <Sparkles className="h-5 w-5" /> },
  { id: "layout", label: "Kitchen layout", icon: <LayoutGrid className="h-5 w-5" /> },
];

type Props = { section: SettingsSection | undefined; onSection: (s: SettingsSection | undefined) => void; onClose: () => void };

/** Rarely used settings: the list first, then one page at a time. */
export function SettingsSheet({ section, onSection, onClose }: Props) {
  const current = SECTIONS.find((s) => s.id === section);
  return (
    <PantrySheet title={current ? current.label : "Settings"} onClose={onClose}>
      {current ? (
        <>
          <Button variant="ghost" className="-ml-3 h-11" onClick={() => onSection(undefined)}>
            Settings
          </Button>
          {section === "dictionary" && <DictionaryPage />}
          {section === "nutrition" && <NutritionTab />}
          {section === "ai" && <AiCheckSetting />}
          {section === "layout" && <KitchenPage />}
        </>
      ) : (
        <ul className="divide-y rounded-2xl bg-card">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => onSection(s.id)} className="flex min-h-14 w-full items-center gap-3 px-4 text-left text-sm font-medium">
                <span className="text-muted-foreground">{s.icon}</span>
                <span className="flex-1">{s.label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </PantrySheet>
  );
}
