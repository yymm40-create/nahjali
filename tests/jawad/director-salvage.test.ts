import { describe, expect, it, vi } from "vitest";
import { directorProblems, salvageDirector } from "@/lib/jawad/director";

describe("«المخرج الخارق»: an answer still off after the retries is repaired, not refused", () => {
  it("turns the skill's labels into the references' names and drops @ from unknown ones", () => {
    const out = salvageDirector({ en: "<<<video_1>>> continues; @image7 holds the cup", zh: "<<<video_1>>> 继续" }, ["before", "hero"]);
    expect(out).toEqual({ en: "@before continues; image7 holds the cup", zh: "@before 继续" });
    expect(directorProblems(out!, ["before", "hero"]).filter((p) => /names|not one of/.test(p))).toEqual([]);
  });
  it("keeps a long prompt (the length guide is not worth a failed edit) and gives up only on an empty one", () => {
    const long = "word ".repeat(400);
    expect(salvageDirector({ en: long, zh: "" }, [])).toEqual({ en: long.trim(), zh: long.trim() });
    expect(salvageDirector({ en: " ", zh: "" }, [])).toBeNull();
  });
});

describe("«المخرج الخارق» is not asked again for what the site repairs itself", () => {
  async function run(answers: { en: string; zh: string }[]) {
    vi.resetModules();
    const calls: unknown[] = [];
    vi.doMock("@/lib/film/anthropic", () => ({
      callClaudeJson: vi.fn(async (c: unknown) => {
        calls.push(c);
        const data = answers[Math.min(calls.length - 1, answers.length - 1)];
        return { data, raw: JSON.stringify(data), usage: { input_tokens: 1, output_tokens: 1 } };
      }),
      claudeCost: () => 0.01,
    }));
    const { directorRun, mechanicalOnly } = await import("@/lib/jawad/server/director");
    return { calls, directorRun, mechanicalOnly };
  }
  it("a skill label or an unknown @name is repaired at once: one call", async () => {
    const { calls, directorRun, mechanicalOnly } = await run([{ en: "<<<image_1>>> walks; @image7 waves", zh: "<<<image_1>>> 走" }]);
    const r = await directorRun("TASK", [{ type: "text", text: "x" }], ["hero"]);
    expect(calls).toHaveLength(1);
    expect(r.attempts).toBe(1);
    expect(r.prompt).toContain("@hero walks; image7 waves");
    expect(mechanicalOnly(["Arabic script found."])).toBe(false);
    vi.doUnmock("@/lib/film/anthropic");
  });
  it("a fault only Claude can fix (Arabic script) is asked once more, at most twice in all", async () => {
    const { calls, directorRun } = await run([{ en: "قال مرحبا", zh: "说" }]);
    const r = await directorRun("TASK", [{ type: "text", text: "x" }], []);
    expect(calls).toHaveLength(2);
    expect(r.attempts).toBe(2);
    vi.doUnmock("@/lib/film/anthropic");
  });
});
