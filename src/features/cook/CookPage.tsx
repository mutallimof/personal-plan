import { useState } from "react";
import { cn } from "@/lib/utils";
import { CanCookTab } from "./CanCookTab";
import { ChatTab } from "./ChatTab";
import { NutritionTab } from "./NutritionTab";
import { RecipesTab } from "./RecipesTab";
import { ShoppingTab } from "./ShoppingTab";

const VIEWS = [
  { id: "cook", label: "Can cook" },
  { id: "recipes", label: "Recipes" },
  { id: "chat", label: "Ask AI" },
  { id: "shopping", label: "Shopping" },
  { id: "nutrition", label: "Nutrition" },
] as const;

type View = (typeof VIEWS)[number]["id"];

export function CookPage() {
  const [view, setView] = useState<View>("cook");
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Cook" className="flex gap-1 rounded-full bg-card p-1">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={view === v.id}
            className={cn(
              "flex h-11 min-w-0 flex-1 items-center justify-center rounded-full px-1 text-[13px] font-medium text-muted-foreground sm:text-sm",
              view === v.id && "bg-background text-foreground shadow-sm",
            )}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>
      {view === "cook" && <CanCookTab />}
      {view === "recipes" && <RecipesTab />}
      {view === "chat" && <ChatTab />}
      {view === "shopping" && <ShoppingTab />}
      {view === "nutrition" && <NutritionTab />}
    </div>
  );
}
