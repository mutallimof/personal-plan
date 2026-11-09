// Server-only LLM client. Talks to any OpenAI-style /chat/completions endpoint, configured by env vars:
//   AI_PROVIDER  gemini | openai-compatible | anthropic   (default: gemini)
//   AI_BASE_URL  optional for gemini, required for openai-compatible
//   AI_MODEL     optional for gemini (has a default), required otherwise
//   AI_API_KEY   required. Read only here, on the server. Never use a VITE_ prefix.

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
  // Gemini 3 attaches a thought signature here; it must be sent back unchanged.
  extra_content?: unknown;
};

export type ToolDef = {
  type: "function";
  name: string;
  description: string;
  parameters: unknown;
};

/** An error whose message is safe to show to the user. */
export class AiError extends Error {}

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";
const GEMINI_DEFAULT_MODEL = "gemini-3.8-flash";

type Config = { baseUrl: string; model: string; apiKey: string };

function config(): Config {
  const provider = (process.env["AI_PROVIDER"] ?? "gemini").trim().toLowerCase();
  const apiKey = process.env["AI_API_KEY"]?.trim();
  if (!apiKey) throw new AiError("The AI assistant isn't set up yet (AI_API_KEY is missing).");

  if (provider === "gemini") {
    return {
      baseUrl: process.env["AI_BASE_URL"]?.trim() || GEMINI_BASE_URL,
      model: process.env["AI_MODEL"]?.trim() || GEMINI_DEFAULT_MODEL,
      apiKey,
    };
  }
  if (provider === "openai-compatible") {
    const baseUrl = process.env["AI_BASE_URL"]?.trim();
    const model = process.env["AI_MODEL"]?.trim();
    if (!baseUrl || !model) {
      throw new AiError("AI_BASE_URL and AI_MODEL are required when AI_PROVIDER=openai-compatible.");
    }
    return { baseUrl, model, apiKey };
  }
  if (provider === "anthropic") {
    throw new AiError("AI_PROVIDER=anthropic is not implemented yet. Use gemini or openai-compatible.");
  }
  throw new AiError(`Unknown AI_PROVIDER "${provider}". Use gemini, anthropic or openai-compatible.`);
}

// Gemini's OpenAI layer rejects some JSON-Schema keywords, so keep only the portable subset.
function cleanSchema(s: unknown): unknown {
  if (Array.isArray(s)) return s.map(cleanSchema);
  if (s && typeof s === "object") {
    return Object.fromEntries(
      Object.entries(s)
        .filter(([k]) => k !== "additionalProperties")
        .map(([k, v]) => [k, cleanSchema(v)]),
    );
  }
  return s;
}

type Completion = {
  choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[];
};

export type ModelReply = {
  /** The assistant message exactly as returned; push it back into the history before tool results. */
  message: Extract<ChatMessage, { role: "assistant" }>;
  text: string;
  toolCalls: ToolCall[];
};

export async function complete(messages: ChatMessage[], tools?: ToolDef[]): Promise<ModelReply> {
  const { baseUrl, model, apiKey } = config();
  const body: Record<string, unknown> = { model, messages };
  if (tools?.length) {
    body["tools"] = tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: cleanSchema(t.parameters) },
    }));
    body["tool_choice"] = "auto";
  }

  let res: Response;
  try {
    res = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error("AI request failed", e);
    throw new AiError("I couldn't reach the AI service — please try again.");
  }

  if (!res.ok) {
    console.error("AI provider error", res.status, (await res.text()).slice(0, 500));
    if (res.status === 429) throw new AiError("I'm a bit busy right now — try again in a moment.");
    if (res.status === 401 || res.status === 403) {
      throw new AiError("The AI key was rejected. Check AI_API_KEY on the server.");
    }
    throw new AiError("The AI service returned an error — please try again.");
  }

  let json: Completion;
  try {
    json = (await res.json()) as Completion;
  } catch {
    throw new AiError("The AI service sent an unreadable reply — please try again.");
  }
  const msg = json.choices?.[0]?.message;
  if (!msg) throw new AiError("The AI service sent an empty reply — please try again.");

  const toolCalls = Array.isArray(msg.tool_calls)
    ? msg.tool_calls.filter((c) => c && typeof c.function?.name === "string")
    : [];
  const text = typeof msg.content === "string" ? msg.content.trim() : "";
  return {
    message: {
      role: "assistant",
      content: msg.content ?? null,
      ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
    },
    text,
    toolCalls,
  };
}

/** Pulls a JSON object out of a model reply, tolerating ```json fences and surrounding prose. */
export function extractJson(text: string): unknown {
  const t = text.replace(/```(?:json)?/gi, "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end <= start) throw new AiError("The AI didn't return a plan — please try again.");
  try {
    return JSON.parse(t.slice(start, end + 1));
  } catch {
    throw new AiError("The AI returned a plan I couldn't read — please try again.");
  }
}
