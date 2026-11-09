import { useState } from "react";
import { cn } from "@/lib/utils";
import { CanCookTab } from "./CanCookTab";
import { NutritionTab } from "./NutritionTab";
import { RecipesTab } from "./RecipesTab";

const VIEWS = [
  { id: "cook", label: "Can cook" },
  { id: "recipes", label: "Recipes" },
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
              "flex h-11 flex-1 items-center justify-center rounded-full text-sm font-medium text-muted-foreground",
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
      {view === "nutrition" && <NutritionTab />}
    </div>
  );
}
