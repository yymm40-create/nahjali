import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ALWAYS_AT_PLAN, openRefs } from "@/lib/editor/scene/higgsfield";
import { RUBRIC } from "@/lib/editor/scene/skill";
import { COVER_LAB_SCHEMA, LAB_KINDS, LAB_SCHEMA } from "@/lib/editor/scene/schemas";

// «مختبر الموشن» for less with the same quality: the texts that are the same on every call of a step lead it as their own
// cached parts, the step's one-off tail is not written to the cache, the plan and the critique have room to finish, a fix
// gets the whole review, and the page does what needs no Claude.

type Part = { type: string; text?: string; cache?: boolean };
type Call = { parts: Part[]; maxTokens: number; cacheTtl?: string; cacheTail?: boolean; schema: object; effort?: string; turnEffort?: string; rawText?: boolean };
const s = vi.hoisted(() => ({ calls: [] as Call[], reply: {} as unknown, queue: [] as unknown[], raw: "", paid: [] as number[] }));
vi.mock("@/lib/film/anthropic", () => ({
  callClaudeJson: async (a: { turns: { content: Part[] }[] } & Omit<Call, "parts">) => {
    s.calls.push({ parts: a.turns[a.turns.length - 1].content, maxTokens: a.maxTokens, cacheTtl: a.cacheTtl, cacheTail: a.cacheTail, schema: a.schema, effort: a.effort, turnEffort: a.turnEffort, rawText: a.rawText });
    if (a.rawText) return { data: undefined, raw: s.raw, usage: { input_tokens: 1, output_tokens: 1 } };
    // a queued reply is sent as it is (a wrong kind); otherwise the reply is the branch the request names
    if (s.queue.length) return { data: s.queue.shift(), raw: "", usage: { input_tokens: 1, output_tokens: 1 } };
    const kind = /result\.kind = \\"(\w+)/.exec(JSON.stringify(a.turns))?.[1];
    return { data: { result: { kind, ...(s.reply as object) } }, raw: "", usage: { input_tokens: 1, output_tokens: 1 } };
  },
  claudeCost: () => 0.01,
  claudeWhy: (_e: unknown, say: string) => say,
}));
vi.mock("@/lib/editor/pricing", () => ({ claudeCharged: async (_w: unknown, _m: unknown, _l: string, run: () => Promise<object>, usd: (x: never) => number) => { const r = await run(); s.paid.push(usd(r as never)); return { ...r, coins: 1, model: "claude-opus-5-5" }; } }));
vi.mock("@/lib/editor/server", () => ({ stillOpen: () => {} }));
vi.mock("@/lib/robot-handoff", () => ({ remember: async () => ({ lead: [], kept: [], usd: 0, fresh: false }), withNote: (t: string) => t }));

const project = { id: "p1", user_id: "u1", timeline: { width: 1080, height: 1920 } } as never;
const who = { id: "u1", owner: false };
const jpg = "/9j/4AAQSkZJRgABAQAAAQABAAD";
const program = "scene({ duration: 4, draw: function (K, t, ctx) { K.text(ctx, K.p('title', 'هلا'), 10, 10, {}); } });";
const ref = "higgsfield-motion-saas/references/transitions.md";
const plan = { title: "x", seconds: 4, skillRefs: [ref, ALWAYS_AT_PLAN[0]] };
const cached = (parts: Part[]) => parts.filter((p) => p.cache).map((p) => p.text ?? "");
const passing = { scores: Object.fromEntries(RUBRIC.map((r) => [r.id, 9])), worst: [], verdict: "", code: "" };

describe("the lab's calls cache what repeats and nothing else", () => {
  beforeEach(() => {
    s.calls = [];
    s.queue = [];
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
    expect(c.cacheTtl).toBe("1h");
  });

  it("the write leads with the taste files, the plan's skill files and the reference scenes — the review with the SAME first two", async () => {
    const { labWrite, labReview } = await import("@/lib/editor/scene/director");
    s.reply = { code: program, notes: "" };
    await labWrite(project, who, { plan, seconds: 4 });
    const w = cached(s.calls[0].parts);
    expect(w).toHaveLength(3);
    expect(w[0]).toBe(openRefs(ALWAYS_AT_PLAN, Infinity).text);
    expect(w[1]).toContain(`<skill-file id="${ref}">`);
    // the taste file the plan also named is not given twice
    expect(w[1]).not.toContain(`<skill-file id="${ALWAYS_AT_PLAN[0]}">`);
    expect(w[2]).toContain("REFERENCE SCENES");
    expect(s.calls[0].parts.slice(0, 3).every((p) => p.cache)).toBe(true);
    expect(s.calls[0].cacheTail).toBe(false);

    s.reply = passing;
    for (const round of [1, 2]) await labReview(project, who, { plan, code: program, sheets: [jpg], stills: [jpg], round, reviewOnly: true, gate: ["The ending is held only 0.4 s"] });
    const [r1, r2] = [s.calls[1], s.calls[2]];
    // the first two parts of every round are the write's taste and skill blocks, byte for byte (read from the cache)
    expect(r1.parts.slice(0, 2)).toEqual(s.calls[0].parts.slice(0, 2));
    expect(r2.parts.slice(0, 2)).toEqual(r1.parts.slice(0, 2));
    expect(cached(r1.parts)).toHaveLength(2);
    expect(r1.parts[2].text).toContain("MEASURED BY THE PAGE");
    expect(r1.parts[2].text).toContain("- The ending is held only 0.4 s");
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

describe("one Claude conversation: every lab step reads the same cached prefix («وحد الصيغة لكل الخطوات، نفس كلود»)", () => {
  beforeEach(() => {
    s.calls = [];
    s.queue = [];
    process.env.ANTHROPIC_API_KEY = "test";
  });

  /** plan → write → review → fix (patch) → chat (with a program): one call each */
  async function journey() {
    const { labPlan, labWrite, labReview, labChat } = await import("@/lib/editor/scene/director");
    s.reply = { title: "x", seconds: 4, shots: [], skillRefs: [ref] };
    await labPlan(project, who, { brief: "إعلان لتطبيق", seconds: 4 });
    s.reply = { code: program, notes: "" };
    await labWrite(project, who, { plan, seconds: 4 });
    s.reply = passing;
    await labReview(project, who, { plan, code: program, sheets: [jpg], round: 1, reviewOnly: true });
    s.reply = { edits: [{ old: "duration: 4", new: "duration: 4.5" }], code: "", notes: "" };
    await labWrite(project, who, { plan, seconds: 4, code: program, errors: "x", patch: true });
    s.reply = { reply: "تم", action: "none", brief: "", code: "", edits: [], options: [], search: "" };
    await labChat(project, who, { message: "وش رايك؟", plan, code: program });
    return s.calls;
  }

  it("the same reply format, the same top-level effort and an hour's cache on every call; only the reply's level changes", async () => {
    const calls = await journey();
    expect(calls).toHaveLength(5);
    for (const c of calls) {
      expect(c.schema).toBe(LAB_SCHEMA);
      expect(c.effort).toBe("medium");
      expect(c.cacheTtl).toBe("1h");
      expect(c.cacheTail).toBe(false);
    }
    expect(calls.map((c) => c.turnEffort)).toEqual(["high", "high", "high", "medium", "medium"]);
    // each request names its branch
    expect(calls.map((c) => /result\.kind = "(\w+)"/.exec(c.parts.map((p) => p.text ?? "").join("\n"))?.[1])).toEqual(["plan", "write", "review", "patch", "chat_edit"]);
  });

  it("the fixed parts come in one order with identical bytes: plan [taste] ⊂ review [taste · skills] ⊂ write [taste · skills · examples]", async () => {
    const [p, w, r] = await journey();
    const ours = (c: Call) => c.parts.filter((x) => x.cache);
    expect(ours(p)).toEqual(ours(w).slice(0, 1));
    expect(ours(r)).toEqual(ours(w).slice(0, 2));
    expect(ours(w)[2].text).toContain("REFERENCE SCENES");
    // they lead the turn, before the step's own text (≤ 3 marks besides the system's)
    for (const c of [p, w, r]) expect(c.parts.slice(0, ours(c).length)).toEqual(ours(c));
    expect(ours(w).length).toBeLessThanOrEqual(3);
  });

  it("the format is every step's own shape as one branch, told apart by a `kind` written first — shapes unchanged", () => {
    const branches = LAB_SCHEMA.properties.result.anyOf;
    expect(branches.map((x) => x.properties.kind)).toEqual(Object.keys(LAB_KINDS).map((k) => ({ type: "string", enum: [k] })));
    for (const [i, [, shape]] of Object.entries(LAB_KINDS).entries()) {
      const x = branches[i];
      expect(x.required).toEqual(["kind", ...shape.required]);
      expect(Object.keys(x.properties)[0]).toBe("kind");
      expect(x.additionalProperties).toBe(false);
      const { kind: _k, ...rest } = x.properties;
      expect(rest).toEqual(shape.properties);
    }
    expect(LAB_SCHEMA.required).toEqual(["result"]);
    expect(COVER_LAB_SCHEMA.properties.result.anyOf.map((x) => x.properties.kind.enum[0])).toEqual(["cover", "cover_review"]);
    // structured outputs: no recursion and no min/max constraints
    expect(JSON.stringify([LAB_SCHEMA, COVER_LAB_SCHEMA])).not.toMatch(/"\$ref"|"(min|max)(imum|Length|Items|Properties)"/);
  });

  it("a reply of another kind is asked once more like an unreadable one (both paid), then given up", async () => {
    const { labWrite } = await import("@/lib/editor/scene/director");
    s.queue = [{ result: { kind: "review", ...passing } }];
    s.reply = { code: program, notes: "كتبت" };
    s.paid = [];
    const ok = await labWrite(project, who, { plan, seconds: 4 });
    expect(s.calls).toHaveLength(2);
    expect(ok).toMatchObject({ code: program, notes: "كتبت" });
    expect(s.paid).toEqual([0.02]);
    s.calls = [];
    s.queue = [{ result: { kind: "plan" } }, { code: program, notes: "" }];
    await expect(labWrite(project, who, { plan, seconds: 4 })).rejects.toThrow("ما قدر حيدرا ماكس يكمل الموشن");
    expect(s.calls).toHaveLength(2);
  });

  it("a continued reply (raw text, no format) completes the same { result } shape — and another kind is not taken", async () => {
    const { labWrite } = await import("@/lib/editor/scene/director");
    const written = `{"result":{"kind":"write","code":"${program.slice(0, 30)}`;
    s.raw = `${program.slice(30)}","notes":"كمّلت"}}`;
    const r = await labWrite(project, who, { plan, seconds: 4, partialRaw: written });
    expect(s.calls[0].rawText).toBe(true);
    expect(s.calls[0].schema).toBe(LAB_SCHEMA);
    expect(r).toMatchObject({ code: program, notes: "كمّلت" });
    s.raw = `${program.slice(30)}","notes":""}}`;
    await expect(labWrite(project, who, { plan, seconds: 4, partialRaw: written.replace('"write"', '"plan"') })).rejects.toThrow("ما قدرت أجمع");
  });

  it("the cover's calls: one format for design and review, the same effort, an hour's cache", async () => {
    const { labCoverWrite, labCoverReview } = await import("@/lib/editor/scene/cover");
    s.reply = { headline: "x", code: program, notes: "" };
    await labCoverWrite(project, who, { plan, frames: [jpg] });
    await labCoverWrite(project, who, { plan, code: program, errors: "x" });
    s.reply = { scores: {}, problems: [], verdict: "", code: "" };
    await labCoverReview(project, who, { plan, code: program, views: [jpg] });
    for (const c of s.calls) {
      expect(c.schema).toBe(COVER_LAB_SCHEMA);
      expect(c.effort).toBe("medium");
      expect(c.cacheTtl).toBe("1h");
    }
    expect(s.calls.map((c) => c.turnEffort)).toEqual(["high", "medium", "high"]);
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
