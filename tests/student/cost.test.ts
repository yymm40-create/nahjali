import { describe, expect, it } from "vitest";
import { STUDENT } from "@config/jawad/student";
import { claudeModelOf } from "@config/claude-models";
import { JAWAD_KNOWLEDGE } from "@config/jawad/knowledge";
import { lightSystem, siteSystem } from "@/lib/film/anthropic";
import { claudeCeilingUsd, studentModel, tokenRatioOf, withTokenRatio, TOKENS_PER_CHAR } from "@/lib/jawad/student/claude";

// «الطالب الذكي» cost: a 4-page project cost ~40 riyals on «الأصيل» with the site's whole text in every call. The branch now
// runs on «الرشيق», its steps carry no site knowledge, and the estimates come from the material's real tokens.

describe("the branch's model", () => {
  it("is «الرشيق», fixed by the branch", () => {
    expect(STUDENT.model).toBe("claude-sonnet-5-5");
    expect(studentModel().key).toBe("sonnet");
    expect(claudeModelOf(STUDENT.model).name).toBe("الرشيق");
  });
});

describe("what a student's call carries", () => {
  it("has the task and no site knowledge", () => {
    const sys = lightSystem("TASK");
    expect(JSON.stringify(sys)).not.toContain(JAWAD_KNOWLEDGE.slice(0, 200));
    expect(sys[0]).toMatchObject({ text: "TASK", cache_control: { type: "ephemeral" } });
  });

  it("the site's text, where it is carried, has its own cache mark (a different task reads it from the cache)", () => {
    const sys = siteSystem("TASK") as { text: string; cache_control?: unknown }[];
    expect(sys[0].text).toBe(JAWAD_KNOWLEDGE);
    expect(sys[0].cache_control).toEqual({ type: "ephemeral" });
    // a call that asked for no cache keeps none at all
    expect((siteSystem("TASK", false) as { cache_control?: unknown }[]).some((b) => b.cache_control)).toBe(false);
  });
});

describe("the ceilings", () => {
  it("are made at the branch model's rates, without the site's text", () => {
    const m = studentModel().rates;
    expect(claudeCeilingUsd(10_000, 5000)).toBeCloseTo(((10_000 * TOKENS_PER_CHAR + 3000) * m.input + 5000 * m.output) / 1e6, 10);
  });

  it("a whole 4-page project is a fraction of the old ~40 riyals", () => {
    // read, understand twice, plan, three chapters, and the design of four pages — as the estimate adds them
    const c = (chars: number, out: number, extra = 0) => claudeCeilingUsd(chars, out, extra);
    const chars = 7200;
    const usd = c(0, 3500, 3200) + c(chars, 6000) + c(chars, 12000) + c(chars, 16000) + 3 * c(chars / 3 + 4000, 14000) + 2 * (c(16_000, 20_000) + c(30_000, 14_500, 1800));
    expect(usd * 3.75 * 1.1).toBeLessThan(25);
  });

  it("the site's text is counted (once, as a cache write) for the calls that still carry it", () => {
    const m = studentModel().rates;
    const withKnowledge = claudeCeilingUsd(0, 0, 0, { knowledge: true });
    expect(withKnowledge - claudeCeilingUsd(0, 0)).toBeCloseTo((JAWAD_KNOWLEDGE.length * TOKENS_PER_CHAR * m.cacheWrite5m) / 1e6, 10);
  });

  it("follow the material's real tokens-per-character when it is known", () => {
    const base = claudeCeilingUsd(40_000, 1000);
    const measured = withTokenRatio(0.3, async () => claudeCeilingUsd(40_000, 1000));
    return measured.then((v) => expect(v).toBeLessThan(base));
  });

  it("fall back to the safe default when the counter cannot be reached", async () => {
    const key = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      expect(await tokenRatioOf("نص ".repeat(500))).toBe(TOKENS_PER_CHAR);
      expect(await tokenRatioOf("قصير")).toBe(TOKENS_PER_CHAR);
    } finally {
      if (key) process.env.ANTHROPIC_API_KEY = key;
    }
  });
});
