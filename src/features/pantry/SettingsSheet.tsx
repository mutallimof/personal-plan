import type { ReactNode } from "react";
import { BookText, ChevronLeft, ChevronRight, LayoutGrid, Palette, Salad, Sparkles, Tags } from "lucide-react";
import { AppearanceSetting } from "@/components/AppearanceSetting";
import { Button } from "@/components/ui/button";
import { LayoutEditor } from "@/features/kitchen/LayoutEditor";
import { NutritionTab } from "@/features/cook/NutritionTab";
import { AiChatSetting } from "@/features/cook/AiChatSetting";
import { AiCheckSetting } from "./AiCheckSetting";
import { CategoriesSetting } from "./CategoriesSetting";
import { DictionaryPage } from "./DictionaryPage";
import { PantrySheet } from "./PantrySheet";
import type { SettingsSection } from "./sheets";

const SECTIONS: readonly { id: SettingsSection; label: string; icon: ReactNode }[] = [
  { id: "appearance", label: "Appearance", icon: <Palette className="h-5 w-5" /> },
  { id: "dictionary", label: "Dictionary", icon: <BookText className="h-5 w-5" /> },
  { id: "categories", label: "Categories", icon: <Tags className="h-5 w-5" /> },
  { id: "nutrition", label: "Nutrition table", icon: <Salad className="h-5 w-5" /> },
  { id: "ai", label: "AI", icon: <Sparkles className="h-5 w-5" /> },
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
          <Button variant="ghost" className="-ml-3 h-11 px-3 text-muted-foreground" onClick={() => onSection(undefined)}>
            <ChevronLeft /> Settings
          </Button>
          {section === "appearance" && <AppearanceSetting />}
          {section === "dictionary" && <DictionaryPage />}
          {section === "categories" && <CategoriesSetting />}
          {section === "nutrition" && <NutritionTab />}
          {section === "ai" && (
            <div className="space-y-3">
              <AiChatSetting />
              <AiCheckSetting />
            </div>
          )}
          {section === "layout" && <LayoutEditor />}
        </>
      ) : (
        <ul className="tile divide-y">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => onSection(s.id)} className="flex min-h-14 w-full items-center gap-3 px-4 text-left text-sm font-medium">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-muted-foreground [&_svg]:h-[18px] [&_svg]:w-[18px]">{s.icon}</span>
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
