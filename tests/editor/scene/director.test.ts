import { beforeEach, describe, expect, it, vi } from "vitest";
import { EXEMPLARS } from "@/lib/editor/scene/exemplars";
import { RUBRIC } from "@/lib/editor/scene/skill";

/** a step's whole answer (a cut one, continued by the next request, is not what these tests look at) */
const whole = <T>(r: T): Exclude<T, { partialRaw: string }> => {
  if (r && typeof (r as { partialRaw?: unknown }).partialRaw === "string") throw new Error("cut");
  return r as Exclude<T, { partialRaw: string }>;
};

// The lab's three calls with a made-up model: what حيدرا ماكس is told, and how his answers are checked.
const s = vi.hoisted(() => ({ calls: [] as { system: string; text: string; images: number; maxTokens: number }[], reply: {} as unknown }));
vi.mock("@/lib/film/anthropic", () => ({
  callClaudeJson: async (a: { system: string; turns: { content: { type: string; text?: string }[] }[]; maxTokens: number }) => {
    const parts = a.turns[0].content;
    s.calls.push({ system: a.system, text: parts.filter((p) => p.type === "text").map((p) => p.text).join("\n"), images: parts.filter((p) => p.type === "image64").length, maxTokens: a.maxTokens });
    // every lab call answers {result} in the branch its request names (LAB_SCHEMA)
    const kind = /result\.kind = \\"(\w+)/.exec(JSON.stringify(a.turns))?.[1];
    return { data: { result: { kind, ...(s.reply as object) } }, raw: "", usage: { input_tokens: 1, output_tokens: 1 } };
  },
  claudeCost: () => 0.01,
  claudeWhy: (_e: unknown, say: string) => say,
}));
vi.mock("@/lib/editor/pricing", () => ({ claudeCharged: async (_w: unknown, _m: unknown, _l: string, run: () => Promise<object>) => ({ ...(await run()), coins: 1, model: "claude-opus-5-5" }) }));
vi.mock("@/lib/editor/server", () => ({ stillOpen: () => {} }));
// the person's recent pieces (read from their saved lab conversations): set per test
const recent = vi.hoisted(() => ({ list: [] as unknown[], asked: [] as string[][] }));
vi.mock("@/lib/editor/scene/recent", async (orig) => ({ ...(await orig<typeof import("@/lib/editor/scene/recent")>()), recentPieces: async (u: string, p: string) => (recent.asked.push([u, p]), recent.list) }));

const project = { id: "p1", user_id: "u1", timeline: { width: 1080, height: 1920 } } as never;
const who = { id: "u1", owner: false };
const jpg = "/9j/4AAQSkZJRgABAQAAAQABAAD";

describe("«🎬 مختبر الموشن» on the server", () => {
  beforeEach(() => {
    s.calls = [];
    recent.list = [];
    recent.asked = [];
    process.env.ANTHROPIC_API_KEY = "test";
  });

  it("plans from the brief, the references and the assets, with the owner's skill as the method", async () => {
    s.reply = { title: "إطلاق", idea: "فكرة", hook: "غبار", format: "DUST TO WORD", wow: "x", intensity: 5, seconds: 15, bpm: 120, palette: { bg: "#0b0b10", ink: "#f2f0eb", accent: "#d78d45", second: "#493cca", muted: "#726d68" }, fonts: { head: "alexandria", body: "cairo" }, shots: [{ from: 0, to: 15, what: "w", motion: "m", camera: "c", text: "ابدأ", transition: "t", sound: "s" }], assets: [{ id: "a1", use: "logo" }], music: "dark pulse", say: "جاهز" };
    const { labPlan } = await import("@/lib/editor/scene/director");
    const r = whole(await labPlan(project, who, { brief: "إعلان لتطبيق", seconds: 15, assets: [{ id: "a1", name: "شعار", w: 512, h: 512 }], references: [jpg, jpg] }));
    expect(r.plan.fonts).toEqual({ head: "alexandria", body: "cairo" });
    expect(r.plan.assets).toEqual([{ id: "a1", use: "logo" }]);
    const c = s.calls[0];
    expect(c.images).toBe(2);
    expect(c.text).toContain("1080×1920 (portrait 9:16)");
    expect(c.text).toContain("a1 = «شعار» 512×512");
    expect(c.system).toContain("<motion-skill>");
    expect(c.system).toContain("Motion Video Director");
    expect(c.system).toContain("DUST TO WORD");
    await expect(labPlan(project, who, { brief: "" })).rejects.toThrow(/فكرة/);
  });

  it("writes with the reference scenes, fixes with the error, and flags a program that breaks the rules", async () => {
    const { labWrite } = await import("@/lib/editor/scene/director");
    s.reply = { code: EXEMPLARS[0].code, notes: "كتبت" };
    const ok = whole(await labWrite(project, who, { plan: { seconds: 6 }, seconds: 6 }));
    expect(ok.problems).toEqual([]);
    // the reference scenes come as techniques in words and a placeholder kit snippet — never their whole programs
    expect(s.calls[0].text).toContain("REFERENCE TECHNIQUES");
    expect(s.calls[0].text).toContain("Do NOT reuse their layouts, ideas, palettes");
    for (const e of EXEMPLARS) expect(s.calls[0].text).not.toContain(e.code);
    expect(s.calls[0].text).not.toContain("<example");
    expect(s.calls[0].maxTokens).toBeGreaterThanOrEqual(32000);
    s.reply = { code: "scene({ duration: 3, draw: function (K, t, ctx) { fetch('x'); } });", notes: "" };
    const bad = whole(await labWrite(project, who, { plan: {}, code: "scene({draw(){}})", errors: "At t = 1.20 s the frame threw: x is not defined" }));
    expect(bad.problems.join(" ")).toMatch(/network/);
    expect(s.calls[1].text).toContain("At t = 1.20 s the frame threw");
    expect(s.calls[1].text).not.toContain("<example");
  });

  it("tells it to drop any background fill when خلفية شفافة is asked, and nothing extra when it isn't", async () => {
    const { labWrite } = await import("@/lib/editor/scene/director");
    s.reply = { code: EXEMPLARS[0].code, notes: "" };
    await labWrite(project, who, { plan: { seconds: 6 }, seconds: 6, transparent: true });
    expect(s.calls[0].text).toContain("TRANSPARENT BACKGROUND");
    expect(s.calls[0].text).toContain("never call scene({ background");
    s.calls = [];
    s.reply = { code: EXEMPLARS[0].code, notes: "" };
    await labWrite(project, who, { plan: { seconds: 6 }, seconds: 6 });
    expect(s.calls[0].text).not.toContain("TRANSPARENT BACKGROUND");
  });

  it("reviews what was rendered, scores it, and returns a rewrite only below the bar", async () => {
    const { labReview } = await import("@/lib/editor/scene/director");
    const high = Object.fromEntries(RUBRIC.map((r) => [r.id, 9]));
    s.reply = { scores: high, worst: [], verdict: "ممتاز", code: "" };
    const pass = whole(await labReview(project, who, { plan: {}, code: EXEMPLARS[1].code, sheets: [jpg, jpg], stills: [jpg, jpg, jpg], times: [0.4, 2, 4], round: 1 }));
    expect(pass.review.pass).toBe(true);
    expect(pass.code).toBe("");
    expect(s.calls[0].images).toBe(5);
    expect(s.calls[0].text).toContain("HARSH motion director");
    s.reply = { scores: { ...high, wow: 5 }, worst: [{ t: 1, problem: "مسطح", fix: "عمق" }], verdict: "يحتاج", code: EXEMPLARS[2].code };
    const again = whole(await labReview(project, who, { plan: {}, code: EXEMPLARS[1].code, sheets: [jpg], stills: [], round: 3 }));
    expect(again.review.pass).toBe(false);
    expect(again.code).toBe(EXEMPLARS[2].code.trim());
    expect(s.calls[1].text).toContain("the last");
    s.reply = { scores: { ...high, wow: 5 }, worst: [{ t: 1, problem: "مسطح", fix: "عمق" }], verdict: "يحتاج", code: "" };
    const critique = whole(await labReview(project, who, { plan: {}, code: EXEMPLARS[1].code, sheets: [jpg], reviewOnly: true }));
    expect(critique.review.pass).toBe(false);
    expect(critique.review.worst[0].fix).toBe("عمق");
    expect(critique.code).toBe("");
    expect(s.calls[2].text).toContain("A separate writing step");
    // 32k: a critique cut at max_tokens was asked again whole at low thought (paid twice, thought less)
    expect(s.calls[2].maxTokens).toBe(32000);
    await expect(labReview(project, who, { plan: {}, code: EXEMPLARS[1].code, sheets: [], stills: [] })).rejects.toThrow(/صور/);
  });
});

describe("he decides: the trained material is a library, the request leads, and he does not repeat himself", () => {
  beforeEach(() => {
    s.calls = [];
    recent.list = [];
    recent.asked = [];
    process.env.ANTHROPIC_API_KEY = "test";
  });

  it("the system says first that he decides and the training is a library, and introduces the owner's skill as a reference", async () => {
    const { labPlan } = await import("@/lib/editor/scene/director");
    s.reply = { title: "x", seconds: 8, shots: [] };
    await labPlan(project, who, { brief: "إعلان لمحمصة قهوة مختصة", seconds: 8 });
    const sys = s.calls[0].system;
    const decides = sys.indexOf("YOU DECIDE — THE TRAINING IS A LIBRARY, NOT A TEMPLATE");
    expect(decides).toBeGreaterThan(0);
    // early: before the bar, the formats, the owner's skill and the Higgsfield skills
    for (const later of ["THE OWNER'S BAR", "A LIBRARY OF FORMATS", "<motion-skill>", "THE OWNER'S HIGGSFIELD SKILLS"]) expect(sys.indexOf(later), later).toBeGreaterThan(decides);
    expect(sys).toContain("Consult it as a reference library");
    expect(sys).toContain("never a look, a palette or a structure to reuse");
    expect(sys).toContain("are a LIBRARY, not this piece's look");
    expect(sys).not.toContain("pick from these or invent your own");
  });

  it("the plan starts from an understanding of the request and is shown the person's recent pieces to differ from", async () => {
    const { labPlan } = await import("@/lib/editor/scene/director");
    recent.list = [{ title: "إطلاق تطبيق", idea: "غبار يتجمع إلى كلمة", format: "dust to word", shots: 4, moves: ["needle zoom", "slow push"], palette: "#0b0b10 #d78d45", fonts: "alexandria + cairo", here: true, days: 2 }];
    s.reply = { understanding: { subject: "محمصة صغيرة", audience: "محبي القهوة", feeling: "دفء", surprise: "صوت الحبة" }, variety: "أول مرة ورق فاتح", title: "x", seconds: 8, shots: [] };
    const r = whole(await labPlan(project, who, { brief: "إعلان لمحمصة قهوة مختصة", seconds: 8 }));
    const t = s.calls[0].text;
    expect(recent.asked).toEqual([["u1", "p1"]]);
    expect(t).toContain("YOU decide the piece");
    expect(t).toContain('"understanding" FIRST, before any format, recipe, preset or reference film');
    expect(t).toContain("THIS PERSON'S RECENT PIECES");
    expect(t).toContain("«إطلاق تطبيق» (2 d ago, this project) — idea: غبار يتجمع إلى كلمة · format: dust to word · 4 shots (needle zoom; slow push) · palette #0b0b10 #d78d45 · fonts alexandria + cairo");
    expect(t).toContain("CLEARLY DIFFERENT");
    expect(t).not.toContain("pick a viral format and push it");
    expect(t).not.toContain("one object carrying across shots");
    // the plan keeps what it understood and what is new, so the write and the review read them
    expect(r.plan.understanding).toEqual({ subject: "محمصة صغيرة", audience: "محبي القهوة", feeling: "دفء", surprise: "صوت الحبة" });
    expect(r.plan.variety).toBe("أول مرة ورق فاتح");
    // with no recent pieces: "first piece", and no empty list
    s.calls = [];
    recent.list = [];
    await labPlan(project, who, { brief: "إعلان لمحمصة قهوة مختصة", seconds: 8 });
    expect(s.calls[0].text).toContain('"first piece"');
    expect(s.calls[0].text).not.toContain("THIS PERSON'S RECENT PIECES");
  });

  it("the plan's shape writes the understanding first and a variety field", async () => {
    const { PLAN_SCHEMA } = await import("@/lib/editor/scene/schemas");
    expect(Object.keys(PLAN_SCHEMA.properties).slice(0, 2)).toEqual(["understanding", "variety"]);
    expect(PLAN_SCHEMA.required.slice(0, 2)).toEqual(["understanding", "variety"]);
    expect(PLAN_SCHEMA.properties.understanding.required).toEqual(["subject", "audience", "feeling", "surprise"]);
  });

  it("the first write builds the plan's own idea and sees the recent pieces; a fix does not look them up", async () => {
    const { labWrite } = await import("@/lib/editor/scene/director");
    recent.list = [{ title: "قديم", idea: "شكل واحد يتحول", format: "", shots: 3, moves: [], palette: "", fonts: "", here: false, days: 9 }];
    s.reply = { code: EXEMPLARS[0].code, notes: "" };
    await labWrite(project, who, { plan: { seconds: 6, understanding: { subject: "s", audience: "a", feeling: "f", surprise: "x" }, variety: "جديد" }, seconds: 6 });
    expect(s.calls[0].text).toContain("Build THIS plan's own idea");
    expect(s.calls[0].text).toContain('"variety": "جديد"');
    expect(s.calls[0].text).toContain("«قديم» (9 d ago)");
    await labWrite(project, who, { plan: { seconds: 6 }, code: "scene({draw(){}})", errors: "x" });
    expect(recent.asked).toHaveLength(1);
    expect(s.calls[1].text).not.toContain("RECENT PIECES");
  });

  it("the review scores «fresh» against the plan's understanding and variety", async () => {
    const { labReview } = await import("@/lib/editor/scene/director");
    s.reply = { scores: Object.fromEntries(RUBRIC.map((r) => [r.id, 9])), worst: [], verdict: "", code: "" };
    await labReview(project, who, { plan: { variety: "ورق فاتح بدل الظلام" }, code: EXEMPLARS[1].code, sheets: [jpg], reviewOnly: true });
    const t = s.calls[0].text;
    expect(t).toContain("fresh: Fresh & specific to THIS request");
    expect(t).toContain('Score "fresh" against THE PLAN\'s "understanding" and "variety"');
    expect(t).toContain("ورق فاتح بدل الظلام");
    expect(t).toContain("their looks are not required of this piece");
  });
});
