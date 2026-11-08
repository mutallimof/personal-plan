import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateResponse, GatewayError, type ResponsesInputItem } from "@lovable.dev/ai-gateway";
import { TOOL_DEFS, runTool } from "./ai-tools.server";

const MODEL = "openai/gpt-6-astra" as const;

function outputText(output: unknown[]): string {
  let text = "";
  for (const item of output as Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>) {
    if (item.type === "message") for (const c of item.content ?? []) if (c.type === "output_text") text += c.text ?? "";
  }
  return text.trim();
}

function friendly(e: unknown) {
  if (e instanceof GatewayError) {
    console.error("AI gateway error", e.code, e.ids);
    if (e.code === "rate_limited") return "I'm a bit busy right now — try again in a moment.";
    if (e.httpStatus === 402) return "AI credits are used up for this workspace.";
  } else console.error(e);
  return "Something went wrong — please try again.";
}

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

    const input: ResponsesInputItem[] = (history ?? [])
      .reverse()
      .map((m) =>
        m.role === "assistant"
          ? ({ role: "assistant", content: [{ type: "output_text", text: m.content }] } as ResponsesInputItem)
          : ({ role: "user", content: m.content } as ResponsesInputItem),
      );

    let reply = "";
    let changed = false;
    try {
      for (let step = 0; step < 12; step++) {
        const res = await generateResponse({
          model: MODEL,
          instructions,
          input,
          tools: TOOL_DEFS,
          include: ["reasoning.encrypted_content"],
        });
        const output = (res.output ?? []) as unknown[];
        const calls = (output as Array<{ type?: string; name?: string; arguments?: string; call_id?: string }>).filter(
          (o) => o.type === "function_call",
        );
        if (!calls.length) {
          reply = outputText(output);
          break;
        }
        input.push(...(output as ResponsesInputItem[]));
        for (const c of calls) {
          let result: unknown;
          try {
            result = await runTool(supabase, userId, c.name ?? "", JSON.parse(c.arguments || "{}"));
            if (c.name !== "get_plan" && c.name !== "search_exercises") changed = true;
          } catch (e) {
            result = { error: e instanceof Error ? e.message : String(e) };
          }
          input.push({ type: "function_call_output", call_id: c.call_id ?? "", output: JSON.stringify(result) } as ResponsesInputItem);
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

    const schema = {
      type: "object",
      additionalProperties: false,
      required: ["sessions"],
      properties: {
        sessions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "exercises"],
            properties: {
              name: { type: "string" },
              exercises: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["slug", "sets", "reps"],
                  properties: { slug: { type: "string", enum: exercises.map((e) => e.slug) }, sets: { type: "integer" }, reps: { type: "string" } },
                },
              },
            },
          },
        },
      },
    };

    const res = await generateResponse({
      model: MODEL,
      instructions: "You design gym plans. Use only the given exercise slugs. Session names are short (e.g. Upper A, Lower, Push). 5-7 exercises per session.",
      input: [
        {
          role: "user",
          content: `Create exactly ${n} sessions. Height ${profile.height_cm} cm, weight ${profile.weight_kg} kg, goal: ${profile.goal}, experience: ${profile.experience}.
Library: ${exercises.map((e) => `${e.slug} (${e.equipment}, ${e.primary_muscles.join("/")})`).join("; ")}. Return JSON.`,
        },
      ],
      text: { format: { type: "json_schema", name: "plan", strict: true, schema } },
    });
    const parsed = JSON.parse(outputText((res.output ?? []) as unknown[])) as {
      sessions: { name: string; exercises: { slug: string; sets: number; reps: string }[] }[];
    };
    const bySlug = new Map(exercises.map((e) => [e.slug, e.id]));

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
