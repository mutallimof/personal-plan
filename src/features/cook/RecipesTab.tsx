import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Empty, Loading, QueryError } from "@/components/states";
import { itemsQuery, settingsQuery } from "@/features/pantry/data";
import { cook, nutritionQuery, recipesQuery, useInvalidateCook, type Recipe } from "./data";
import { recipeNutrition, toNutritionRows } from "./nutrition";
import { lineStatus } from "./can-cook";
import { RecipeCard } from "./RecipeCard";
import { RecipeForm } from "./RecipeForm";
import { RecipesEmpty } from "./RecipesEmpty";
import { useOpenAiSettings } from "./open-settings";
import { emptyDraft, groupByRecipe, searchRecipes, toDrafts, type RecipeDraft } from "./recipes";

type Editing = { recipe?: Recipe; draft: RecipeDraft } | null;

export function RecipesTab() {
  const book = useQuery(recipesQuery);
  const items = useQuery(itemsQuery);
  const nutrition = useQuery(nutritionQuery);
  const settings = useQuery(settingsQuery);
  const openSettings = useOpenAiSettings();
  const invalidate = useInvalidateCook();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Editing>(null);

  const grouped = useMemo(() => groupByRecipe(book.data?.ingredients ?? []), [book.data]);
  const names = useMemo(() => new Map([...grouped].map(([id, list]) => [id, list.map((i) => i.name)])), [grouped]);
  const rows = useMemo(() => toNutritionRows(nutrition.data ?? []), [nutrition.data]);

  if (book.isLoading || items.isLoading || nutrition.isLoading) return <Loading rows={3} />;
  if (book.isError || items.isError || nutrition.isError || !book.data || !items.data) {
    return (
      <QueryError
        onRetry={() => {
          void book.refetch();
          void items.refetch();
          void nutrition.refetch();
        }}
      />
    );
  }
  const pantryItems = items.data;

  if (editing) {
    return (
      <RecipeForm
        initial={editing.draft}
        recipeId={editing.recipe?.id}
        items={pantryItems}
        onSaved={() => setEditing(null)}
        onCancel={() => setEditing(null)}
      />
    );
  }

  const shown = searchRecipes(book.data.recipes, names, query);

  function edit(recipe: Recipe) {
    setEditing({
      recipe,
      draft: {
        title: recipe.title,
        servings: recipe.servings,
        steps: recipe.steps,
        source: recipe.source === "ai" ? "ai" : "manual",
        ingredients: toDrafts(grouped.get(recipe.id) ?? []),
      },
    });
  }

  async function remove(recipe: Recipe) {
    if (!window.confirm(`Delete "${recipe.title}"?`)) return;
    try {
      await cook.deleteRecipe(recipe.id);
      await invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search recipes" placeholder="Search recipes" className="h-11 pl-9 text-base sm:text-sm" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Button className="h-11 shrink-0" onClick={() => setEditing({ draft: emptyDraft() })}>
          <Plus className="mr-1 h-4 w-4" /> New
        </Button>
      </div>

      {!book.data.recipes.length ? (
        <RecipesEmpty onAdd={() => setEditing({ draft: emptyDraft() })} onOpenSettings={openSettings} aiChat={settings.data?.aiChat ?? false} />
      ) : !shown.length ? (
        <Empty>Nothing found.</Empty>
      ) : (
        <ul className="space-y-3">
          {shown.map((r) => {
            const list = toDrafts(grouped.get(r.id) ?? []);
            const missing = list.map((n) => lineStatus(n, pantryItems)).filter((l) => l.state !== "ok");
            return (
              <li key={r.id}>
                <RecipeCard
                  title={r.title}
                  servings={r.servings}
                  facts={recipeNutrition(list, rows, r.servings)}
                  missing={missing}
                  actions={
                    <>
                      <Button variant="outline" className="h-11" onClick={() => edit(r)}>
                        Edit
                      </Button>
                      <Button variant="ghost" className="h-11 text-destructive" onClick={() => void remove(r)}>
                        Delete
                      </Button>
                    </>
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
