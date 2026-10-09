import { afterEach, describe, expect, it, vi } from "vitest";
import { callClaudeJson, claudeTrouble } from "@/lib/film/anthropic";
import { withClaude } from "@/lib/film/claude-model";

const ok = (stop: string, text = '{"a":1}') => ({ ok: true, json: async () => ({ stop_reason: stop, model: "claude-opus-5-5", content: [{ type: "text", text }], usage: { input_tokens: 10, output_tokens: 5 } }) });

describe("a long request that uses up the reply's token budget", () => {
  afterEach(() => vi.unstubAllGlobals());
  const call = () => callClaudeJson<{ a: number }>({ system: "s", turns: [{ role: "user", content: "hi" }], schema: { type: "object" }, maxTokens: 100, effort: "medium" });

  it("is asked again once with less thinking, and answers", async () => {
    process.env.ANTHROPIC_API_KEY = "test";
    const seen: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: { body: string }) => {
      const b = JSON.parse(init.body);
      seen.push(b.output_config.effort);
      return ok(seen.length === 1 ? "max_tokens" : "end_turn");
    }));
    const r = await call();
    expect(r.data.a).toBe(1);
    expect(seen).toEqual(["medium", "low"]);
  });

  it("says so plainly when even that is cut off", async () => {
    process.env.ANTHROPIC_API_KEY = "test";
    vi.stubGlobal("fetch", vi.fn(async () => ok("max_tokens")));
    const e = await call().catch((x) => x);
    expect(claudeTrouble(e)).toMatch(/طويل/);
  });

  it("sends no fallback to Haiku (it has none) and keeps effort for every model", async () => {
    process.env.ANTHROPIC_API_KEY = "test";
    const bodies: Record<string, unknown>[] = [];
    const headers: Record<string, string>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: { body: string; headers: Record<string, string> }) => {
      bodies.push(JSON.parse(init.body));
      headers.push(init.headers);
      return ok("end_turn");
    }));
    for (const id of ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-fable-5-1"]) {
      await withClaude(id, () => callClaudeJson({ system: "s", turns: [{ role: "user", content: "hi" }], schema: { type: "object" }, maxTokens: 100, fallback: true }));
    }
    expect(bodies.map((b) => b.model)).toEqual(["claude-haiku-5-5", "claude-sonnet-5-5", "claude-fable-5-1"]);
    expect("fallbacks" in bodies[0]).toBe(false);
    expect(bodies[1].fallbacks).toBe("default");
    expect(bodies.every((b) => (b.output_config as { effort?: string }).effort === "medium")).toBe(true);
  });
});
