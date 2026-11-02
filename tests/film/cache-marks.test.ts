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
  let body: { system: Block[]; messages: { role: string; content: Block[] }[] } | null = null;
  vi.stubGlobal("fetch", vi.fn(async (_u: string, init: RequestInit) => ((body = JSON.parse(String(init.body))), sse('{"ok":true}'))));
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
});
