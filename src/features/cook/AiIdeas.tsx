import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { PantryItem } from "@/features/pantry/model";
import type { PantrySettings } from "@/features/pantry/data";
import { aiDraft, pantrySummary, type AiRecipe } from "./ai-recipes";
import { suggestRecipes } from "./ai-recipes.functions";
import { cook, useInvalidateCook } from "./data";
import { recipeNutrition, type NutritionRow } from "./nutrition";
import { RecipeCard } from "./RecipeCard";
import type { RecipeDraft } from "./recipes";

type Props = {
  settings: PantrySettings;
  items: readonly PantryItem[];
  nutrition: readonly NutritionRow[];
  /** Opens the recipe form with the idea filled in. Nothing is saved until the form is saved. */
  onReview: (draft: RecipeDraft) => void;
};

/** Optional recipe ideas from the AI provider. Off by default; only ingredient names and quantities are sent. */
export function AiIdeas({ settings, items, nutrition, onReview }: Props) {
  const ask = useServerFn(suggestRecipes);
  const invalidate = useInvalidateCook();
  const [ideas, setIdeas] = useState<AiRecipe[]>([]);
  const [busy, setBusy] = useState(false);

  async function toggle(on: boolean) {
    try {
      await cook.setAiRecipes(on);
      if (!on) setIdeas([]);
      await invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  }

  async function getIdeas() {
    setBusy(true);
    try {
      const res = await ask({ data: { lines: pantrySummary(items) } });
      if (res.ok) setIdeas(res.recipes);
      else toast.error(res.error);
      await invalidate();
    } catch {
      toast.error("The AI request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-2xl bg-card px-4 py-2 text-sm">
      <label className="flex min-h-11 items-center justify-between">
        AI recipe ideas
        <Switch checked={settings.aiRecipes} onCheckedChange={toggle} aria-label="AI recipe ideas" />
      </label>
      {(settings.aiRecipes || settings.aiRecipeRequests > 0) && (
        <p className="text-xs text-muted-foreground">
          {settings.aiRecipeRequests} {settings.aiRecipeRequests === 1 ? "request" : "requests"} so far
        </p>
      )}
      {settings.aiRecipes && (
        <Button variant="outline" className="mb-2 h-11 w-full" disabled={busy || !items.length} onClick={() => void getIdeas()}>
          {busy ? "Asking" : "Get ideas"}
        </Button>
      )}
      {ideas.length > 0 && (
        <ul className="space-y-3 pb-2">
          {ideas.map((idea, i) => {
            const draft = aiDraft(idea, items);
            return (
              <li key={`${idea.title}-${i}`}>
                <RecipeCard
                  className="bg-background"
                  title={idea.title}
                  servings={idea.servings}
                  facts={recipeNutrition(draft.ingredients, nutrition, idea.servings)}
                  actions={
                    <Button className="h-11" onClick={() => onReview(draft)}>
                      Review and save
                    </Button>
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
