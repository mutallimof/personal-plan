import { describe, expect, it } from "vitest";
import { encodeEvent, parseEvent, readChatEvents, type ChatEvent } from "./chat-stream";

const enc = new TextEncoder();
const streamOf = (chunks: string[]) =>
  new ReadableStream<Uint8Array>({
    start(c) {
      for (const chunk of chunks) c.enqueue(enc.encode(chunk));
      c.close();
    },
  });

const done: ChatEvent = { type: "done", reply: "Here you go", cards: [], cook: null, saved: [], requests: 3 };

async function collect(chunks: string[]) {
  const events: ChatEvent[] = [];
  await readChatEvents(streamOf(chunks), (e) => events.push(e));
  return events;
}

describe("chat events", () => {
  it("round-trips every kind of event", () => {
    for (const e of [{ type: "text", delta: "Hi" }, done, { type: "error", error: "Busy", off: true }] as ChatEvent[]) {
      expect(parseEvent(encodeEvent(e).trim())).toEqual(e);
    }
  });

  it("ignores lines that are not events", () => {
    for (const line of ["", "nope", "[]", "null", '{"type":"text"}', '{"type":"done","reply":5}', '{"type":"other"}']) expect(parseEvent(line)).toBeNull();
  });

  it("fills in what a done event leaves out", () => {
    expect(parseEvent('{"type":"done","reply":"x","cards":[]}')).toEqual({ type: "done", reply: "x", cards: [], cook: null, saved: [], requests: 0 });
  });
});

describe("readChatEvents", () => {
  it("delivers text pieces as they arrive and then the end", async () => {
    const events = await collect([encodeEvent({ type: "text", delta: "Hel" }), encodeEvent({ type: "text", delta: "lo" }), encodeEvent(done)]);
    expect(events.map((e) => e.type)).toEqual(["text", "text", "done"]);
  });

  it("handles lines split across chunks, and several lines in one chunk", async () => {
    const line = encodeEvent({ type: "text", delta: "Hello" });
    const events = await collect([line.slice(0, 7), line.slice(7), encodeEvent({ type: "text", delta: "a" }) + encodeEvent(done)]);
    expect(events).toHaveLength(3);
    expect(events[0]).toEqual({ type: "text", delta: "Hello" });
  });

  it("handles a multi-byte character split between chunks", async () => {
    const bytes = enc.encode(encodeEvent({ type: "text", delta: "Käse — ü" }));
    const events: ChatEvent[] = [];
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(bytes.slice(0, 12));
        c.enqueue(bytes.slice(12));
        c.enqueue(enc.encode(encodeEvent(done)));
        c.close();
      },
    });
    await readChatEvents(body, (e) => events.push(e));
    expect(events[0]).toEqual({ type: "text", delta: "Käse — ü" });
  });

  it("reports a stream that ends without an answer, so the page never waits", async () => {
    const events = await collect([encodeEvent({ type: "text", delta: "Hel" })]);
    expect(events.at(-1)).toMatchObject({ type: "error" });
    expect((await collect([])).at(-1)).toMatchObject({ type: "error" });
    const none: ChatEvent[] = [];
    await readChatEvents(null, (e) => none.push(e));
    expect(none[0]).toMatchObject({ type: "error" });
  });

  it("does not add an error after a proper end", async () => {
    expect((await collect([encodeEvent(done)])).map((e) => e.type)).toEqual(["done"]);
    expect((await collect([encodeEvent({ type: "error", error: "x" })])).map((e) => e.type)).toEqual(["error"]);
  });

  it("skips garbage lines in the middle", async () => {
    const events = await collect(["garbage\n", encodeEvent({ type: "text", delta: "ok" }), "{broken\n", encodeEvent(done)]);
    expect(events.map((e) => e.type)).toEqual(["text", "done"]);
  });
});
