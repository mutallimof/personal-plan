import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AiError, complete, extractJson, type ChatMessage } from "./ai-provider.server";
import { TOOL_DEFS, runTool } from "./ai-tools.server";

function friendly(e: unknown) {
  if (e instanceof AiError) return e.message;
  console.error(e);
  return "Something went wrong — please try again.";
}

/** Parses a tool call's arguments. Returns null when the model sent something that isn't a JSON object. */
function parseArgs(raw: string | undefined): Record<string, unknown> | null {
  if (!raw || !raw.trim()) return {};
  try {
    const v: unknown = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const MAX_BAD_CALLS = 3;

export const sendChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { message: string }) => {
    const message = String(d?.message ?? "").trim().slice(0, 2000);
    if (!message) throw new Error("Empty message");
    return { message };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error: insErr } = await supabase.from("chat_messages").insert({ user_id: userId, role: "user", content: data.message });
    if (insErr) throw new Error(insErr.message);

    const { data: history } = await supabase
      .from("chat_messages")
      .select("role,content")
      .order("created_at", { ascending: false })
      .limit(16);

    const today = new Date();
    const instructions = `You are the Lifeplan gym assistant. You can read and change the user's training plan with tools.
Today is ${today.toISOString().slice(0, 10)} (${today.toLocaleDateString("en-US", { weekday: "long" })}). Weeks start Monday. Units: kg and cm.
Rules:
- Always call get_plan first to get ids. Use only exercises from the library (search_exercises).
- Sessions are not tied to weekdays; "move X to Friday" means: if X is scheduled this week, move that entry; otherwise schedule it on the next Friday (today or later).
- For time limits (e.g. 45 minutes) trim sets or exercises sensibly.
- For goal changes, adjust the plan with real edits (add/swap/update) and update_profile goal.
- If a request is ambiguous (e.g. exercise appears in several sessions and it matters), ask one short question instead of guessing. Same weight change across all sessions is fine without asking.
- After changes, reply with ONE short sentence confirming what changed. No tips, no extra text.`;

    const messages: ChatMessage[] = [
      { role: "system", content: instructions },
      ...(history ?? []).reverse().map((m): ChatMessage =>
        m.role === "assistant" ? { role: "assistant", content: m.content } : { role: "user", content: m.content },
      ),
    ];

    let reply = "";
    let changed = false;
    let badCalls = 0;
    try {
      for (let step = 0; step < 12; step++) {
        const res = await complete(messages, TOOL_DEFS);
        if (!res.toolCalls.length) {
          reply = res.text;
          break;
        }
        messages.push(res.message);
        for (const c of res.toolCalls) {
          let result: unknown;
          const args = parseArgs(c.function.arguments);
          if (args === null) {
            // Malformed tool call: tell the model so it can retry, but don't loop forever.
            badCalls++;
            result = { error: "Arguments were not a valid JSON object. Call the tool again with valid JSON." };
          } else {
            try {
              result = await runTool(supabase, userId, c.function.name, args);
              if (c.function.name !== "get_plan" && c.function.name !== "search_exercises") changed = true;
            } catch (e) {
              result = { error: e instanceof Error ? e.message : String(e) };
            }
          }
          messages.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(result) });
        }
        if (badCalls >= MAX_BAD_CALLS) {
          reply = changed
            ? "I made some changes but got confused part-way — please check your plan."
            : "I couldn't understand the AI's response — please try again.";
          break;
        }
      }
    } catch (e) {
      reply = friendly(e);
    }
    if (!reply) reply = changed ? "Done." : "Sorry, I couldn't finish that.";

    const { error: outErr } = await supabase.from("chat_messages").insert({ user_id: userId, role: "assistant", content: reply });
    if (outErr) console.error(outErr);
    return { reply, changed };
  });

export const generatePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: exercises }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("exercises").select("id,slug,name,equipment,muscle_group,primary_muscles"),
    ]);
    if (!profile || !exercises) throw new Error("Missing profile");
    const n = Math.max(1, Math.min(7, profile.sessions_per_week ?? 3));

    const reply = await complete([
      {
        role: "system",
        content:
          'You design gym plans. Use only the given exercise slugs. Session names are short (e.g. Upper A, Lower, Push). 5-7 exercises per session. Reply with ONLY a JSON object, no prose, shaped like {"sessions":[{"name":"Upper A","exercises":[{"slug":"...","sets":3,"reps":"8-10"}]}]}.',
      },
      {
        role: "user",
        content: `Create exactly ${n} sessions. Height ${profile.height_cm} cm, weight ${profile.weight_kg} kg, goal: ${profile.goal}, experience: ${profile.experience}.
Library: ${exercises.map((e) => `${e.slug} (${e.equipment}, ${e.primary_muscles.join("/")})`).join("; ")}. Return JSON.`,
      },
    ]).catch((e: unknown) => {
      throw new Error(friendly(e));
    });
    const raw = extractJson(reply.text) as { sessions?: unknown };
    const parsed = {
      sessions: (Array.isArray(raw.sessions) ? raw.sessions : [])
        .map((s: { name?: unknown; exercises?: unknown }) => ({
          name: typeof s?.name === "string" && s.name.trim() ? s.name.trim().slice(0, 60) : "Session",
          exercises: (Array.isArray(s?.exercises) ? s.exercises : [])
            .map((e: { slug?: unknown; sets?: unknown; reps?: unknown }) => ({
              slug: String(e?.slug ?? ""),
              sets: Number.isInteger(e?.sets) ? Math.max(1, Math.min(10, e.sets as number)) : 3,
              reps: typeof e?.reps === "string" || typeof e?.reps === "number" ? String(e.reps) : "8-12",
            })),
        }))
        .slice(0, n),
    };
    if (!parsed.sessions.length) throw new AiError("The AI didn't return any sessions — please try again.");
    const bySlug = new Map(exercises.map((e) => [e.slug, e.id]));

    const bySlugIds = bySlug;
    if (!parsed.sessions.some((s) => s.exercises.some((e) => bySlugIds.has(e.slug)))) {
      throw new AiError("The AI picked exercises that aren't in the library — please try again.");
    }

    await supabase.from("sessions").delete().eq("user_id", userId);
    for (const [i, s] of parsed.sessions.entries()) {
      const { data: row, error } = await supabase.from("sessions").insert({ user_id: userId, name: s.name, position: i }).select("id").single();
      if (error || !row) throw new Error(error?.message ?? "insert failed");
      const items = s.exercises
        .filter((e) => bySlug.has(e.slug))
        .map((e, j) => ({ user_id: userId, session_id: row.id, exercise_id: bySlug.get(e.slug)!, sets: e.sets, reps: e.reps, position: j }));
      const { error: e2 } = await supabase.from("session_exercises").insert(items);
      if (e2) throw new Error(e2.message);
    }
    await supabase.from("profiles").update({ onboarded: true }).eq("id", userId);
    return { ok: true };
  });
