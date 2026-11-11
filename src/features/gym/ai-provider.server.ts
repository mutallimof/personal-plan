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

/**
 * How much the model may think before answering. Less thinking means a faster first word.
 *   AI_REASONING = none | minimal | low | medium | high   (default "low" for gemini, unset for others)
 *   AI_REASONING = off  sends no such setting at all
 * A provider or model that rejects the setting gets one retry without it.
 */
function reasoningEffort(): string | null {
  const v = process.env["AI_REASONING"]?.trim().toLowerCase();
  if (v === "off") return null;
  if (v) return v;
  return (process.env["AI_PROVIDER"] ?? "gemini").trim().toLowerCase() === "gemini" ? "low" : null;
}

function requestBody(model: string, messages: ChatMessage[], tools: ToolDef[] | undefined, stream: boolean, effort: string | null) {
  const body: Record<string, unknown> = { model, messages };
  if (stream) body["stream"] = true;
  if (effort) body["reasoning_effort"] = effort;
  if (tools?.length) {
    body["tools"] = tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: cleanSchema(t.parameters) },
    }));
    body["tool_choice"] = "auto";
  }
  return body;
}

/** Sends the request; retries once without the reasoning setting when the provider rejects it. Throws AiError for every failure. */
async function send(messages: ChatMessage[], tools: ToolDef[] | undefined, stream: boolean): Promise<Response> {
  const { baseUrl, model, apiKey } = config();
  const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  let effort = reasoningEffort();
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(requestBody(model, messages, tools, stream, effort)),
      });
    } catch (e) {
      console.error("AI request failed", e);
      throw new AiError("I couldn't reach the AI service — please try again.");
    }
    if (res.ok) return res;
    const text = (await res.text()).slice(0, 500);
    console.error("AI provider error", res.status, text);
    if (res.status === 400 && effort && /reasoning|thinking/i.test(text)) {
      effort = null;
      continue;
    }
    if (res.status === 429) throw new AiError("I'm a bit busy right now — try again in a moment.");
    if (res.status === 401 || res.status === 403) throw new AiError("The AI key was rejected. Check AI_API_KEY on the server.");
    throw new AiError("The AI service returned an error — please try again.");
  }
  throw new AiError("The AI service returned an error — please try again.");
}

function toReply(content: string | null | undefined, rawCalls: ToolCall[] | undefined): ModelReply {
  const toolCalls = Array.isArray(rawCalls) ? rawCalls.filter((c) => c && typeof c.function?.name === "string") : [];
  const text = typeof content === "string" ? content.trim() : "";
  return {
    message: { role: "assistant", content: content ?? null, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) },
    text,
    toolCalls,
  };
}

export async function complete(messages: ChatMessage[], tools?: ToolDef[]): Promise<ModelReply> {
  const res = await send(messages, tools, false);
  let json: Completion;
  try {
    json = (await res.json()) as Completion;
  } catch {
    throw new AiError("The AI service sent an unreadable reply — please try again.");
  }
  const msg = json.choices?.[0]?.message;
  if (!msg) throw new AiError("The AI service sent an empty reply — please try again.");
  return toReply(msg.content, msg.tool_calls);
}

type StreamChunk = {
  choices?: {
    delta?: {
      content?: string | null;
      tool_calls?: { index?: number; id?: string; extra_content?: unknown; function?: { name?: string; arguments?: string } }[];
    };
  }[];
};

/**
 * Like `complete`, but asks the provider to stream: `onText` gets every piece of the answer text as it arrives, and the
 * finished reply (text and tool calls, put back together) is returned at the end.
 */
export async function completeStream(messages: ChatMessage[], tools: ToolDef[] | undefined, onText: (delta: string) => void): Promise<ModelReply> {
  const res = await send(messages, tools, true);
  if (!res.body) throw new AiError("The AI service sent an empty reply — please try again.");
  const acc = new StreamAccumulator(onText);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        acc.line(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
      }
    }
    acc.line(buffer);
  } catch (e) {
    console.error("AI stream failed", e);
    throw new AiError("The AI reply was cut off — please try again.");
  }
  return acc.reply();
}

/** Puts the server-sent events of a streamed completion back together. Exported for tests. */
export class StreamAccumulator {
  private content = "";
  private calls: { id: string; name: string; args: string; extra?: unknown }[] = [];
  constructor(private readonly onText: (delta: string) => void) {}

  /** One line of the event stream; anything that is not a JSON data line is ignored. */
  line(raw: string): void {
    const line = raw.trim();
    if (!line.startsWith("data:")) return;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") return;
    let chunk: StreamChunk;
    try {
      chunk = JSON.parse(data) as StreamChunk;
    } catch {
      return;
    }
    const delta = chunk.choices?.[0]?.delta;
    if (!delta) return;
    if (typeof delta.content === "string" && delta.content) {
      this.content += delta.content;
      this.onText(delta.content);
    }
    for (const tc of delta.tool_calls ?? []) {
      // some providers leave the index out: a new id starts a new call, no id continues the last one
      const at = typeof tc.index === "number" ? tc.index : tc.id && !this.calls.some((c) => c.id === tc.id) ? this.calls.length : Math.max(0, this.calls.length - 1);
      const call = (this.calls[at] ??= { id: "", name: "", args: "" });
      if (tc.id) call.id = tc.id;
      if (tc.function?.name) call.name += tc.function.name;
      if (tc.function?.arguments) call.args += tc.function.arguments;
      if (tc.extra_content !== undefined) call.extra = tc.extra_content;
    }
  }

  reply(): ModelReply {
    const calls: ToolCall[] = this.calls
      .filter((c) => c && c.name)
      .map((c, i) => ({
        id: c.id || `call_${i}`,
        type: "function" as const,
        function: { name: c.name, arguments: c.args },
        ...(c.extra !== undefined ? { extra_content: c.extra } : {}),
      }));
    return toReply(this.content || null, calls);
  }
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
