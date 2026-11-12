import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { Change } from "./cook-plan";
import type { CookedLog } from "./cooked";
import type { Amounts } from "./nutrition";
import { NUTRITION_SEED } from "./nutrition-seed";
import { cleanIngredients, type RecipeDraft } from "./recipes";

export type Recipe = Tables<"recipes">;
export type RecipeIngredient = Tables<"recipe_ingredients">;
export type NutritionDbRow = Tables<"ingredient_nutrition">;

async function uid() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export type RecipeBook = { recipes: Recipe[]; ingredients: RecipeIngredient[] };

export const recipesQuery = queryOptions({
  queryKey: ["cook", "recipes"],
  queryFn: async (): Promise<RecipeBook> => ({
    recipes: check(await supabase.from("recipes").select("*").order("title")) ?? [],
    ingredients: check(await supabase.from("recipe_ingredients").select("*").order("position")) ?? [],
  }),
});

/** Fills the nutrition table from the open dataset the first time, never again (so rows you delete stay deleted). */
async function ensureNutritionSeed(): Promise<void> {
  const user_id = await uid();
  const settings = check(await supabase.from("pantry_settings").select("nutrition_seeded").eq("user_id", user_id).maybeSingle());
  if (settings?.nutrition_seeded) return;
  const existing = check(await supabase.from("ingredient_nutrition").select("id").limit(1)) ?? [];
  if (!existing.length) {
    const rows = NUTRITION_SEED.map((r) => ({ ...r, user_id }));
    for (let i = 0; i < rows.length; i += 100) check(await supabase.from("ingredient_nutrition").insert(rows.slice(i, i + 100)));
  }
  check(await supabase.from("pantry_settings").upsert({ user_id, nutrition_seeded: true }));
}

export const nutritionQuery = queryOptions({
  queryKey: ["cook", "nutrition"],
  queryFn: async (): Promise<NutritionDbRow[]> => {
    await ensureNutritionSeed();
    return check(await supabase.from("ingredient_nutrition").select("*").order("name")) ?? [];
  },
});

/** The last two weeks of cooked meals, newest first. */
export const cookedQuery = queryOptions({
  queryKey: ["cook", "cooked"],
  queryFn: async (): Promise<CookedLog[]> => {
    const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
    return check(await supabase.from("cooked_log").select("*").gte("cooked_at", since).order("cooked_at", { ascending: false })) ?? [];
  },
});

/** Refreshes recipes, nutrition, the log, the pantry and the settings after a change. */
export function useInvalidateCook() {
  const qc = useQueryClient();
  return async () => {
    await Promise.all([qc.invalidateQueries({ queryKey: ["cook"] }), qc.invalidateQueries({ queryKey: ["pantry"] })]);
  };
}

export type NutritionInput = { name: string; basis: string; kcal: number; protein_g: number; carbs_g?: number | null; fat_g?: number | null };

export const cook = {
  /** Creates (no id) or updates a recipe with its ingredients. Returns the recipe id. */
  async saveRecipe(draft: RecipeDraft, id?: string): Promise<string> {
    const user_id = await uid();
    const fields = { title: draft.title.trim(), servings: draft.servings, steps: draft.steps.trim(), source: draft.source };
    let recipeId = id;
    let oldIds: string[] = [];
    if (recipeId) {
      check(await supabase.from("recipes").update(fields).eq("id", recipeId));
      oldIds = (check(await supabase.from("recipe_ingredients").select("id").eq("recipe_id", recipeId)) ?? []).map((r) => r.id);
    } else {
      const row = check(await supabase.from("recipes").insert({ ...fields, user_id }).select("id").single());
      if (!row) throw new Error("No data returned");
      recipeId = row.id;
    }
    // New rows first, old rows after: if something fails half way, no ingredients are lost.
    const rows = cleanIngredients(draft.ingredients).map((i, position) => ({
      recipe_id: recipeId as string,
      user_id,
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      pantry_item_id: i.pantry_item_id ?? null,
      position,
    }));
    if (rows.length) check(await supabase.from("recipe_ingredients").insert(rows));
    if (oldIds.length) check(await supabase.from("recipe_ingredients").delete().in("id", oldIds));
    return recipeId as string;
  },

  async deleteRecipe(id: string): Promise<void> {
    check(await supabase.from("recipes").delete().eq("id", id));
  },

  /** Adds a nutrition row, or changes the one with the same name and basis. */
  async saveNutrition(input: NutritionInput, id?: string): Promise<void> {
    const fields = { name: input.name.trim(), basis: input.basis, kcal: input.kcal, protein_g: input.protein_g, carbs_g: input.carbs_g ?? null, fat_g: input.fat_g ?? null };
    if (id) check(await supabase.from("ingredient_nutrition").update({ ...fields, source: "own" }).eq("id", id));
    else check(await supabase.from("ingredient_nutrition").insert({ ...fields, source: "own" }));
  },

  async deleteNutrition(id: string): Promise<void> {
    check(await supabase.from("ingredient_nutrition").delete().eq("id", id));
  },

  async setAiChat(on: boolean): Promise<void> {
    const user_id = await uid();
    check(await supabase.from("pantry_settings").upsert({ user_id, ai_chat: on }));
  },

  /** Takes the confirmed amounts out of the pantry and writes the log in one database transaction. Returns the log id. */
  async cookRecipe(args: {
    recipeId: string | null;
    title: string;
    servings: number;
    /** What was eaten (per portion times portions), from the nutrition table only. */
    nutrition: Amounts;
    /** How many portions were eaten. */
    portions: number;
    missing: number;
    changes: readonly Change[];
  }): Promise<string> {
    const id = check(
      await supabase.rpc("cook_recipe", {
        p_recipe_id: args.recipeId,
        p_title: args.title,
        p_servings: args.servings,
        p_kcal: Math.round(args.nutrition.kcal),
        p_protein_g: Math.round(args.nutrition.protein_g * 10) / 10,
        p_carbs_g: args.nutrition.carbs_g === null ? null : Math.round(args.nutrition.carbs_g * 10) / 10,
        p_fat_g: args.nutrition.fat_g === null ? null : Math.round(args.nutrition.fat_g * 10) / 10,
        p_portions: args.portions,
        p_kcal_missing: args.missing,
        p_changes: args.changes.map((c) => ({ id: c.id, after: c.after })),
      }),
    );
    if (!id) throw new Error("No data returned");
    return id;
  },

  async undoCook(logId: string): Promise<void> {
    check(await supabase.rpc("undo_cook", { p_log_id: logId }));
  },

  /** Takes a meal out of the nutrition log without touching the pantry (for meals too old to undo). */
  async removeFromLog(logId: string): Promise<void> {
    check(await supabase.from("cooked_log").update({ undone_at: new Date().toISOString() }).eq("id", logId).is("undone_at", null));
  },
};

export type ShoppingItem = Tables<"shopping_list">;

export const shoppingQuery = queryOptions({
  queryKey: ["cook", "shopping"],
  queryFn: async (): Promise<ShoppingItem[]> => check(await supabase.from("shopping_list").select("*").order("created_at")) ?? [],
});

export const shopping = {
  async add(items: readonly { name: string; quantity?: number | null; unit?: string | null }[]): Promise<void> {
    const user_id = await uid();
    const rows = items.filter((i) => i.name.trim()).map((i) => ({ user_id, name: i.name.trim(), quantity: i.quantity ?? null, unit: i.unit ?? null }));
    if (rows.length) check(await supabase.from("shopping_list").insert(rows));
  },
  async setDone(id: string, done: boolean): Promise<void> {
    check(await supabase.from("shopping_list").update({ done }).eq("id", id));
  },
  async remove(id: string): Promise<void> {
    check(await supabase.from("shopping_list").delete().eq("id", id));
  },
  async clearDone(): Promise<void> {
    check(await supabase.from("shopping_list").delete().eq("done", true));
  },
};
