import type { ChatOutcome } from "./chat-engine";

/** What the server sends while the chat answers: pieces of text, then one "done" or one "error". One JSON object per line. */
export type ChatEvent =
  | { type: "text"; delta: string }
  | ({ type: "done"; requests: number } & ChatOutcome)
  | { type: "error"; error: string; off?: boolean };

export const encodeEvent = (event: ChatEvent): string => `${JSON.stringify(event)}\n`;

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** One line of the stream as an event, or null when it is not one (the browser never trusts the stream's shape). */
export function parseEvent(line: string): ChatEvent | null {
  let v: unknown;
  try {
    v = JSON.parse(line);
  } catch {
    return null;
  }
  if (!isObject(v)) return null;
  if (v["type"] === "text" && typeof v["delta"] === "string") return { type: "text", delta: v["delta"] };
  if (v["type"] === "error" && typeof v["error"] === "string") return { type: "error", error: v["error"], ...(v["off"] === true ? { off: true } : {}) };
  if (v["type"] === "done" && typeof v["reply"] === "string" && Array.isArray(v["cards"])) {
    return {
      type: "done",
      reply: v["reply"],
      cards: v["cards"] as ChatOutcome["cards"],
      cook: typeof v["cook"] === "string" ? v["cook"] : null,
      saved: Array.isArray(v["saved"]) ? (v["saved"] as ChatOutcome["saved"]) : [],
      requests: typeof v["requests"] === "number" ? v["requests"] : 0,
    };
  }
  return null;
}

/**
 * Reads a chat stream and calls `onEvent` for every complete line as it arrives, however the bytes were split.
 * A stream that ends without "done" or "error" is reported as an error so the page never waits forever.
 */
export async function readChatEvents(body: ReadableStream<Uint8Array> | null, onEvent: (e: ChatEvent) => void): Promise<void> {
  let finished = false;
  const handle = (line: string) => {
    if (!line.trim()) return;
    const event = parseEvent(line);
    if (!event) return;
    if (event.type !== "text") finished = true;
    onEvent(event);
  };
  if (body) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        handle(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
      }
    }
    handle(buffer + decoder.decode());
  }
  if (!finished) onEvent({ type: "error", error: "The AI reply was cut off — please try again." });
}
