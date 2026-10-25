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

describe("«🎬 مختبر الموشن» on the server", () => {
  beforeEach(() => {
    s.calls = [];
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
    expect(s.calls[0].text).toContain('<example name="من الغبار إلى الكلمة"');
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
    expect(s.calls[2].maxTokens).toBe(12000);
    await expect(labReview(project, who, { plan: {}, code: EXEMPLARS[1].code, sheets: [], stills: [] })).rejects.toThrow(/صور/);
  });
});
