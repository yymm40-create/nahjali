import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { callClaudeJson, claudeTrouble, claudeWhy, CLAUDE_TRIES } from "@/lib/film/anthropic";

// «مستفز تكرر هالشي»: a busy minute or a dropped line used to come back as «جرّب بعد شوي» at once. Now the request is
// tried again by itself, and whatever is left is NAMED — and for the owner the raw line comes with it.
const ok = (text = '{"a":1}') => ({ ok: true, headers: { get: () => null }, json: async () => ({ stop_reason: "end_turn", model: "claude-opus-5-5", content: [{ type: "text", text }], usage: { input_tokens: 10, output_tokens: 5 } }) });
const bad = (status: number, message = "boom") => ({ ok: false, status, headers: { get: () => null }, json: async () => ({ error: { message } }) });

const call = () => callClaudeJson<{ a: number }>({ system: "s", turns: [{ role: "user", content: "hi" }], schema: { type: "object" }, maxTokens: 100 });

describe("a request that stumbles is tried again, not handed back", () => {
  afterEach(() => vi.unstubAllGlobals());
  beforeAll(() => void (process.env.ANTHROPIC_API_KEY = "test"));

  for (const status of [429, 500, 502, 503, 504, 529]) {
    it(`tries again after ${status} and answers`, async () => {
      let n = 0;
      vi.stubGlobal("fetch", vi.fn(async () => (++n < 3 ? bad(status) : ok())));
      expect((await call()).data.a).toBe(1);
      expect(n).toBe(3);
    });
  }

  it("tries again when the line breaks on the way", async () => {
    let n = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      if (++n === 1) throw new Error("fetch failed");
      return ok();
    }));
    expect((await call()).data.a).toBe(1);
  });

  it("gives up after three tries, and says what happened", async () => {
    let n = 0;
    vi.stubGlobal("fetch", vi.fn(async () => (n++, bad(529, "overloaded"))));
    const e = await call().catch((x) => x);
    expect(n).toBe(CLAUDE_TRIES);
    expect(claudeTrouble(e)).toMatch(/مشغول/);
  });

  it("never asks twice when the API said no (a bad request, a key, no credit)", async () => {
    for (const [status, message, says] of [[400, "images too many", /رفضت صيغة الطلب/], [401, "invalid x-api-key", /مفتاح/], [400, "credit balance is too low", /رصيد/]] as const) {
      let n = 0;
      vi.stubGlobal("fetch", vi.fn(async () => (n++, bad(status, message))));
      const e = await call().catch((x) => x);
      expect(n).toBe(1);
      expect(claudeTrouble(e)).toMatch(says);
    }
  });

  it("asks once more when the reply isn't the JSON asked for, then names it", async () => {
    let n = 0;
    vi.stubGlobal("fetch", vi.fn(async () => (++n === 1 ? ok("not json at all") : ok())));
    expect((await call()).data.a).toBe(1);
    vi.stubGlobal("fetch", vi.fn(async () => ok("still not json")));
    const e = await call().catch((x) => x);
    expect(claudeTrouble(e)).toMatch(/صيغة غلط/);
  });

  it("the owner always reads the raw reason; a customer reads the robot's words", async () => {
    const e = new Error("Claude 418: a teapot");
    expect(claudeWhy(e, "ما قدر حيدرة يرد الحين.", "yymm40@gmail.com")).toMatch(/تفصيل للرئيس: Claude 418: a teapot/);
    expect(claudeWhy(e, "ما قدر حيدرة يرد الحين.", "someone@else.com")).toBe("ما قدر حيدرة يرد الحين.");
  });
});
