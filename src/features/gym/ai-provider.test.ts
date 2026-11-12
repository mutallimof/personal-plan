import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiError, StreamAccumulator, classifyFailure, complete, completeStream, describeFailure } from "./ai-provider.server";

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
    delete process.env["AI_FALLBACK_MODEL"];
    process.env["AI_RETRY_BASE_MS"] = "1"; // no real waiting in tests
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

  const QUOTA = JSON.stringify({ error: { code: 429, message: "You exceeded your current quota ... generate_content_free_tier_input_token_count, limit: 0, model: gemini-4-carbon" } });
  const PER_MINUTE = JSON.stringify({ error: { code: 429, message: "Quota exceeded for metric ...GenerateRequestsPerMinute... Please retry in 0.01s." } });
  const modelsOf = () => bodies.map((b) => b["model"]);

  it("retries a busy provider with a wait in between, then succeeds", async () => {
    mockFetch((n) => (n < 2 ? new Response(PER_MINUTE, { status: 429 }) : json("ok")));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await complete([{ role: "user", content: "x" }])).text).toBe("ok");
    expect(bodies).toHaveLength(3);
    expect(new Set(modelsOf()).size).toBe(1); // still the main model
  });

  it("retries overload (503) and network errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockFetch((n) => (n === 0 ? new Response("unavailable", { status: 503 }) : json("ok")));
    expect((await complete([{ role: "user", content: "x" }])).text).toBe("ok");
    expect(bodies).toHaveLength(2);
    bodies = [];
    let n = 0;
    vi.stubGlobal("fetch", vi.fn(async () => { if (n++ === 0) throw new TypeError("fetch failed"); return json("ok"); }));
    expect((await complete([{ role: "user", content: "x" }])).text).toBe("ok");
  });

  it("goes straight to the fallback model when the main one has no quota (no pointless retries)", async () => {
    process.env["AI_MODEL"] = "gemini-4-carbon";
    mockFetch((n) => (n === 0 ? new Response(QUOTA, { status: 429 }) : json("from fallback")));
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect((await complete([{ role: "user", content: "x" }])).text).toBe("from fallback");
    expect(modelsOf()).toEqual(["gemini-4-carbon", "gemini-3.6-flash"]);
  });

  it("uses AI_FALLBACK_MODEL when it is set, and none when it is off", async () => {
    process.env["AI_MODEL"] = "gemini-4-carbon";
    process.env["AI_FALLBACK_MODEL"] = "my-other-model";
    mockFetch((n) => (n === 0 ? new Response(QUOTA, { status: 429 }) : json("ok")));
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await complete([{ role: "user", content: "x" }]);
    expect(modelsOf()).toEqual(["gemini-4-carbon", "my-other-model"]);
    process.env["AI_FALLBACK_MODEL"] = "off";
    mockFetch(() => new Response(QUOTA, { status: 429 }));
    await expect(complete([{ role: "user", content: "x" }])).rejects.toThrow(/no quota left/);
    expect(bodies).toHaveLength(1);
  });

  it("falls back after the main model keeps failing, and says what happened when both fail", async () => {
    mockFetch(() => new Response("down", { status: 503 }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const err = await complete([{ role: "user", content: "x" }]).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AiError);
    expect((err as Error).message).toMatch(/overloaded.*HTTP 503/);
    expect(bodies).toHaveLength(6); // 3 tries on each of the two models
    expect(new Set(modelsOf()).size).toBe(2);
  });

  it("names the model, the status and what to change when there is no quota anywhere", async () => {
    process.env["AI_MODEL"] = "gemini-4-carbon";
    mockFetch(() => new Response(QUOTA, { status: 429 }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const err = (await complete([{ role: "user", content: "x" }]).catch((e: unknown) => e)) as Error;
    expect(err.message).toMatch(/gemini-4-carbon/);
    expect(err.message).toMatch(/HTTP 429/);
    expect(err.message).toMatch(/AI_MODEL/);
    expect(err.message).not.toMatch(/test-key/);
    expect(err.message).toMatch(/fallback model "gemini-3.6-flash" failed too \(quota, HTTP 429\)/);
    expect(bodies).toHaveLength(2); // one try per model: a quota error is not retried
  });

  it("stops at once on a rejected key, without a fallback", async () => {
    mockFetch(() => new Response("bad key", { status: 401 }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(complete([{ role: "user", content: "x" }])).rejects.toThrow(/key was rejected/);
    expect(bodies).toHaveLength(1);
  });

  it("gives up on a request that never answers", async () => {
    process.env["AI_TIMEOUT_MS"] = "20";
    process.env["AI_FALLBACK_MODEL"] = "off";
    vi.stubGlobal(
      "fetch",
      vi.fn((_u: string, init: RequestInit) => new Promise((_res, rej) => init.signal?.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError"))))),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(complete([{ role: "user", content: "x" }])).rejects.toThrow(/did not answer in time/);
  });

  it("logs the status and the provider's message but never the key", async () => {
    mockFetch(() => new Response(QUOTA, { status: 429 }));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await complete([{ role: "user", content: "x" }]).catch(() => {});
    const text = log.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(text).toMatch(/status=429/);
    expect(text).toMatch(/limit: 0/);
    expect(text).not.toMatch(/test-key/);
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

describe("classifyFailure", () => {
  it("tells a missing allowance from a per-minute limit", () => {
    expect(classifyFailure(429, "exceeded your current quota ... free_tier ... limit: 0").kind).toBe("quota");
    expect(classifyFailure(429, "Quota exceeded for metric GenerateRequestsPerDay").kind).toBe("quota");
    expect(classifyFailure(429, "Quota exceeded ... PerMinute ... limit: 5, retry in 12s").kind).toBe("rate");
    expect(classifyFailure(429, "slow down").kind).toBe("rate");
  });
  it("treats Google's real free-tier answer as no quota, even though it also says 'per minute'", () => {
    const real = "You exceeded your current quota.\n* Quota exceeded for metric: ..._free_tier_requests, limit: 0, model: gemini-4-carbon, description: Generate content requests per minute limit exceeded on Free Tier.\nPlease retry in 6h44m55.256681474s.";
    expect(classifyFailure(429, real).kind).toBe("quota");
    expect(classifyFailure(429, "limit: 5 per minute. Please retry in 2m30s.").kind).toBe("quota");
    const short = classifyFailure(429, "limit: 5 per minute. Please retry in 12.5s.");
    expect(short.kind).toBe("rate");
    expect(short.retryAfterMs).toBe(12500);
  });
  it("sorts the other statuses", () => {
    expect(classifyFailure(503, "").kind).toBe("overloaded");
    expect(classifyFailure(500, "").kind).toBe("overloaded");
    expect(classifyFailure(401, "").kind).toBe("auth");
    expect(classifyFailure(403, "").kind).toBe("auth");
    expect(classifyFailure(404, "models/x is not found").kind).toBe("model");
    expect(classifyFailure(400, "model is not supported").kind).toBe("model");
    expect(classifyFailure(400, "bad json").kind).toBe("other");
  });
  it("reads Retry-After in seconds", () => {
    expect(classifyFailure(429, "x", "7").retryAfterMs).toBe(7000);
    expect(classifyFailure(429, "x", "soon").retryAfterMs).toBeNull();
  });
  it("describes each kind with the status code where there is one", () => {
    expect(describeFailure(classifyFailure(429, "limit: 0"), "m")).toMatch(/"m".*HTTP 429.*AI_MODEL/);
    expect(describeFailure(classifyFailure(503, ""), "m")).toMatch(/HTTP 503/);
  });
});
