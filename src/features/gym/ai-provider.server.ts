// Server-only LLM client. Talks to any OpenAI-style /chat/completions endpoint, configured by env vars:
//   AI_PROVIDER  gemini | openai-compatible | anthropic   (default: gemini)
//   AI_BASE_URL  optional for gemini, required for openai-compatible
//   AI_MODEL     optional for gemini (has a default), required otherwise
//   AI_API_KEY   required. Read only here, on the server. Never use a VITE_ prefix.
//   AI_FALLBACK_MODEL  model tried when the main one fails for good (no quota, not found, still failing after retries).
//                      Gemini has a default; "off" turns it off; other providers have none unless this is set.
//   AI_TIMEOUT_MS      how long to wait for the provider's first answer (default 60000).
//   AI_RETRY_BASE_MS   first wait between retries; it doubles each time (default 1000).

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
const GEMINI_DEFAULT_MODEL = "gemini-3.6-flash";
/** Tried in this order for a Gemini fallback; the first one that differs from the main model is used. */
const GEMINI_FALLBACKS = ["gemini-3.6-flash", "gemini-3.5-flash"];

type Config = { baseUrl: string; model: string; fallback: string | null; apiKey: string };

function fallbackFor(model: string, gemini: boolean): string | null {
  const v = process.env["AI_FALLBACK_MODEL"]?.trim();
  if (v?.toLowerCase() === "off") return null;
  const chosen = v || (gemini ? GEMINI_FALLBACKS.find((m) => m !== model) : undefined);
  return chosen && chosen !== model ? chosen : null;
}

function config(): Config {
  const provider = (process.env["AI_PROVIDER"] ?? "gemini").trim().toLowerCase();
  const apiKey = process.env["AI_API_KEY"]?.trim();
  if (!apiKey) throw new AiError("The AI assistant isn't set up yet (AI_API_KEY is missing).");

  if (provider === "gemini") {
    const model = process.env["AI_MODEL"]?.trim() || GEMINI_DEFAULT_MODEL;
    return {
      baseUrl: process.env["AI_BASE_URL"]?.trim() || GEMINI_BASE_URL,
      model,
      fallback: fallbackFor(model, true),
      apiKey,
    };
  }
  if (provider === "openai-compatible") {
    const baseUrl = process.env["AI_BASE_URL"]?.trim();
    const model = process.env["AI_MODEL"]?.trim();
    if (!baseUrl || !model) {
      throw new AiError("AI_BASE_URL and AI_MODEL are required when AI_PROVIDER=openai-compatible.");
    }
    return { baseUrl, model, fallback: fallbackFor(model, false), apiKey };
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

/** What went wrong with a request, as far as the provider tells us. */
export type FailureKind = "quota" | "rate" | "overloaded" | "auth" | "model" | "timeout" | "network" | "other";
export type Failure = { kind: FailureKind; status: number | null; retryAfterMs: number | null; detail: string };

/** Only these are worth asking the same model again. */
const RETRYABLE: ReadonlySet<FailureKind> = new Set(["rate", "overloaded", "timeout", "network"]);

/**
 * Sorts a failed response into a kind. A 429 is two different things: "quota" means the model has no allowance for
 * you (a limit of 0, or the daily limit used up: asking again is pointless), "rate" means too many requests per
 * minute (asking again a little later works).
 */
export function classifyFailure(status: number, text: string, retryAfter: string | null = null): Failure {
  const detail = text.replace(/\s+/g, " ").slice(0, 300);
  const secs = retryAfter ? Number(retryAfter) : NaN;
  const wait = Number.isFinite(secs) && secs >= 0 ? secs * 1000 : retryInMs(text);
  const base = { status, retryAfterMs: wait, detail };
  if (status === 401 || status === 403) return { kind: "auth", ...base };
  if (status === 429) {
    // a limit of 0, a daily limit, or "retry in 6h" means asking again soon cannot work
    const noAllowance = /limit:\s*0\b/i.test(text) || (wait !== null && wait > LONG_WAIT_MS) || (/PerDay|per day|billing/i.test(text) && !/PerMinute|per minute/i.test(text));
    return { kind: noAllowance ? "quota" : "rate", ...base };
  }
  if (status === 404 || (status === 400 && /model/i.test(text) && /not found|not supported|does not exist|invalid/i.test(text)))
    return { kind: "model", ...base };
  if (status === 408 || status >= 500) return { kind: status === 408 ? "timeout" : "overloaded", ...base };
  return { kind: "other", ...base };
}

/** Longer than this and a "try again later" from the provider is treated as no quota. */
const LONG_WAIT_MS = 2 * 60_000;

/** Reads "Please retry in 6h44m55.2s" (Google's wording) as milliseconds, or null. */
function retryInMs(text: string): number | null {
  const m = /retry in\s+(?:(\d+)h)?(?:(\d+)m(?!s))?(?:(\d+(?:\.\d+)?)s)?/i.exec(text);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  return ((Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0)) * 60 + Number(m[3] ?? 0)) * 1000;
}

/** The message a person sees: what happened, with the status code, and what to change. Never contains a key. */
export function describeFailure(f: Failure, model: string): string {
  const code = f.status ? ` (HTTP ${f.status})` : "";
  switch (f.kind) {
    case "quota":
      return `The AI model "${model}" has no quota left for this key${code}. In .env set AI_MODEL to a model your plan allows (for example gemini-3.6-flash), or turn on billing / raise the quota in Google AI Studio.`;
    case "rate":
      return `The AI provider is limiting how fast I can ask${code}. Wait a minute and try again; if it keeps happening, raise the quota or use a model with a higher limit.`;
    case "overloaded":
      return `The AI service is overloaded right now${code}. Try again in a moment.`;
    case "timeout":
      return "The AI service did not answer in time. Try again, or set AI_REASONING=low or a faster AI_MODEL in .env.";
    case "network":
      return "I couldn't reach the AI service — check the internet connection and try again.";
    case "auth":
      return `The AI key was rejected${code}. Check AI_API_KEY on the server.`;
    case "model":
      return `The AI model "${model}" was not found${code}. Check AI_MODEL in .env.`;
    default:
      return `The AI service returned an error${code} — please try again.`;
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const envMs = (name: string, fallback: number) => {
  const raw = process.env[name]?.trim();
  const n = Number(raw);
  return raw && Number.isFinite(n) && n >= 0 ? n : fallback;
};
const MAX_ATTEMPTS = 3;
const MAX_WAIT_MS = 10_000;

/** One request to one model. Returns the response, or why it failed. Never throws. */
async function attempt(
  url: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  tools: ToolDef[] | undefined,
  stream: boolean,
): Promise<{ res: Response } | { failure: Failure }> {
  let effort = reasoningEffort();
  for (let tries = 0; tries < 2; tries++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), envMs("AI_TIMEOUT_MS", 60_000));
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(requestBody(model, messages, tools, stream, effort)),
        signal: controller.signal,
      });
    } catch (e) {
      const timedOut = controller.signal.aborted;
      return { failure: { kind: timedOut ? "timeout" : "network", status: null, retryAfterMs: null, detail: timedOut ? "no answer in time" : String(e).slice(0, 200) } };
    } finally {
      clearTimeout(timer);
    }
    if (res.ok) return { res };
    const text = (await res.text().catch(() => "")).slice(0, 800);
    // a model that does not know the reasoning setting gets one more try without it
    if (res.status === 400 && effort && /reasoning|thinking/i.test(text)) {
      effort = null;
      continue;
    }
    return { failure: classifyFailure(res.status, text, res.headers.get("retry-after")) };
  }
  return { failure: { kind: "other", status: 400, retryAfterMs: null, detail: "rejected the request" } };
}

/**
 * Sends the request. A failed request is sorted by kind (see `classifyFailure`): rate limits, overload, timeouts and
 * network errors are retried with a growing wait (up to 3 tries); no quota, an unknown model or a still-failing model
 * moves on to the fallback model; a rejected key stops at once. The status code and the provider's message are logged
 * (never the key). Throws an AiError that says what happened and what to change.
 */
async function send(messages: ChatMessage[], tools: ToolDef[] | undefined, stream: boolean): Promise<Response> {
  const { baseUrl, model, fallback, apiKey } = config();
  const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const base = envMs("AI_RETRY_BASE_MS", 1000);
  let first: { failure: Failure; model: string } | null = null;
  let tried: { failure: Failure; model: string } | null = null;
  for (const m of fallback ? [model, fallback] : [model]) {
    let last: Failure | null = null;
    for (let n = 1; n <= MAX_ATTEMPTS; n++) {
      const out = await attempt(url, apiKey, m, messages, tools, stream);
      if ("res" in out) {
        if (first) console.warn(`AI: "${first.model}" failed (${first.failure.kind}, HTTP ${first.failure.status ?? "none"}); answered by fallback "${m}".`);
        return out.res;
      }
      last = out.failure;
      console.error(`AI provider error: model=${m} attempt=${n} kind=${last.kind} status=${last.status ?? "none"} ${last.detail}`);
      if (last.kind === "auth") throw new AiError(describeFailure(last, m));
      if (!RETRYABLE.has(last.kind) || n === MAX_ATTEMPTS) break;
      await sleep(Math.min(MAX_WAIT_MS, last.retryAfterMs ?? base * 2 ** (n - 1)) + Math.random() * base * 0.2);
    }
    if (first) tried = { failure: last!, model: m };
    else first = { failure: last!, model: m };
  }
  const fallbackNote = tried ? ` The fallback model "${tried.model}" failed too (${tried.failure.kind}${tried.failure.status ? `, HTTP ${tried.failure.status}` : ""}).` : "";
  throw new AiError(describeFailure(first!.failure, first!.model) + fallbackNote);
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
      const { done, value } = await readWithin(reader, envMs("AI_TIMEOUT_MS", 60_000));
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

/** Reads the next piece of a stream, giving up when nothing arrives in time. */
function readWithin(reader: ReadableStreamDefaultReader<Uint8Array>, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const idle = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("no data from the AI service")), ms);
  });
  return Promise.race([reader.read(), idle]).finally(() => clearTimeout(timer));
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
