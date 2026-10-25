import { describe, expect, it } from "vitest";
import { applyAll } from "@/lib/editor/commands";
import { emptyTimeline, transformAt, type AssetInfo } from "@/lib/editor/model";
import { lintMotion, motionCommands, motionPlan, readStoryboard, type Storyboard } from "@/lib/editor/motion-build";

/** A piece the way حيدرا ماكس writes it now: he composes the background of every beat and draws every arrival himself. */
const composed: Storyboard = {
  palette: "night",
  beats: [
    {
      kind: "title",
      title: "ثلاث دقائق تكفي",
      text: "وتفهم الفكرة كلها",
      bg: { fill: { from: "#0a0a12", to: "#1d1140", deg: 120 }, layers: [{ t: "blob", x: 0.3, y: 0.85, w: 1.4, h: 1.1, c: "accent", o: 0.5, r: 0, blur: 0.12, sw: 0.006 }], grain: 0.06, vignette: 0.35, scan: 0 },
      enter: [
        { delay: 0, ms: 320, from: { dx: 0.06, dy: 0, s: 0.94, r: -3, o: 0 }, over: 1.06, out: { ms: 160, dx: 0, dy: -0.03, s: 1, o: 0 } },
        { delay: 70, ms: 260, from: { dx: 0, dy: 0.04, s: 1, r: 0, o: 0 }, over: 1 },
      ],
    },
    {
      kind: "stat",
      value: "70%",
      label: "من الناس ما يكملون",
      bg: { fill: "#07120b", layers: [{ t: "streak", x: 0.5, y: 0.5, w: 2, h: 0.9, c: "second", o: 0.25, r: -12, blur: 0.02, sw: 0.004 }], grain: 0, vignette: 0.2, scan: 0.1 },
      enter: [{ delay: 0, ms: 300, from: { dx: 0, dy: 0, s: 1.6, r: 0, o: 0 }, over: 1 }],
    },
  ],
};

describe("«موشن جرافيكس»: the look حيدرا ماكس composes himself", () => {
  it("reads his background and his arrivals, and clamps anything out of range", () => {
    const sb = readStoryboard({
      beats: [
        {
          kind: "title",
          title: "عنوان",
          bg: { fill: { from: "#111111", to: "#222222", deg: 999 }, layers: [{ t: "blob", x: 0.5, y: 0.5, w: 9, h: 1, c: "accent", o: 5, r: 400, blur: 9, sw: 9 }, { t: "nope", x: 0.5, y: 0.5, w: 1, h: 1, c: "accent" }, { t: "ring", x: 0.5, y: 0.5, w: 1, h: 1, c: "drop table" }], grain: 9, vignette: -4, scan: 0.1 },
          enter: [{ delay: 99_999, ms: 99_999, from: { dx: 9, dy: -9, s: 99, r: 999, o: 9 }, over: 9, out: { ms: 1, dx: 0, dy: 0, s: 1, o: 0 } }],
        },
      ],
    });
    const b = sb!.beats[0];
    expect(b.bg!.layers).toHaveLength(1); // the unknown kind and the bad colour are dropped
    expect(b.bg!.layers[0]).toMatchObject({ w: 2.5, o: 1, r: 180, blur: 0.3, sw: 0.08 });
    expect(b.bg!.grain).toBe(0.25);
    expect(b.bg!.vignette).toBe(0);
    expect(b.enter![0]).toMatchObject({ delay: 4000, ms: 1200, over: 1.3 });
    expect(b.enter![0].from).toMatchObject({ dx: 1, dy: -1, s: 3, r: 90, o: 1 });
    expect(b.enter![0].out!.ms).toBe(80);
  });

  it("draws his background instead of any preset theme, and no old decoration is added", () => {
    const tl = emptyTimeline("9:16");
    const plan = motionPlan(composed, tl.width, tl.height);
    // one picture per beat: the background he composed. No theme art, no drawn scene.
    expect(plan.art).toHaveLength(2);
    expect(plan.art.map((a) => a.key)).toEqual(["bg-0", "bg-1"]);
    expect(plan.look.theme).toBe("none");
    expect(plan.look.scene).toBeUndefined();
    const [first, second] = plan.art.map((a) => a.svg);
    expect(first).toContain("linearGradient");
    expect(first).toContain("feGaussianBlur");
    expect(second).toContain("bgscan");
    expect(first).not.toBe(second);
    for (const svg of [first, second]) expect(svg).not.toMatch(/NaN|undefined/);
  });

  it("runs every arrival as motion points, with no named entrance left on the text", () => {
    const tl = emptyTimeline("9:16");
    const plan = motionPlan(composed, tl.width, tl.height);
    const infos = new Map<string, AssetInfo>();
    const ids = new Map<string, string>();
    for (const a of plan.art) {
      const id = `asset-${a.key}`;
      ids.set(a.key, id);
      infos.set(id, { id, kind: "image", durationMs: null, width: a.w, height: a.h, hasAudio: false });
    }
    const { commands } = motionCommands(composed, tl.width, tl.height, 0, ids);
    const out = applyAll(tl, commands, infos).timeline;
    expect(lintMotion(out)).toEqual([]);
    const texts = out.tracks.filter((t) => t.kind === "text").flatMap((t) => t.clips);
    expect(texts.length).toBeGreaterThan(2);
    for (const c of texts) {
      expect(c.anim).toBeNull();
      expect(c.keys.length).toBeGreaterThanOrEqual(2);
      // the points rise in time, and the text is in its place, whole, when the entrance is over
      for (let i = 1; i < c.keys.length; i++) expect(c.keys[i].t).toBeGreaterThan(c.keys[i - 1].t);
      expect(c.keys[0].opacity).toBe(0);
    }
    // the headline: it comes from the right, overshoots a touch, settles in its place, then leaves upwards
    const head = texts[0];
    expect(head.keys[0].x).toBeGreaterThan(head.transform.x);
    expect(Math.max(...head.keys.map((k) => k.scale))).toBeCloseTo(1.06, 2);
    expect(head.keys[head.keys.length - 1].opacity).toBe(0);
    const settled = transformAt(head, head.start + 400);
    expect(settled.scale).toBeCloseTo(1, 1);
    expect(settled.opacity).toBeCloseTo(1, 1);
    // the big number lands from big, from nothing, with no bounce
    const value = texts.find((c) => c.text?.body.includes("70"))!;
    expect(value.keys[0].scale).toBe(1.6);
    expect(Math.max(...value.keys.map((k) => k.scale))).toBe(1.6);
  });

  it("still gives the engine's own look to anyone who asks for a named skill", () => {
    const tl = emptyTimeline("9:16");
    const named = motionPlan({ ...composed, style: "explainer", beats: composed.beats.map(({ bg: _bg, enter: _enter, ...b }) => b) }, tl.width, tl.height);
    expect(named.look.theme).not.toBe("none");
    expect(named.art.map((a) => a.key)).toContain("art-0");
  });
});
