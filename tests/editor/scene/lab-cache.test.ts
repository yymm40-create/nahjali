import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ALWAYS_AT_PLAN, openRefs } from "@/lib/editor/scene/higgsfield";
import { RUBRIC } from "@/lib/editor/scene/skill";

// «مختبر الموشن» for less with the same quality: the texts that are the same on every call of a step lead it as their own
// cached parts, the step's one-off tail is not written to the cache, the plan and the critique have room to finish, a fix
// gets the whole review, and the page does what needs no Claude.

type Part = { type: string; text?: string; cache?: boolean };
const s = vi.hoisted(() => ({ calls: [] as { parts: Part[]; maxTokens: number; cacheTtl?: string; cacheTail?: boolean }[], reply: {} as unknown }));
vi.mock("@/lib/film/anthropic", () => ({
  callClaudeJson: async (a: { turns: { content: Part[] }[]; maxTokens: number; cacheTtl?: string; cacheTail?: boolean }) => {
    s.calls.push({ parts: a.turns[a.turns.length - 1].content, maxTokens: a.maxTokens, cacheTtl: a.cacheTtl, cacheTail: a.cacheTail });
    return { data: s.reply, raw: "", usage: { input_tokens: 1, output_tokens: 1 } };
  },
  claudeCost: () => 0.01,
  claudeWhy: (_e: unknown, say: string) => say,
}));
vi.mock("@/lib/editor/pricing", () => ({ claudeCharged: async (_w: unknown, _m: unknown, _l: string, run: () => Promise<object>) => ({ ...(await run()), coins: 1, model: "claude-opus-5-5" }) }));
vi.mock("@/lib/editor/server", () => ({ stillOpen: () => {} }));

const project = { id: "p1", user_id: "u1", timeline: { width: 1080, height: 1920 } } as never;
const who = { id: "u1", owner: false };
const jpg = "/9j/4AAQSkZJRgABAQAAAQABAAD";
const program = "scene({ duration: 4, draw: function (K, t, ctx) { K.text(ctx, K.p('title', 'هلا'), 10, 10, {}); } });";
const ref = "higgsfield-motion-saas/references/transitions.md";
const plan = { title: "x", seconds: 4, skillRefs: [ref, ALWAYS_AT_PLAN[0]] };
const cached = (parts: Part[]) => parts.filter((p) => p.cache).map((p) => p.text ?? "");

describe("the lab's calls cache what repeats and nothing else", () => {
  beforeEach(() => {
    s.calls = [];
    process.env.ANTHROPIC_API_KEY = "test";
  });

  it("the plan leads with the owner's taste files as a cached part and has room to finish", async () => {
    const { labPlan } = await import("@/lib/editor/scene/director");
    s.reply = { title: "x", seconds: 15, shots: [] };
    await labPlan(project, who, { brief: "إعلان لتطبيق", seconds: 15 });
    const c = s.calls[0];
    expect(cached(c.parts)).toEqual([openRefs(ALWAYS_AT_PLAN, Infinity).text]);
    expect(c.parts[0].cache).toBe(true);
    expect(c.parts[1].text).toContain("PLAN a motion-graphics piece");
    expect(c.maxTokens).toBe(32_000);
    expect(c.cacheTail).toBe(false);
    expect(c.cacheTtl).toBeUndefined();
  });

  it("the write leads with the taste files, the reference scenes and the plan's skill files — the review with the SAME skill block", async () => {
    const { labWrite, labReview } = await import("@/lib/editor/scene/director");
    s.reply = { code: program, notes: "" };
    await labWrite(project, who, { plan, seconds: 4 });
    const w = cached(s.calls[0].parts);
    expect(w).toHaveLength(3);
    expect(w[0]).toBe(openRefs(ALWAYS_AT_PLAN, Infinity).text);
    expect(w[1]).toContain("REFERENCE SCENES");
    expect(w[2]).toContain(`<skill-file id="${ref}">`);
    // the taste file the plan also named is not given twice
    expect(w[2]).not.toContain(`<skill-file id="${ALWAYS_AT_PLAN[0]}">`);
    expect(s.calls[0].parts.slice(0, 3).every((p) => p.cache)).toBe(true);
    expect(s.calls[0].cacheTail).toBe(false);

    s.reply = { scores: Object.fromEntries(RUBRIC.map((r) => [r.id, 9])), worst: [], verdict: "", code: "" };
    for (const round of [1, 2]) await labReview(project, who, { plan, code: program, sheets: [jpg], stills: [jpg], round, reviewOnly: true, gate: ["The ending is held only 0.4 s"] });
    const [r1, r2] = [s.calls[1], s.calls[2]];
    // the first part of every round is the write's skill block, byte for byte (round 2 reads it from the cache)
    expect(r1.parts[0]).toEqual({ type: "text", text: w[2], cache: true });
    expect(r2.parts[0]).toEqual(r1.parts[0]);
    expect(cached(r1.parts)).toHaveLength(1);
    expect(r1.parts[1].text).toContain("MEASURED BY THE PAGE");
    expect(r1.parts[1].text).toContain("- The ending is held only 0.4 s");
    expect(r1.maxTokens).toBe(32_000);
    expect(r1.cacheTail).toBe(false);
  });

  it("a fix carries no cached parts, and gets the whole review (up to 8k characters)", async () => {
    const { labWrite } = await import("@/lib/editor/scene/director");
    s.reply = { code: program, notes: "" };
    const errors = `Apply this visual review: ${"x".repeat(7000)}END`;
    await labWrite(project, who, { plan, seconds: 4, code: program, errors });
    expect(cached(s.calls[0].parts)).toEqual([]);
    expect(s.calls[0].parts[0].text).toContain("END");
  });

  it("a plan without skill files sends no empty part", async () => {
    const { labWrite } = await import("@/lib/editor/scene/director");
    s.reply = { code: program, notes: "" };
    await labWrite(project, who, { plan: { title: "x", seconds: 4 }, seconds: 4 });
    expect(cached(s.calls[0].parts)).toHaveLength(2);
    expect(s.calls[0].parts.every((p) => p.type !== "text" || (p.text ?? "").trim())).toBe(true);
  });
});

describe("the page does what needs no Claude", () => {
  const lab = readFileSync("src/components/jawad/editor/MotionLab.tsx", "utf8");

  it("a change from the conversation is built with no review round, and «🧐 راجعه» runs one", () => {
    expect(lab).toContain('title: "🔧 أطبّق ملاحظتك", review: false });');
    expect(lab).toContain("const rounds = o.review === false ? 0 : asked;");
    expect(lab).toContain('const REVIEW_ONE = "🧐 راجعه";');
    expect(lab).toContain("if (message === REVIEW_ONE && info && code && plan && !busy) return reviewNow;");
    expect(lab).toContain("await reviewRounds(built, { program: code, got: info }, chosen, 1, mine)");
  });

  it("the first message of an empty lab that is plainly a brief goes straight to the plan", () => {
    expect(lab).toContain('if (!plan && !code && !history.some((m) => m.role === "user") && !searchOn && !asksToSearch(message) && plainBrief(message)) return void (await makePlan({ brief: message }));');
  });

  it("the review is shown sheets it can read, three stills for a short piece, the page's measurements, and a fix gets the review compact", () => {
    expect(lab).toContain("const cols = perSheet >= 24 ? 4 : 3;");
    expect(lab).toContain("cost > 400 || got.duration <= 20 ? reviewTimes(got.duration).filter((_, i) => i % 2 === 0)");
    expect(lab).toContain("const gate = labGate(");
    expect(lab).toContain("JSON.stringify({ verdict: r.review.verdict, worst: r.review.worst, below })");
    expect(lab).not.toContain("JSON.stringify(r.review)");
  });

  it("a cover call does not cache its one-off turn", () => {
    expect(readFileSync("src/lib/editor/scene/cover.ts", "utf8")).toContain("cacheTail: false");
  });
});
