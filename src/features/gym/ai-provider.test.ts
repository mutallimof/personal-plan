import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiError, StreamAccumulator, complete, completeStream } from "./ai-provider.server";

const sse = (...objs: unknown[]) => objs.map((o) => `data: ${JSON.stringify(o)}\n\n`).join("") + "data: [DONE]\n\n";
const delta = (d: unknown) => ({ choices: [{ delta: d }] });

describe("StreamAccumulator", () => {
  it("passes text on piece by piece and returns the whole", () => {
    const pieces: string[] = [];
    const acc = new StreamAccumulator((d) => pieces.push(d));
    for (const line of sse(delta({ content: "Hel" }), delta({ content: "lo " }), delta({ content: "there" })).split("\n")) acc.line(line);
    expect(pieces).toEqual(["Hel", "lo ", "there"]);
    expect(acc.reply()).toMatchObject({ text: "Hello there", toolCalls: [] });
  });

  it("puts a tool call back together from fragments", () => {
    const acc = new StreamAccumulator(() => {});
    const lines = sse(
      delta({ tool_calls: [{ index: 0, id: "c1", function: { name: "suggest_recipes", arguments: '{"recipes"' } }] }),
      delta({ tool_calls: [{ index: 0, function: { arguments: ':[{"title":"x"}]}' } }] }),
    );
    for (const l of lines.split("\n")) acc.line(l);
    const r = acc.reply();
    expect(r.toolCalls).toHaveLength(1);
    expect(r.toolCalls[0]).toMatchObject({ id: "c1", function: { name: "suggest_recipes", arguments: '{"recipes":[{"title":"x"}]}' } });
    expect(r.message.tool_calls).toHaveLength(1);
  });

  it("keeps several calls apart, and copes with a missing index", () => {
    const acc = new StreamAccumulator(() => {});
    const lines = sse(
      delta({ tool_calls: [{ id: "a", function: { name: "search_pantry", arguments: "{}" } }] }),
      delta({ tool_calls: [{ id: "b", function: { name: "cook_recipe", arguments: '{"recipe_id":"r1"}' } }] }),
    );
    for (const l of lines.split("\n")) acc.line(l);
    expect(acc.reply().toolCalls.map((c) => c.function.name)).toEqual(["search_pantry", "cook_recipe"]);
  });

  it("keeps the thought signature Gemini attaches to a call", () => {
    const acc = new StreamAccumulator(() => {});
    for (const l of sse(delta({ tool_calls: [{ index: 0, id: "a", extra_content: { google: { thought_signature: "sig" } }, function: { name: "search_pantry", arguments: "{}" } }] })).split("\n")) acc.line(l);
    expect(acc.reply().toolCalls[0]?.extra_content).toEqual({ google: { thought_signature: "sig" } });
  });

  it("ignores comments, blank lines, [DONE] and broken JSON", () => {
    const acc = new StreamAccumulator(() => {});
    for (const l of [": keep-alive", "", "data: [DONE]", "data: {broken", "event: x", 'data: {"choices":[]}']) acc.line(l);
    expect(acc.reply()).toMatchObject({ text: "", toolCalls: [] });
  });

  it("drops a call without a name", () => {
    const acc = new StreamAccumulator(() => {});
    for (const l of sse(delta({ tool_calls: [{ index: 0, id: "a", function: { arguments: "{}" } }] })).split("\n")) acc.line(l);
    expect(acc.reply().toolCalls).toEqual([]);
  });
});

describe("requests to the provider", () => {
  const original = { ...process.env };
  let bodies: Record<string, unknown>[];

  function mockFetch(respond: (n: number) => Response) {
    bodies = [];
    let n = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
        return respond(n++);
      }),
    );
  }
  const json = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });

  beforeEach(() => {
    process.env["AI_API_KEY"] = "test-key";
    delete process.env["AI_PROVIDER"];
    delete process.env["AI_REASONING"];
    delete process.env["AI_MODEL"];
  });
  afterEach(() => {
    process.env = { ...original };
    vi.unstubAllGlobals();
  });

  it("asks Gemini to think little by default", async () => {
    mockFetch(() => json("hi"));
    await complete([{ role: "user", content: "x" }]);
    expect(bodies[0]?.["reasoning_effort"]).toBe("low");
    expect(bodies[0]).not.toHaveProperty("stream");
  });

  it("takes the effort from AI_REASONING, and sends none when it is off", async () => {
    process.env["AI_REASONING"] = "minimal";
    mockFetch(() => json("hi"));
    await complete([{ role: "user", content: "x" }]);
    expect(bodies[0]?.["reasoning_effort"]).toBe("minimal");
    process.env["AI_REASONING"] = "off";
    await complete([{ role: "user", content: "x" }]);
    expect(bodies[1]).not.toHaveProperty("reasoning_effort");
  });

  it("sends no reasoning setting to other providers unless asked", async () => {
    process.env["AI_PROVIDER"] = "openai-compatible";
    process.env["AI_BASE_URL"] = "http://localhost:1/v1";
    process.env["AI_MODEL"] = "m";
    mockFetch(() => json("hi"));
    await complete([{ role: "user", content: "x" }]);
    expect(bodies[0]).not.toHaveProperty("reasoning_effort");
  });

  it("retries once without the setting when the model rejects it", async () => {
    mockFetch((n) => (n === 0 ? new Response("Unsupported value: reasoning_effort", { status: 400 }) : json("ok")));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await complete([{ role: "user", content: "x" }])).text).toBe("ok");
    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toHaveProperty("reasoning_effort");
    expect(bodies[1]).not.toHaveProperty("reasoning_effort");
  });

  it("does not retry other errors, and says so briefly", async () => {
    mockFetch(() => new Response("nope", { status: 500 }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(complete([{ role: "user", content: "x" }])).rejects.toThrow(AiError);
    expect(bodies).toHaveLength(1);
    mockFetch(() => new Response("slow down", { status: 429 }));
    await expect(complete([{ role: "user", content: "x" }])).rejects.toThrow(/busy/);
  });

  it("streams: asks for a stream and hands text over as it arrives", async () => {
    const enc = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        const all = enc.encode(sse(delta({ content: "Hi" }), delta({ content: " there" })));
        c.enqueue(all.slice(0, 20)); // a line cut in two
        c.enqueue(all.slice(20));
        c.close();
      },
    });
    mockFetch(() => new Response(body, { status: 200 }));
    const pieces: string[] = [];
    const reply = await completeStream([{ role: "user", content: "x" }], undefined, (d) => pieces.push(d));
    expect(bodies[0]?.["stream"]).toBe(true);
    expect(pieces.join("")).toBe("Hi there");
    expect(reply.text).toBe("Hi there");
  });
});
