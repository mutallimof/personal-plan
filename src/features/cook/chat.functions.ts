import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AiError, complete } from "@/features/gym/ai-provider.server";
import type { AiRecipe } from "./ai-recipes";
import { chatSummary, cleanRecipes, cleanTurns, type SavedRecipe } from "./chat";
import { runChat, type ChatOutcome } from "./chat-engine";

export type ChatResult = ({ ok: true; requests: number } & ChatOutcome) | { ok: false; error: string; off?: boolean };

/**
 * One turn of the cooking chat. Does nothing unless the person turned "AI cooking chat" on. The model sees the compact
 * pantry summary (read here from the database, not taken from the browser) and the titles of saved recipes. Every
 * answered request is counted. Provider problems come back as `{ ok: false }` so the page keeps working.
 */
export const cookChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { turns: unknown }) => ({ turns: cleanTurns(d?.turns) }))
  .handler(async ({ data, context }): Promise<ChatResult> => {
    const { supabase, userId } = context;
    if (!data.turns.length) return { ok: false, error: "Type a message first." };

    const { data: settings } = await supabase.from("pantry_settings").select("ai_chat, ai_chat_requests").eq("user_id", userId).maybeSingle();
    if (!settings?.ai_chat) return { ok: false, error: "The AI cooking chat is off.", off: true };

    const [items, recipes] = await Promise.all([
      supabase.from("pantry_items").select("*"),
      supabase.from("recipes").select("id, title").order("title"),
    ]);
    if (items.error || recipes.error) return { ok: false, error: "Could not read your pantry — please try again." };
    const saved: SavedRecipe[] = cleanRecipes(recipes.data);

    async function saveRecipe(r: AiRecipe): Promise<string> {
      const row = await supabase
        .from("recipes")
        .insert({ user_id: userId, title: r.title, servings: r.servings, steps: r.steps.join("\n"), source: "ai" })
        .select("id")
        .single();
      if (row.error || !row.data) throw new Error(row.error?.message ?? "No data returned");
      const ing = await supabase
        .from("recipe_ingredients")
        .insert(r.ingredients.map((i, position) => ({ user_id: userId, recipe_id: row.data.id, name: i.name, quantity: i.quantity, unit: i.unit, position })));
      if (ing.error) {
        await supabase.from("recipes").delete().eq("id", row.data.id);
        throw new Error(ing.error.message);
      }
      return row.data.id;
    }

    let outcome: ChatOutcome;
    try {
      outcome = await runChat(
        {
          complete,
          pantry: chatSummary(items.data ?? [], new Date()),
          recipes: saved,
          today: new Date(),
          saveRecipe,
          async addToShoppingList(list) {
            const res = await supabase
              .from("shopping_list")
              .insert(list.map((i) => ({ user_id: userId, name: i.name, quantity: i.quantity ?? null, unit: i.unit ?? null })));
            if (res.error) throw new Error(res.error.message);
          },
          async recipeExists(id) {
            const res = await supabase.from("recipes").select("id").eq("id", id).maybeSingle();
            return !res.error && !!res.data;
          },
        },
        data.turns,
      );
    } catch (e) {
      if (!(e instanceof AiError)) console.error(e);
      return { ok: false, error: e instanceof AiError ? e.message : "The AI request failed — please try again." };
    }

    const requests = settings.ai_chat_requests + 1;
    const { error } = await supabase.from("pantry_settings").update({ ai_chat_requests: requests }).eq("user_id", userId);
    if (error) console.error(error);
    return { ok: true, requests, ...outcome };
  });
