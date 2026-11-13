import { afterEach, describe, expect, it, vi } from "vitest";
import { callClaudeJson, type ClaudeTurn } from "@/lib/film/anthropic";

// what a robot's request carries for the cache (the owner, 2 November 2026: no hidden spending)
const sse = (text: string) => {
  const events = [
    { type: "message_start", message: { model: "claude-opus-5-5", usage: { input_tokens: 10, output_tokens: 1 } } },
    { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
    { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } },
    { type: "content_block_stop", index: 0 },
    { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 5 } },
    { type: "message_stop" },
  ];
  return new Response(events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join(""), { status: 200 });
};
type Block = { type: string; text?: string; cache_control?: { type: string; ttl?: string } };
async function sent(o: Partial<Parameters<typeof callClaudeJson>[0]> & { turns: ClaudeTurn[] }) {
  let body: { system: Block[]; messages: { role: string; content: Block[]; output_config?: { effort: string } }[]; output_config: { effort?: string }; headers: Record<string, string> } | null = null;
  vi.stubGlobal("fetch", vi.fn(async (_u: string, init: RequestInit) => ((body = { ...JSON.parse(String(init.body)), headers: init.headers as Record<string, string> }), sse('{"ok":true}'))));
  process.env.ANTHROPIC_API_KEY = "test";
  await callClaudeJson({ system: "TASK", schema: { type: "object" }, maxTokens: 100, ...o });
  return body!;
}
const marked = (b: Awaited<ReturnType<typeof sent>>) => b.messages.flatMap((m, i) => m.content.map((c, k) => (c.cache_control ? `${i}:${k}` : "")).filter(Boolean));

describe("the cache marks of a request", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("a conversation: the latest turn and the one before it (the history is read back next message)", async () => {
    const b = await sent({ turns: [{ role: "user", content: "a" }, { role: "assistant", content: "b" }, { role: "user", content: "c" }] });
    expect(marked(b)).toEqual(["1:0", "2:0"]);
    expect(b.system.at(-1)?.cache_control).toEqual({ type: "ephemeral" });
  });

  it("per-turn facts ride at the start of the latest turn; the system stays the same", async () => {
    const one = await sent({ turns: [{ role: "user", content: "hi" }], turnNote: "RECORD 1" });
    const two = await sent({ turns: [{ role: "user", content: "hi" }], turnNote: "RECORD 2" });
    expect(JSON.stringify(one.system)).toBe(JSON.stringify(two.system));
    expect(one.messages[0].content[0].text).toContain("RECORD 1");
  });

  it("a one-shot marks only its stable parts (no premium on a tail never sent again), and a 1-hour call marks all for an hour", async () => {
    const b = await sent({ turns: [{ role: "user", content: [{ type: "text", text: "SKILLS", cache: true }, { type: "text", text: "this call only" }] }], cacheTail: false, cacheTtl: "1h" });
    expect(marked(b)).toEqual(["0:0"]);
    expect(b.messages[0].content[0].cache_control).toEqual({ type: "ephemeral", ttl: "1h" });
    expect(b.system.at(-1)?.cache_control).toEqual({ type: "ephemeral", ttl: "1h" });
  });

  it("never more than four marks in all", async () => {
    const parts = [1, 2, 3, 4].map((n) => ({ type: "text" as const, text: `P${n}`, cache: true }));
    const b = await sent({ turns: [{ role: "user", content: "a" }, { role: "assistant", content: "b" }, { role: "user", content: [...parts, { type: "text", text: "tail" }] }] });
    expect(marked(b).length).toBe(3);
    expect(marked(b)).toContain("2:4");
  });

  it("a reply's own thinking level rides as a per-message effort; the request's level stays fixed (one cache for every step)", async () => {
    const high = await sent({ turns: [{ role: "user", content: "plan it" }], effort: "medium", turnEffort: "high" });
    const low = await sent({ turns: [{ role: "user", content: "fix it" }], effort: "medium", turnEffort: "low" });
    for (const b of [high, low]) {
      expect(b.output_config.effort).toBe("medium");
      expect(b.headers["anthropic-beta"]).toBe("mid-conversation-output-config-2026-07-01");
    }
    expect(high.messages.at(-1)).toEqual({ role: "system", content: [], output_config: { effort: "high" } });
    expect(low.messages.at(-1)).toEqual({ role: "system", content: [], output_config: { effort: "low" } });
    expect(JSON.stringify(high.system)).toBe(JSON.stringify(low.system));
  });

  it("if the API refuses the per-message effort or the shared format, the request is asked once more the plain way", async () => {
    process.env.ANTHROPIC_API_KEY = "test";
    const bodies: { messages: { role: string }[]; output_config: { effort?: string; format?: { schema: unknown } } }[] = [];
    let refuse = "Claude 400: output_config.effort requires a model that supports per-turn effort";
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      if (refuse) {
        const r = new Response(JSON.stringify({ error: { message: refuse.replace(/^Claude 400: /, "") } }), { status: 400 });
        refuse = "";
        return r;
      }
      return sse('{"ok":true}');
    }));
    await callClaudeJson({ system: "TASK", schema: { type: "object" }, maxTokens: 100, turns: [{ role: "user", content: "x" }], effort: "medium", turnEffort: "high" });
    expect(bodies.length).toBe(2);
    expect(bodies[1].messages.some((m) => m.role === "system")).toBe(false);
    expect(bodies[1].output_config.effort).toBe("high");

    bodies.length = 0;
    refuse = "Claude 400: output_config.format.schema: anyOf is too complex";
    const narrow = { type: "object", properties: { narrow: { type: "boolean" } } };
    await callClaudeJson({ system: "TASK", schema: { type: "object" }, schemaFallback: narrow, maxTokens: 100, turns: [{ role: "user", content: "x" }] });
    expect(bodies.length).toBe(2);
    expect(bodies[1].output_config.format?.schema).toEqual(narrow);
  });

  it("a refusal with a per-message effort is asked again with the server-side fallback (and the plain effort)", async () => {
    process.env.ANTHROPIC_API_KEY = "test";
    const bodies: { messages: { role: string }[]; fallbacks?: string; output_config: { effort?: string } }[] = [];
    const refused = () => {
      const events = [
        { type: "message_start", message: { model: "claude-opus-5-5", usage: { input_tokens: 10, output_tokens: 1 } } },
        { type: "message_delta", delta: { stop_reason: "refusal" }, usage: { output_tokens: 1 } },
        { type: "message_stop" },
      ];
      return new Response(events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join(""), { status: 200 });
    };
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: RequestInit) => (bodies.push(JSON.parse(String(init.body))), bodies.length === 1 ? refused() : sse('{"ok":true}'))));
    await callClaudeJson({ system: "TASK", schema: { type: "object" }, maxTokens: 100, turns: [{ role: "user", content: "x" }], effort: "medium", turnEffort: "high" });
    expect(bodies.length).toBe(2);
    expect(bodies[0].fallbacks).toBeUndefined();
    expect(bodies[1].fallbacks).toBe("default");
    expect(bodies[1].messages.some((m) => m.role === "system")).toBe(false);
    expect(bodies[1].output_config.effort).toBe("high");
  });
});
