import { afterEach, describe, expect, it, vi } from "vitest";
import { callClaudeJson, type ClaudeTurn } from "@/lib/film/anthropic";
import { BATCH_SHARED_END, batchAsk } from "@/lib/film/sheets";
import { replyTokens } from "@/lib/film/usage";

// the film's cost cuts (the owner, 2 November 2026): a batch shares one cached conversation, every reply's tokens are kept
const sse = () => {
  const events = [
    { type: "message_start", message: { model: "claude-opus-5-5", usage: { input_tokens: 10, output_tokens: 1 } } },
    { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
    { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: '{"ok":true}' } },
    { type: "content_block_stop", index: 0 },
    { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 5 } },
    { type: "message_stop" },
  ];
  return new Response(events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join(""), { status: 200 });
};
type Block = { type: string; text?: string; cache_control?: { type: string; ttl?: string } };
type Body = { messages: { role: string; content: Block[] }[] };
async function sent(turns: ClaudeTurn[]) {
  let body: Body | null = null;
  vi.stubGlobal("fetch", vi.fn(async (_u: string, init: RequestInit) => ((body = JSON.parse(String(init.body))), sse())));
  process.env.ANTHROPIC_API_KEY = "test";
  await callClaudeJson({ system: "TASK", turns, schema: { type: "object" }, maxTokens: 100, cacheTtl: "1h", cacheTail: false });
  return body!;
}
/** The request up to (and with) its last cache mark: what a later request can read from the cache. */
const cachedPrefix = (b: Body) => {
  const flat = b.messages.flatMap((m) => m.content.map((c) => ({ role: m.role, ...c })));
  const last = flat.map((c) => Boolean(c.cache_control)).lastIndexOf(true);
  return JSON.stringify(flat.slice(0, last + 1));
};

describe("«كل الشيتات مع بعض»: one cached conversation for the whole batch", () => {
  afterEach(() => vi.unstubAllGlobals());
  const turns: ClaudeTurn[] = [
    { role: "user", content: "the story" },
    { role: "assistant", content: "the map" },
    { role: "user", content: [{ type: "text", text: "اعتمد. اكتب برومبتات كل الشيتات الباقية دفعة واحدة" }] },
  ];

  it("the sheet's own line comes after the marked shared part, unmarked", async () => {
    const b = await sent(batchAsk(turns, { id: "CHR-01", name: "علي" }));
    const latest = b.messages.at(-1)!.content;
    expect(latest.at(-1)?.text).toContain("CHR-01");
    expect(latest.at(-1)?.cache_control).toBeUndefined();
    expect(latest.at(-2)).toMatchObject({ text: BATCH_SHARED_END, cache_control: { type: "ephemeral", ttl: "1h" } });
  });

  it("every sheet's request carries the same cached prefix (the first writes it, the others read it)", async () => {
    const a = await sent(batchAsk(turns, { id: "CHR-01", name: "علي" }));
    const b = await sent(batchAsk(turns, { id: "ENV-01", name: "البيت" }));
    expect(cachedPrefix(a)).toBe(cachedPrefix(b));
    expect(cachedPrefix(a)).not.toContain("CHR-01");
  });

  it("the conversation itself is not changed", () => {
    const ask = batchAsk(turns, { id: "CHR-01", name: "علي" });
    expect(ask.slice(0, 2)).toEqual(turns.slice(0, 2));
    expect(turns[2].content).toHaveLength(1);
  });
});

describe("a film reply's tokens, kept beside its cost", () => {
  it("fresh input, cache written (5-minute / 1-hour when given), cache read and output", () => {
    expect(replyTokens({ input_tokens: 12, output_tokens: 300, cache_creation_input_tokens: 5000, cache_read_input_tokens: 40000, cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 5000 } })).toEqual({
      input_tokens: 12,
      cache_creation_input_tokens: 5000,
      cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 5000 },
      cache_read_input_tokens: 40000,
      output_tokens: 300,
    });
    expect(replyTokens({ input_tokens: 7, output_tokens: 9 })).toEqual({ input_tokens: 7, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 9 });
  });
});
