import { useState } from "react";
import { ChefHat, NotebookText, Salad, ShoppingCart, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { CanCookTab } from "./CanCookTab";
import { ChatTab } from "./ChatTab";
import { NutritionTab } from "./NutritionTab";
import { RecipesTab } from "./RecipesTab";
import { ShoppingTab } from "./ShoppingTab";

const VIEWS = [
  { id: "cook", label: "Can cook", icon: ChefHat },
  { id: "recipes", label: "Recipes", icon: NotebookText },
  { id: "chat", label: "Ask AI", icon: Sparkles },
  { id: "shopping", label: "Shopping", icon: ShoppingCart },
  { id: "nutrition", label: "Nutrition", icon: Salad },
] as const;

type View = (typeof VIEWS)[number]["id"];

export function CookPage() {
  const [view, setView] = useState<View>("cook");
  return (
    // The tabs sit at the bottom, where the dock is on other screens, so a thumb reaches them.
    <div className="flex min-h-[calc(100dvh-6.5rem)] flex-col gap-4">
      <div className="flex flex-1 flex-col">
        {view === "cook" && <CanCookTab />}
        {view === "recipes" && <RecipesTab />}
        {view === "chat" && <ChatTab />}
        {view === "shopping" && <ShoppingTab />}
        {view === "nutrition" && <NutritionTab />}
      </div>
      <div role="tablist" aria-label="Cook" className="sticky bottom-2 z-20 grid h-16 grid-cols-5 rounded-full border bg-card/95 px-1.5 shadow-pop backdrop-blur">
        {VIEWS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            className={cn(
              "group flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              view === id && "font-semibold text-foreground",
            )}
            onClick={() => setView(id)}
          >
            <span className={cn("flex h-8 w-12 items-center justify-center rounded-full transition-colors duration-200 ease-out-soft group-active:scale-95", view === id && "bg-primary text-primary-foreground")}>
              <Icon className="h-5 w-5" strokeWidth={view === id ? 2.4 : 2} aria-hidden="true" />
            </span>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
