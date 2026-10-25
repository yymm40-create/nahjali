import vm from "node:vm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SCENE_KIT_JS } from "@/lib/editor/scene/kit";
import { SCENE_RUNTIME_JS } from "@/lib/editor/scene/runtime";
import { FOOTAGE_KIT_API, FOOTAGE_SKILL, footageLines, footageText, readFootage } from "@/lib/editor/scene/footage";
import { readPlan } from "@/lib/editor/scene/contract";

// «مختبر الموشن» on the person's own video: what the browser sends is bounded, the face stays in every crop, and حيدرا ماكس is
// told the craft, the words with their times and the kit's calls.

type Box = { x: number; y: number; w: number; h: number };
type Footage = {
  frame: { width: number; height: number } | null;
  t: number;
  faceAt: (t?: number) => Box;
  wordAt: (t?: number) => { w: string } | null;
  draw: (ctx: unknown, x: number, y: number, w: number, h: number, o?: Record<string, unknown>) => Box;
  full: (ctx: unknown, o?: Record<string, unknown>) => Box;
};
function kit() {
  const context: Record<string, unknown> = { module: { exports: {} }, Math, console };
  vm.createContext(context);
  vm.runInContext(SCENE_KIT_JS, context, { timeout: 2000 });
  const K = (context.module as { exports: Record<string, unknown> }).exports as Record<string, unknown> & { useFootage: (m: unknown) => Footage | null };
  K.W = 1080;
  K.H = 1920;
  return K;
}
function recorder() {
  const drawn: number[][] = [];
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (t, k: string) => (k in t ? t[k] : k === "drawImage" ? (...a: unknown[]) => drawn.push(a.slice(1) as number[]) : () => {}),
    set: (t, k: string, v) => ((t[k] = v), true),
  });
  return { ctx, drawn };
}

describe("K.footage — the person's video inside the scene", () => {
  it("fills a portrait frame from a landscape video with the face kept in it, and says where the face landed", () => {
    const K = kit();
    const F = K.useFootage({ w: 1280, h: 720, duration: 10, face: [{ t: 0, x: 0.8, y: 0.3, w: 0.12, h: 0.3 }] })!;
    F.frame = { width: 1280, height: 720 };
    const { ctx, drawn } = recorder();
    const face = F.full(ctx);
    const [sx, sy, sw, sh, dx, dy, dw, dh] = drawn[0];
    expect([dx, dy, dw, dh]).toEqual([0, 0, 1080, 1920]);
    expect(sw / sh).toBeCloseTo(1080 / 1920, 3);
    expect(sx).toBeGreaterThanOrEqual(0);
    expect(sx + sw).toBeLessThanOrEqual(1280 + 1e-6);
    expect(sy).toBe(0);
    // the face (x 0.8 of the picture) is inside the crop, so inside the frame
    expect(face.x).toBeGreaterThanOrEqual(0);
    expect(face.x + face.w).toBeLessThanOrEqual(1080 + 1e-6);
    // a punch-in crops tighter around the same face
    drawn.length = 0;
    const tight = F.full(ctx, { zoom: 1.4 });
    expect(drawn[0][2]).toBeLessThan(sw);
    expect(tight.w).toBeGreaterThan(face.w);
    expect(tight.x).toBeGreaterThanOrEqual(0);
    expect(tight.x + tight.w).toBeLessThanOrEqual(1080 + 1e-6);
  });

  it("follows the face between the measured moments, knows the word being said, and draws a card, a circle and contain", () => {
    const K = kit();
    const F = K.useFootage({ w: 1920, h: 1080, duration: 6, words: [{ w: "هلا", s: 1, e: 1.4 }], face: [{ t: 0, x: 0.3, y: 0.4, w: 0.1, h: 0.2 }, { t: 2, x: 0.7, y: 0.4, w: 0.1, h: 0.2 }] })!;
    expect(F.faceAt(0).x).toBeCloseTo(0.3);
    expect(F.faceAt(1).x).toBeCloseTo(0.5);
    expect(F.faceAt(5).x).toBeCloseTo(0.7);
    expect(F.wordAt(1.2)?.w).toBe("هلا");
    expect(F.wordAt(3)).toBeNull();
    const { ctx, drawn } = recorder();
    // no frame yet: a placeholder, never a throw
    expect(() => F.draw(ctx, 100, 100, 600, 340, { radius: 30, shadow: true })).not.toThrow();
    expect(drawn).toHaveLength(0);
    F.frame = { width: 1920, height: 1080 };
    F.draw(ctx, 100, 100, 600, 600, { circle: true });
    F.draw(ctx, 0, 0, 1080, 1920, { fit: "contain" });
    const contain = drawn[1];
    expect(contain.slice(0, 4)).toEqual([0, 0, 1920, 1080]);
    expect(contain[6]).toBeCloseTo(1080);
  });

  it("is off unless the piece has a video, and the page hands in a frame of now with every draw", () => {
    const K = kit();
    expect(K.footage).toBeNull();
    expect(K.useFootage(null)).toBeNull();
    expect(SCENE_RUNTIME_JS).toContain("K.useFootage(m.footage || null)");
    expect(SCENE_RUNTIME_JS).toContain("K.footage.frame = m.video");
  });
});

describe("what the browser says about the video", () => {
  it("is bounded: a too-short video is no video, words and faces are cleaned and sorted, the length has no ceiling", () => {
    expect(readFootage(null)).toBeNull();
    expect(readFootage({ seconds: 1 })).toBeNull();
    const f = readFootage({ name: "  كلامي  ", seconds: 900, w: 1280, h: 720, words: [{ w: "ثانية", s: 2, e: 2.4 }, { w: "أول", s: 0.5, e: 0.9 }, { w: "", s: 1 }, { w: "بعيد", s: -3 }], face: [{ t: 3, x: 2, y: 0.4, w: 0.1, h: 0.2 }, { t: 1, x: 0.5, y: 0.4, w: 0.1, h: 0.2 }] })!;
    expect(f.name).toBe("كلامي");
    expect(f.seconds).toBe(900);
    expect(f.words.map((w) => w.w)).toEqual(["أول", "ثانية"]);
    expect(f.face.map((x) => x.t)).toEqual([1, 3]);
    expect(f.face[1].x).toBe(1);
  });

  it("groups the words into spoken lines at pauses and sentence ends, with their times", () => {
    const lines = footageLines([{ w: "هذا", s: 0, e: 0.3 }, { w: "الذكاء", s: 0.35, e: 0.8 }, { w: "يقدر.", s: 0.85, e: 1.2 }, { w: "شوف", s: 2.5, e: 2.8 }]);
    expect(lines).toEqual([{ text: "هذا الذكاء يقدر.", from: 0, to: 1.2 }, { text: "شوف", from: 2.5, to: 2.8 }]);
  });

  it("a plan on the video lasts exactly its length and keeps each shot's frame (unknown frames dropped)", () => {
    const p = readPlan({ seconds: 6, shots: [{ from: 0, to: 4, what: "x", frame: "card" }, { from: 4, to: 9.4, what: "y", frame: "spin" }] }, 15, [], 9.4);
    expect(p.seconds).toBe(9.4);
    expect(p.shots.map((s) => s.frame)).toEqual(["card", ""]);
    expect(readPlan({ seconds: 6 }, 15).seconds).toBe(6);
  });
});

const s = vi.hoisted(() => ({ calls: [] as { text: string; images: number }[], reply: {} as unknown }));
vi.mock("@/lib/film/anthropic", () => ({
  callClaudeJson: async (a: { turns: { content: { type: string; text?: string }[] }[] }) => {
    const parts = a.turns[0].content;
    s.calls.push({ text: parts.filter((p) => p.type === "text").map((p) => p.text).join("\n"), images: parts.filter((p) => p.type === "image64").length });
    return { data: s.reply, raw: "", usage: { input_tokens: 1, output_tokens: 1 } };
  },
  claudeCost: () => 0.01,
  claudeWhy: (_e: unknown, say: string) => say,
}));
vi.mock("@/lib/editor/pricing", () => ({ claudeCharged: async (_w: unknown, _m: unknown, _l: string, run: () => Promise<object>) => ({ ...(await run()), coins: 1, model: "claude-opus-5-5" }) }));
vi.mock("@/lib/editor/server", () => ({ stillOpen: () => {} }));

describe("حيدرا ماكس on the person's video", () => {
  const project = { id: "p1", user_id: "u1", timeline: { width: 1080, height: 1920 } } as never;
  const who = { id: "u1", owner: false };
  const footage = { name: "كلامي", seconds: 12.5, w: 1280, h: 720, words: [{ w: "الأدوات", s: 1.2, e: 1.8 }, { w: "كلها", s: 1.9, e: 2.3 }], face: [{ t: 0, x: 0.5, y: 0.3, w: 0.15, h: 0.35 }] };
  beforeEach(() => {
    s.calls = [];
    process.env.ANTHROPIC_API_KEY = "test";
  });

  it("plans with no brief, on the video's length, with the craft, the timed words and its frames — and no narration", async () => {
    s.reply = { title: "مونتاج", seconds: 30, narration: [{ text: "لا", from: 0, to: 1 }], shots: [{ from: 0, to: 12.5, what: "w", motion: "", camera: "", text: "", transition: "", sound: "", frame: "full" }] };
    const { labPlan } = await import("@/lib/editor/scene/director");
    const got = await labPlan(project, who, { brief: "", footage, footage_frames: ["/9j/4AAQ", "/9j/4AAQ"], voice: "own" });
    if (!("plan" in got)) throw new Error("cut");
    const r = got;
    expect(r.plan.seconds).toBe(12.5);
    expect(r.plan.narration).toEqual([]);
    expect(r.plan.shots[0].frame).toBe("full");
    const c = s.calls[0];
    expect(c.images).toBe(2);
    expect(c.text).toContain(FOOTAGE_SKILL.slice(0, 60));
    expect(c.text).toContain("الأدوات@1.20");
    expect(c.text).toContain("(exactly the video's length)");
    expect(c.text).not.toContain("THE PERSON WILL RECORD THEIR OWN VOICE");
    expect(c.text).toContain("THE VIDEO'S OWN SOUND");
  });

  it("writes and reviews with the kit's K.footage calls and the face rules", async () => {
    const { labWrite, labReview } = await import("@/lib/editor/scene/director");
    s.reply = { code: "scene({ duration: 12.5, draw: function (K, t, ctx) { K.footage.full(ctx); } });", notes: "" };
    await labWrite(project, who, { plan: { seconds: 12.5 }, footage });
    expect(s.calls[0].text).toContain(FOOTAGE_KIT_API.slice(0, 50));
    s.reply = { scores: {}, worst: [], verdict: "", code: "" };
    await labReview(project, who, { plan: {}, code: "scene({ duration: 12.5, draw: function (K, t, ctx) {} });", sheets: ["/9j/4AAQ"], footage });
    expect(s.calls[1].text).toContain("their whole face always inside what is shown");
    expect(footageText(readFootage(footage)!)).toContain("1.20–2.30 s: «الأدوات كلها»");
  });
});

describe("the owner's motion grammar in the kit", () => {
  it("snaps discrete changes to frames, zooms in log space with the needle's peak on the cut, and keys without a dead stop", () => {
    const K = kit() as unknown as Record<string, unknown> & { fps: number; TQ: (t: number) => number; zoom: (...a: number[]) => number; needle: (...a: number[]) => number; kf: (t: number, k: unknown[]) => number; E: Record<string, (p: number) => number>; typedN: (times: number[], t: number) => number; cadence: (n: number, a: number, b: number) => number[] };
    K.fps = 30;
    expect(K.TQ(1.016)).toBeCloseTo(1, 6);
    expect(K.TQ(1.02)).toBeCloseTo(1 + 1 / 30, 6);
    // log space: the halfway point of 1 → 4 (linear ease) is 2, not 2.5
    expect(K.zoom(0.5, 0, 1, 1, 4, K.E.lin as never)).toBeCloseTo(2, 6);
    const step = (t: number) => K.needle(t + 1 / 30, 2, 1, 3) - K.needle(t, 2, 1, 3);
    const steps = Array.from({ length: 12 }, (_, i) => 1.8 + i / 30).map((t) => [t, step(t)]);
    const biggest = steps.reduce((a, b) => (b[1] > a[1] ? b : a));
    expect(Math.abs(biggest[0] - (2 - 1 / 30))).toBeLessThan(1 / 30 + 1e-6);
    expect(K.kf(1, [[0, 0], [2, 10]])).toBeGreaterThan(0);
    const times = K.cadence(5, 0, 1);
    expect(times).toHaveLength(5);
    expect(times[4]).toBeCloseTo(1, 6);
    expect(K.typedN(times, 1)).toBe(5);
  });

  it("never lets a motion-blur sub-frame straddle a listed hard cut, and the grain default follows the owner's taste", () => {
    expect(SCENE_RUNTIME_JS).toContain("var cuts = Array.isArray(def.cuts) ? def.cuts : []");
    expect(SCENE_KIT_JS).toContain("o.amount === undefined ? 0.02 : o.amount");
    expect(FOOTAGE_SKILL).toContain("NEVER draw another company's logo");
    expect(FOOTAGE_SKILL).toContain("never tilted into 3D");
    expect(FOOTAGE_SKILL).toContain("short clean end card");
    expect(FOOTAGE_SKILL).not.toContain("labels in the corners");
  });
});

describe("«✂️ الكلام ورا الراس» — the person alone over the words", () => {
  it("draws only the cut-out person with the plain draw's crop (scaled to its own size), and nothing before it arrives", () => {
    const K = kit();
    const F = K.useFootage({ w: 1280, h: 720, duration: 5, person: true, face: [{ t: 0, x: 0.5, y: 0.3, w: 0.1, h: 0.2 }] })! as Footage & { hasPerson: boolean; personFrame: { width: number; height: number } | null };
    expect(F.hasPerson).toBe(true);
    const { ctx, drawn } = recorder();
    F.frame = { width: 1280, height: 720 };
    F.draw(ctx, 0, 0, 1080, 1920, { person: true });
    expect(drawn).toHaveLength(0);
    F.personFrame = { width: 640, height: 360 };
    F.draw(ctx, 0, 0, 1080, 1920);
    F.draw(ctx, 0, 0, 1080, 1920, { person: true });
    const [plain, person] = drawn;
    expect(person.slice(0, 4).map((v) => v * 2)).toEqual(plain.slice(0, 4));
    expect(person.slice(4)).toEqual(plain.slice(4));
    expect(SCENE_RUNTIME_JS).toContain("K.footage.personFrame = m.person");
    expect(footageText(readFootage({ seconds: 5, person: true })!)).toContain("THE PERSON IS CUT OUT TOO");
    expect(footageText(readFootage({ seconds: 5 })!)).not.toContain("THE PERSON IS CUT OUT TOO");
  });
});
