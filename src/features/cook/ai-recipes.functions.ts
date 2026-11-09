import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AiError, complete, extractJson } from "@/features/gym/ai-provider.server";
import { UNITS, type Unit } from "@/features/pantry/model";
import { MAX_PANTRY_LINES, SYSTEM_PROMPT, parseAiRecipes, userPrompt, type AiRecipe, type PantryLine } from "./ai-recipes";

export type IdeasResult = { ok: true; recipes: AiRecipe[]; requests: number } | { ok: false; error: string };

/** Keeps only well-formed name/quantity/unit entries, whatever the browser sent. */
function cleanLines(value: unknown): PantryLine[] {
  if (!Array.isArray(value)) return [];
  const out: PantryLine[] = [];
  for (const v of value) {
    const o = v as Record<string, unknown> | null;
    if (!o || typeof o["name"] !== "string" || typeof o["quantity"] !== "number" || typeof o["unit"] !== "string") continue;
    if (!UNITS.includes(o["unit"] as Unit) || !(o["quantity"] > 0) || !o["name"].trim()) continue;
    out.push({ name: o["name"].trim().slice(0, 80), quantity: o["quantity"], unit: o["unit"] as Unit });
  }
  return out.slice(0, MAX_PANTRY_LINES);
}

/**
 * Asks the AI provider for recipe ideas from a list of pantry ingredient names and quantities. Does nothing unless the
 * user turned AI recipe ideas on. Counts every request the provider answered. Provider problems come back as
 * `{ ok: false }` so the page keeps working. Nothing is saved here.
 */
export const suggestRecipes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { lines: unknown }) => ({ lines: cleanLines(d?.lines) }))
  .handler(async ({ data, context }): Promise<IdeasResult> => {
    const { supabase, userId } = context;
    const { data: settings } = await supabase.from("pantry_settings").select("ai_recipes, ai_recipe_requests").eq("user_id", userId).maybeSingle();
    if (!settings?.ai_recipes) return { ok: false, error: "AI recipe ideas are off." };
    if (!data.lines.length) return { ok: false, error: "Your pantry is empty." };

    let reply: string;
    try {
      reply = (
        await complete([
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt(data.lines) },
        ])
      ).text;
    } catch (e) {
      if (!(e instanceof AiError)) console.error(e);
      return { ok: false, error: e instanceof AiError ? e.message : "The AI request failed — please try again." };
    }

    const requests = settings.ai_recipe_requests + 1;
    const { error } = await supabase.from("pantry_settings").update({ ai_recipe_requests: requests }).eq("user_id", userId);
    if (error) console.error(error);

    try {
      const recipes = parseAiRecipes(extractJson(reply));
      return recipes.length ? { ok: true, recipes, requests } : { ok: false, error: "The AI did not return usable recipes — try again." };
    } catch (e) {
      return { ok: false, error: e instanceof AiError ? e.message : "The AI request failed — please try again." };
    }
  });
