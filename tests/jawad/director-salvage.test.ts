import { describe, expect, it, vi } from "vitest";
import { directorProblems, missingLines, salvageDirector } from "@/lib/jawad/director";

describe("«طوّر»: no length limit, and the person's dialogue is never cut", () => {
  it("accepts a very long prompt", () => {
    expect(directorProblems({ en: "word ".repeat(3000), zh: "字".repeat(3000) }, [])).toEqual([]);
  });
  it("keeps spoken Arabic in Arabic script when asked (the film maker's rule), transliterates otherwise", () => {
    const out = { en: 'Audio: "مَرْحَبًا يا صَدِيقي"', zh: '音频："مَرْحَبًا يا صَدِيقي"' };
    expect(directorProblems(out, [], { arabic: true })).toEqual([]);
    expect(directorProblems(out, []).some((p) => /Arabic script/.test(p))).toBe(true);
  });
  it("finds a quoted line that went missing, ignoring diacritics, spacing and punctuation", () => {
    const original = 'الرجل يقول "مرحبا يا صديقي" ثم «كيف حالك؟» ويمشي';
    expect(missingLines(original, { en: 'Audio: "مَرْحَبًا يَا صَدِيقِي" ... "كَيْفَ حَالُكَ"', zh: "" })).toEqual([]);
    expect(missingLines(original, { en: 'Audio: "مَرْحَبًا يَا صَدِيقِي"', zh: "" })).toEqual(["كيف حالك؟"]);
    expect(missingLines("a man walks", { en: "x", zh: "" })).toEqual([]);
  });
});

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
