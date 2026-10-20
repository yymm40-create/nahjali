// «مختبر الموشن»: a program too long for one request is written in pieces and continued from where it stopped.
import { describe, expect, it } from "vitest";
import { readStream } from "@/lib/film/anthropic";
import { continueAsk, partialCode, stitchCode } from "@/lib/editor/scene/resume";

const sse = (events: object[], tail?: Error) => {
  const bytes = new TextEncoder().encode(events.map((e) => `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`).join(""));
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(c) {
      if (i >= bytes.length) return tail ? c.error(tail) : c.close();
      c.enqueue(bytes.slice(i, i + 9));
      i += 9;
    },
  });
};
const start = { type: "message_start", message: { model: "claude-opus-5-5", usage: { input_tokens: 900, output_tokens: 1 } } };
const textStart = { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } };
const delta = (text: string) => ({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text } });

describe("reading what a cut reply had written", () => {
  it("the program so far, out of the half-written JSON (escapes decoded, a half escape dropped)", () => {
    expect(partialCode('{"code":"scene({\\n  duration: 5,\\n  draw: (K, t) => { K.text(\\"hi\\\\n\\") }')).toBe('scene({\n  duration: 5,\n  draw: (K, t) => { K.text("hi\\n") }');
    expect(partialCode('{"code": "a\\u0645b\\')).toBe("aمb");
    expect(partialCode('{"code":"ab\\u06')).toBe("ab");
    expect(partialCode('{"notes":"x"')).toBe("");
    expect(partialCode("")).toBe("");
  });

  it("the continuation is joined to what was written, without repeating its last lines", () => {
    const written = "scene({ duration: 5, draw: (K, t) => {\n  const a = 1;\n  const b = 2;\n  K.rect(a, b, 40, 40, '#ff0000');";
    expect(stitchCode(written, "\n  K.rect(0, 0, 9, 9);\n} });")).toBe(written + "\n  K.rect(0, 0, 9, 9);\n} });");
    const again = "  const b = 2;\n  K.rect(a, b, 40, 40, '#ff0000');\n  K.done();\n} });";
    expect(stitchCode(written, again)).toBe(written + "\n  K.done();\n} });");
    expect(stitchCode("", "```js\nscene({})\n")).toBe("scene({})\n");
  });

  it("the continuation request carries the written part and says to go on from its last character", () => {
    const ask = continueAsk("scene({ duration: 5,");
    expect(ask).toContain("scene({ duration: 5,");
    expect(ask).toMatch(/very next character/);
  });

  it("past the deadline the stream stops and what is written comes back as «deadline»", async () => {
    const enc = (events: object[]) => new TextEncoder().encode(events.map((e) => `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`).join(""));
    const first = enc([start, textStart, delta('{"code":"scene({'), delta(" duration: 5,")]);
    const second = enc([delta(" draw: 1,")]);
    const slow = new ReadableStream<Uint8Array>({
      async start(c) {
        c.enqueue(first);
        await new Promise((ok) => setTimeout(ok, 120));
        c.enqueue(second);
        c.close();
      },
    });
    const m = await readStream(slow, () => {}, { stopAt: Date.now() + 60 });
    expect(m.stop_reason).toBe("deadline");
    expect(partialCode(m.content!.map((b) => b.text).join(""))).toMatch(/^scene\(\{ duration: 5,/);
  });

  it("a line cut after some text returns that text («interrupted»); with nothing written it still fails", async () => {
    const cut = sse([start, textStart, delta('{"code":"scene({ duration: 5,')], new Error("terminated"));
    const m = await readStream(cut, () => {}, {});
    expect(m.stop_reason).toBe("interrupted");
    expect(partialCode(m.content!.map((b) => b.text).join(""))).toBe("scene({ duration: 5,");
    await expect(readStream(sse([start, textStart], new Error("terminated")), () => {}, {})).rejects.toThrow(/terminated/);
    await expect(readStream(sse([start, textStart, delta("x")], new Error("terminated")))).rejects.toThrow(/terminated/);
  });

  it("a whole reply is unchanged when no deadline arrives", async () => {
    const m = await readStream(sse([start, textStart, delta('{"code":"ok"}'), { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 7 } }]), () => {}, { stopAt: Date.now() + 60_000 });
    expect(m.stop_reason).toBe("end_turn");
  });
});

describe("a lab step cut by the request's time, continued by the next request", () => {
  it("the effort goes one step down, and a cap from the page never raises it", async () => {
    const { lowerEffort, effortAtMost } = await import("@/lib/editor/scene/resume");
    expect(lowerEffort("high")).toBe("medium");
    expect(lowerEffort("medium")).toBe("low");
    expect(lowerEffort("low")).toBe("low");
    expect(effortAtMost("high", "medium")).toBe("medium");
    expect(effortAtMost("medium", "high")).toBe("medium");
    expect(effortAtMost("high", undefined)).toBe("high");
    expect(effortAtMost("high", "nonsense")).toBe("high");
  });
});
