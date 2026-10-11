import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { talk } from "@/lib/games/claude";

const reply = (text: string) => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ stop_reason: text ? "end_turn" : "max_tokens", model: "claude-opus-5-5", content: text ? [{ type: "text", text }] : [{ type: "thinking" }], usage: { input_tokens: 10, output_tokens: 5 } }) });

describe("an empty answer (the thinking used the whole budget)", () => {
  beforeAll(() => void (process.env.ANTHROPIC_API_KEY = "test"));
  afterEach(() => vi.unstubAllGlobals());

  it("is asked again, thinking less, and answers", async () => {
    const efforts: unknown[] = [];
    let n = 0;
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: { body: string }) => {
      efforts.push(JSON.parse(init.body).output_config?.effort);
      return ++n === 1 ? reply("") : reply("ok");
    }));
    const r = await talk({ system: "s", turns: [{ role: "user", text: "hi" }], maxTokens: 100, effort: "medium" });
    expect(r.text).toBe("ok");
    expect(n).toBe(2);
    expect(efforts).toEqual(["medium", "low"]);
  });
});
