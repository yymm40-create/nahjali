import { afterEach, describe, expect, it, vi } from "vitest";
import { claudeStream, readStream } from "@/lib/film/anthropic";

const sse = (events: object[], cut = 7) => {
  const text = events.map((e) => `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`).join("");
  const bytes = new TextEncoder().encode(text);
  // delivered in small uneven pieces, as a network does
  return new ReadableStream<Uint8Array>({
    start(c) {
      for (let i = 0; i < bytes.length; i += cut) c.enqueue(bytes.slice(i, i + cut));
      c.close();
    },
  });
};

const reply = [
  { type: "message_start", message: { model: "claude-opus-5-5", usage: { input_tokens: 1200, cache_read_input_tokens: 800, output_tokens: 1 } } },
  { type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "" } },
  { type: "content_block_stop", index: 0 },
  { type: "content_block_start", index: 1, content_block: { type: "text", text: "" } },
  { type: "ping" },
  { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: '{"stage": 6, "content": "مرحبا' } },
  { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: ' يا علي"}' } },
  { type: "content_block_stop", index: 1 },
  { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 5400 } },
  { type: "message_stop" },
];

describe("Claude's reply as a stream (a long reply is never cut by a clock on the whole answer)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is put back together as the plain API would answer", async () => {
    const m = await readStream(sse(reply));
    expect(m.stop_reason).toBe("end_turn");
    expect(m.model).toBe("claude-opus-5-5");
    expect(m.content!.filter((b) => b.type === "text").map((b) => b.text).join("")).toBe('{"stage": 6, "content": "مرحبا يا علي"}');
    expect(m.usage).toMatchObject({ input_tokens: 1200, cache_read_input_tokens: 800, output_tokens: 5400 });
  });

  it("a stream that stops early is an error, not half an answer", async () => {
    await expect(readStream(sse(reply.slice(0, 6)))).rejects.toThrow(/terminated/);
  });

  it("asks once more when the API is busy, and sends stream: true", async () => {
    const bodies: string[] = [];
    let n = 0;
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: RequestInit) => {
      bodies.push(String(init.body));
      if (n++ === 0) return new Response(JSON.stringify({ error: { message: "Overloaded" } }), { status: 529 });
      return new Response(sse(reply), { status: 200 });
    }));
    const m = await claudeStream("https://api.example/v1/messages", { method: "POST", body: JSON.stringify({ model: "x" }) });
    expect(n).toBe(2);
    expect(JSON.parse(bodies[0]).stream).toBe(true);
    expect(m.stop_reason).toBe("end_turn");
  });

  it("a request the API refuses is final", async () => {
    let n = 0;
    vi.stubGlobal("fetch", vi.fn(async () => (n++, new Response(JSON.stringify({ error: { message: "bad" } }), { status: 400 }))));
    await expect(claudeStream("https://api.example/v1/messages", { method: "POST", body: "{}" })).rejects.toThrow(/Claude 400/);
    expect(n).toBe(1);
  });
});
