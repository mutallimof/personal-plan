import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AiError, completeStream } from "@/features/gym/ai-provider.server";
import type { AiRecipe } from "./ai-recipes";
import { chatSummary, cleanRecipes, cleanTurns } from "./chat";
import { runChat } from "./chat-engine";
import { encodeEvent, type ChatEvent } from "./chat-stream";

/**
 * One turn of the cooking chat, streamed: the response is one JSON event per line (see `chat-stream.ts`), starting as
 * soon as the model says its first word. Does nothing unless the person turned "AI cooking chat" on. The model sees only
 * the stock (name, quantity, unit; read here from the database, not taken from the browser) and the titles of saved
 * recipes. Every answered request is counted. Problems arrive as an "error" event, so the page keeps working.
 */
export const cookChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { turns: unknown }) => ({ turns: cleanTurns(d?.turns) }))
  .handler(async ({ data, context }): Promise<Response> => {
    const { supabase, userId } = context;
    const encoder = new TextEncoder();

    async function run(emit: (e: ChatEvent) => void): Promise<void> {
      if (!data.turns.length) return emit({ type: "error", error: "Type a message first." });

      const { data: settings } = await supabase.from("pantry_settings").select("ai_chat, ai_chat_requests").eq("user_id", userId).maybeSingle();
      if (!settings?.ai_chat) return emit({ type: "error", error: "The AI cooking chat is off.", off: true });

      const [items, recipes] = await Promise.all([
        supabase.from("pantry_items").select("name, quantity, unit"),
        supabase.from("recipes").select("id, title").order("title"),
      ]);
      if (items.error || recipes.error) return emit({ type: "error", error: "Could not read your pantry — please try again." });

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

      try {
        const outcome = await runChat(
          {
            complete: (messages, tools, onText) => completeStream(messages, tools, onText ?? (() => {})),
            pantry: chatSummary(items.data ?? []),
            stock: chatSummary(items.data ?? [], Infinity),
            recipes: cleanRecipes(recipes.data),
            saveRecipe,
            async recipeExists(id) {
              const res = await supabase.from("recipes").select("id").eq("id", id).maybeSingle();
              return !res.error && !!res.data;
            },
          },
          data.turns,
          (delta) => emit({ type: "text", delta }),
        );
        const requests = settings.ai_chat_requests + 1;
        const { error } = await supabase.from("pantry_settings").update({ ai_chat_requests: requests }).eq("user_id", userId);
        if (error) console.error(error);
        emit({ type: "done", requests, ...outcome });
      } catch (e) {
        if (!(e instanceof AiError)) console.error(e);
        emit({ type: "error", error: e instanceof AiError ? e.message : "The AI request failed — please try again." });
      }
    }

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          await run((e) => controller.enqueue(encoder.encode(encodeEvent(e))));
        } catch (e) {
          console.error(e);
          controller.enqueue(encoder.encode(encodeEvent({ type: "error", error: "The AI request failed — please try again." })));
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
  });
