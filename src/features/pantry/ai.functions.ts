import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AiError, complete, extractJson } from "@/features/gym/ai-provider.server";
import { SYSTEM_PROMPT, parseSuggestions, textsToSend, userPrompt, type Suggestion } from "./ai-suggest";

export type SuggestResult =
  | { ok: true; suggestions: Suggestion[]; sent: number; totalSent: number }
  | { ok: false; error: string };

/**
 * Asks the AI provider about receipt lines the dictionary could not match. Only the normalized text of those
 * lines is sent (no photo, no prices). Does nothing unless the user turned the AI check on. Provider problems
 * come back as `{ ok: false }` so the import carries on.
 */
export const suggestProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { lines: string[] }) => ({
    texts: textsToSend(Array.isArray(d?.lines) ? d.lines.filter((l): l is string => typeof l === "string") : []),
  }))
  .handler(async ({ data, context }): Promise<SuggestResult> => {
    const { supabase, userId } = context;
    const { data: settings } = await supabase.from("pantry_settings").select("ai_check, ai_lines_sent").eq("user_id", userId).maybeSingle();
    if (!settings?.ai_check) return { ok: false, error: "The AI check is off." };
    if (!data.texts.length) return { ok: true, suggestions: [], sent: 0, totalSent: settings.ai_lines_sent };

    let reply: string;
    try {
      reply = (
        await complete([
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt(data.texts) },
        ])
      ).text;
    } catch (e) {
      if (!(e instanceof AiError)) console.error(e);
      return { ok: false, error: e instanceof AiError ? e.message : "The AI check failed — please try again." };
    }

    // The provider answered, so these lines count as sent even if the answer turns out to be unusable.
    const totalSent = settings.ai_lines_sent + data.texts.length;
    const { error } = await supabase.from("pantry_settings").update({ ai_lines_sent: totalSent }).eq("user_id", userId);
    if (error) console.error(error);

    try {
      return { ok: true, suggestions: parseSuggestions(extractJson(reply), data.texts), sent: data.texts.length, totalSent };
    } catch (e) {
      return { ok: false, error: e instanceof AiError ? e.message : "The AI check failed — please try again." };
    }
  });
