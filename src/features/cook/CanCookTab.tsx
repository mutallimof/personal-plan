import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Empty, Loading, QueryError } from "@/components/states";
import { itemsQuery, settingsQuery } from "@/features/pantry/data";
import { rankRecipes, type Need } from "./can-cook";
import { CookScreen } from "./CookScreen";
import { activeMeals, canUndo, todayTotals } from "./cooked";
import { cook, cookedQuery, nutritionQuery, recipesQuery, useInvalidateCook } from "./data";
import { approxLabel, formatAmounts, recipeNutrition, toNutritionRows } from "./nutrition";
import { RecipeCard } from "./RecipeCard";
import { RecipeForm } from "./RecipeForm";
import { RecipesEmpty } from "./RecipesEmpty";
import { useOpenAiSettings } from "./open-settings";
import { emptyDraft, groupByRecipe, toDrafts, type RecipeDraft } from "./recipes";

type Screen = { name: "list" } | { name: "cook"; id: string } | { name: "review"; draft: RecipeDraft };

export function CanCookTab() {
  const book = useQuery(recipesQuery);
  const items = useQuery(itemsQuery);
  const nutrition = useQuery(nutritionQuery);
  const logs = useQuery(cookedQuery);
  const settings = useQuery(settingsQuery);
  const invalidate = useInvalidateCook();
  const openSettings = useOpenAiSettings();
  const [screen, setScreen] = useState<Screen>({ name: "list" });
  const [now, setNow] = useState(() => new Date());

  // Keeps "Undo" honest: it disappears on its own when the time is up.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const grouped = useMemo(() => groupByRecipe(book.data?.ingredients ?? []), [book.data]);
  const rows = useMemo(() => toNutritionRows(nutrition.data ?? []), [nutrition.data]);
  const needs = useMemo(() => new Map<string, Need[]>([...grouped].map(([id, list]) => [id, toDrafts(list)])), [grouped]);
  const ranked = useMemo(
    () => (book.data && items.data ? rankRecipes(book.data.recipes, needs, items.data, now) : []),
    [book.data, items.data, needs, now],
  );

  if (book.isLoading || items.isLoading || nutrition.isLoading || logs.isLoading || settings.isLoading) return <Loading rows={3} />;
  if (book.isError || items.isError || nutrition.isError || logs.isError || settings.isError || !book.data || !items.data || !settings.data) {
    return (
      <QueryError
        onRetry={() => {
          void book.refetch();
          void items.refetch();
          void nutrition.refetch();
          void logs.refetch();
          void settings.refetch();
        }}
      />
    );
  }
  const pantryItems = items.data;

  async function undo(id: string) {
    try {
      await cook.undoCook(id);
      await invalidate();
      toast.success("Put back in your pantry");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not undo");
    }
  }

  if (screen.name === "review") {
    return <RecipeForm initial={screen.draft} items={pantryItems} onSaved={() => setScreen({ name: "list" })} onCancel={() => setScreen({ name: "list" })} />;
  }

  if (screen.name === "cook") {
    const recipe = book.data.recipes.find((r) => r.id === screen.id);
    if (!recipe) return <Empty>That recipe is gone.</Empty>;
    return (
      <CookScreen
        recipe={recipe}
        needs={needs.get(recipe.id) ?? []}
        items={pantryItems}
        nutrition={rows}
        onCancel={() => setScreen({ name: "list" })}
        onCooked={(id, title) => {
          setScreen({ name: "list" });
          toast.success(`Cooked ${title}`, { duration: 15_000, action: { label: "Undo", onClick: () => void undo(id) } });
        }}
      />
    );
  }

  const meals = activeMeals(logs.data ?? []);
  const today = todayTotals(logs.data ?? [], now);

  return (
    <div className="space-y-6">
      {!book.data.recipes.length ? (
        <RecipesEmpty onAdd={() => setScreen({ name: "review", draft: emptyDraft() })} onOpenSettings={openSettings} aiChat={settings.data.aiChat} />
      ) : ranked.length === 0 ? (
        <Empty>Nothing you can cook right now.</Empty>
      ) : (
        <ul className="space-y-3">
          {ranked.map((c) => {
            const list = needs.get(c.recipe.id) ?? [];
            return (
              <li key={c.recipe.id}>
                <RecipeCard
                  title={c.recipe.title}
                  servings={c.recipe.servings}
                  facts={recipeNutrition(list, rows, c.recipe.servings)}
                  missing={c.missing}
                  expiring={c.expiringUsed > 0}
                  actions={
                    <Button className="h-11" onClick={() => setScreen({ name: "cook", id: c.recipe.id })}>
                      Cook this
                    </Button>
                  }
                />
              </li>
            );
          })}
        </ul>
      )}

      {meals.length > 0 && (
        <section className="space-y-2">
          <h2 className="eyebrow px-1">Cooked recently</h2>
          {today.meals > 0 && (
            <p className="tile p-4 text-sm">
              Today: {formatAmounts(today)} ({approxLabel(today.missing)})
            </p>
          )}
          <ul className="space-y-2">
            {meals.slice(0, 8).map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 tile p-4 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{m.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(m.cooked_at).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })} · {m.servings}{" "}
                    {m.servings === 1 ? "serving" : "servings"}
                  </span>
                </span>
                {canUndo(m, now) && (
                  <Button variant="outline" className="h-11 shrink-0" onClick={() => void undo(m.id)}>
                    Undo
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
