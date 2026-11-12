import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { apply, applyAll } from "@/lib/editor/commands";
import { clipEnd, clipLength, emptyTimeline, flatten, readTimeline, sourceTime, speedAt, timelineTime, type Clip, type Timeline } from "@/lib/editor/model";
import { cutTimed, RAMP_PRESET_IDS, RAMP_PRESETS, rampArea, rampCum, rampInv, rampSamples, rampSlice, readRamp, type Ramp } from "@/lib/editor/ramp";
import { COMMANDS_GUIDE } from "@/lib/editor/assistant-commands";
import { stretch } from "@/components/jawad/editor/stretch";
import { lib, main, video } from "./helpers";

const assets = lib(video("v", 60_000));
/** a 10 s piece of source (2 s → 12 s) on the timeline at 1 s, with a curve */
const clipWith = (ramp: Ramp | null): Clip => {
  const t = apply(emptyTimeline("9:16"), { type: "add_clip", assetId: "v" }, assets).timeline;
  const c = main(t).clips[0];
  return { ...c, start: 1000, in: 2000, out: 12_000, speed: ramp ? rampArea(ramp) : 1, ...(ramp ? { ramp } : {}) };
};
const timelineOf = (ramp: Ramp | string): Timeline => {
  let t = apply(emptyTimeline("9:16"), { type: "add_clip", assetId: "v" }, assets).timeline;
  const id = main(t).clips[0].id;
  t = apply(t, { type: "trim_clip", clipId: id, edge: "end", to: 10_000 }, assets).timeline;
  return apply(t, { type: "update_clip", clipId: id, patch: { ramp: ramp as Ramp } }, assets).timeline;
};

describe("منحنى السرعة: the math", () => {
  it("the area is the average speed, and cum/inv are each other's inverse", () => {
    for (const id of RAMP_PRESET_IDS) {
      const r = RAMP_PRESETS[id].points;
      expect(rampCum(r, 1)).toBeCloseTo(rampArea(r), 9);
      for (let u = 0; u <= 1.0001; u += 0.05) expect(rampInv(r, rampCum(r, u))).toBeCloseTo(Math.min(1, u), 6);
    }
    expect(rampArea([{ u: 0, s: 0.5 }, { u: 1, s: 2.5 }])).toBeCloseTo(1.5, 9);
  });

  it("source ↔ timeline both ways, ends exactly on the clip's in and out, monotonic", () => {
    for (const id of RAMP_PRESET_IDS) {
      const c = clipWith(RAMP_PRESETS[id].points);
      expect(sourceTime(c, c.start)).toBeCloseTo(c.in, 6);
      expect(sourceTime(c, c.start + (c.out - c.in) / c.speed)).toBeCloseTo(c.out, 6);
      let last = -Infinity;
      for (let ms = c.start; ms <= clipEnd(c); ms += 37) {
        const src = sourceTime(c, ms);
        expect(src).toBeGreaterThan(last);
        last = src;
        // and back: the same timeline moment
        expect(timelineTime(c, src)).toBeCloseTo(ms, 4);
      }
      for (let src = c.in; src <= c.out; src += 113) expect(sourceTime(c, timelineTime(c, src))).toBeCloseTo(src, 4);
    }
  });

  it("the clip's length is (out − in) / average speed", () => {
    const r = RAMP_PRESETS.slowFast.points; // 0.5 → 2.5: average 1.5
    const c = clipWith(r);
    expect(clipLength(c)).toBe(Math.round(10_000 / 1.5));
    // slow at the start, fast at the end: the first half of the clip plays less than half of the source
    const mid = c.start + clipLength(c) / 2;
    expect(sourceTime(c, mid) - c.in).toBeLessThan(5000);
    expect(speedAt(c, c.start)).toBeCloseTo(0.5, 6);
    expect(speedAt(c, clipEnd(c) - 0.001)).toBeCloseTo(2.5, 2);
  });

  it("without a curve nothing changes (the plain speed formulas)", () => {
    const c = { ...clipWith(null), speed: 2 };
    expect(sourceTime(c, 3000)).toBe(2000 + 2000 * 2);
    expect(timelineTime(c, 6000)).toBe(1000 + 4000 / 2);
    expect(speedAt(c, 3000)).toBe(2);
  });

  it("a slice keeps the same playing: the cut sides together play exactly like the whole", () => {
    const c = clipWith(RAMP_PRESETS.burst.points);
    const at = c.start + 2345;
    const left = { ...c, ...cutTimed(c, c.start, at) };
    const right = { ...c, start: at, ...cutTimed(c, at, clipEnd(c)) };
    expect(Math.abs(clipLength(left) - 2345)).toBeLessThanOrEqual(1);
    expect(Math.abs(clipEnd(right) - clipEnd(c))).toBeLessThanOrEqual(1);
    for (const ms of [c.start + 100, c.start + 2000, at + 50, at + 3000, clipEnd(c) - 10]) {
      const side = ms < at ? left : right;
      expect(Math.abs(sourceTime(side as Clip, ms) - sourceTime(c, ms))).toBeLessThan(2);
    }
    // a slice inside a flat stretch is a plain speed
    expect(rampSlice([{ u: 0, s: 1 }, { u: 1, s: 1 }], 0.2, 0.6).every((p) => p.s === 1)).toBe(true);
  });

  it("reads a curve safely (preset ids, sorting, missing ends, ranges, too many points)", () => {
    expect(readRamp("velocity")).toEqual(RAMP_PRESETS.velocity.points);
    expect(readRamp([{ u: 0.5, s: 2 }])).toEqual([{ u: 0, s: 2 }, { u: 0.5, s: 2 }, { u: 1, s: 2 }]);
    expect(readRamp([{ u: 1, s: 99 }, { u: 0, s: -3 }])).toEqual([{ u: 0, s: 0.1 }, { u: 1, s: 10 }]);
    expect(readRamp(Array.from({ length: 40 }, (_, i) => ({ u: i / 39, s: 1 + (i % 3) })))!.length).toBe(12);
    expect(readRamp("nope")).toBeNull();
    expect(readRamp([])).toBeNull();
  });
});

describe("منحنى السرعة: the timeline commands", () => {
  it("a preset sets the curve and the clip's length follows its average; a speed takes it off", () => {
    const t = timelineOf("slowFast");
    const c = main(t).clips[0];
    expect(c.ramp).toEqual(RAMP_PRESETS.slowFast.points);
    expect(c.speed).toBeCloseTo(1.5, 9);
    expect(clipLength(c)).toBe(Math.round(10_000 / 1.5));
    const r = apply(t, { type: "update_clip", clipId: c.id, patch: { speed: 2 } }, assets);
    expect(main(r.timeline).clips[0].ramp).toBeUndefined();
    expect(main(r.timeline).clips[0].speed).toBe(2);
    const off = apply(t, { type: "update_clip", clipId: c.id, patch: { ramp: null } }, assets);
    expect(off.label).toBe("شلت منحنى السرعة");
    expect(main(off.timeline).clips[0].ramp).toBeUndefined();
  });

  it("labels the change by the curve's name, refuses pictures and texts", () => {
    const t = timelineOf("burst");
    const c = main(t).clips[0];
    const r = apply(t, { type: "update_clip", clipId: c.id, patch: { ramp: "fastSlow" } }, assets);
    expect(r.label).toBe("منحنى السرعة: سريع ثم بطيء");
    const tx = apply(t, { type: "add_text", at: 0 }, assets).timeline;
    const text = tx.tracks.find((x) => x.kind === "text")!.clips[0];
    expect(() => apply(tx, { type: "update_clip", clipId: text.id, patch: { ramp: "burst" } }, assets)).toThrow("منحنى السرعة");
  });

  it("a split keeps each side's part of the curve: the cut plays the same", () => {
    const t = timelineOf("velocity");
    const c = main(t).clips[0];
    const at = c.start + 1500;
    const r = apply(t, { type: "split", at, clipIds: [c.id] }, assets).timeline;
    const [a, b] = main(r).clips;
    expect(Math.abs(clipEnd(a) - at)).toBeLessThanOrEqual(1);
    expect(b.start).toBe(at);
    expect(Math.abs(clipEnd(b) - clipEnd(c))).toBeLessThanOrEqual(2);
    for (const ms of [c.start + 300, at - 10, at + 10, clipEnd(c) - 50]) expect(Math.abs(sourceTime(ms < at ? a : b, ms) - sourceTime(c, ms))).toBeLessThan(3);
  });

  it("trimming moves the edge along the curve (what stays plays as before)", () => {
    const t = timelineOf("slowFast");
    const c = main(t).clips[0];
    const to = c.start + 3000;
    const r = apply(t, { type: "trim_clip", clipId: c.id, edge: "end", to }, assets).timeline;
    const d = main(r).clips[0];
    expect(Math.abs(clipEnd(d) - to)).toBeLessThanOrEqual(1);
    expect(Math.abs(sourceTime(d, c.start + 1000) - sourceTime(c, c.start + 1000))).toBeLessThan(2);
  });

  it("is kept by a save (read back), and a nest shows its part with its curve", () => {
    const t = timelineOf("slowMid");
    const back = readTimeline(JSON.parse(JSON.stringify(t)), new Set(["v"]));
    expect(main(back).clips[0].ramp).toEqual(main(t).clips[0].ramp);
    expect(main(back).clips[0].speed).toBeCloseTo(main(t).clips[0].speed, 9);
    // a flat curve in a document is just its speed
    const flat = readTimeline({ ...t, tracks: [{ ...main(t), clips: [{ ...main(t).clips[0], ramp: [{ u: 0, s: 2 }, { u: 1, s: 2 }] }] }] }, new Set(["v"]));
    expect(main(flat).clips[0].ramp).toBeUndefined();
    expect(main(flat).clips[0].speed).toBe(2);
    const id = main(t).clips[0].id;
    const nested = applyAll(t, [{ type: "nest", clipIds: [id] }], assets).timeline;
    const flat2 = flatten(nested);
    const inner = flat2.tracks.flatMap((x) => x.clips).find((x) => x.assetId === "v")!;
    expect(inner.ramp).toEqual(main(t).clips[0].ramp);
  });

  it("حيدرا ماكس knows the curve: in his command list with every preset", () => {
    expect(COMMANDS_GUIDE).toContain("منحنى السرعة");
    for (const id of RAMP_PRESET_IDS) expect(COMMANDS_GUIDE).toContain(`"${id}"`);
    expect(readFileSync("src/lib/editor/assistant-core.ts", "utf8")).toContain("...(c.ramp ? { ramp: c.ramp } : {})");
  });
});

describe("منحنى السرعة: the sound follows the curve", () => {
  it("the stretcher reads the source along the map (its length and its pitch kept)", () => {
    const SR = 48_000;
    const src = new Float32Array(SR * 4);
    for (let i = 0; i < src.length; i++) src[i] = 0.4 * Math.sin((2 * Math.PI * 220 * i) / SR);
    const c = clipWith(RAMP_PRESETS.slowFast.points);
    const map = rampSamples(c, c.start, SR)!;
    // at the start it reads at ×0.5, at the end at ×2.5
    expect(map(SR / 10) / (SR / 10)).toBeCloseTo(0.5, 1);
    const outLen = Math.round(SR * 1.5);
    const [out] = stretch([src], 0, c.speed, outLen, SR, (o) => map(o) * 0.3);
    expect(out.length).toBe(outLen);
    let z = 0;
    for (let i = Math.floor(SR * 0.2) + 1; i < Math.floor(SR * 1.2); i++) if ((out[i - 1] < 0) !== (out[i] < 0)) z++;
    expect(Math.abs(z / 1.0 - 440)).toBeLessThan(15);
  });

  it("the preview and the export use the curve", () => {
    const player = readFileSync("src/components/jawad/editor/player.ts", "utf8");
    expect(player).toContain("speedAt(clip, ms)");
    expect(player).toContain("rampSamples(c, c.start, buf.sampleRate)");
    const exp = readFileSync("src/components/jawad/editor/export.ts", "utf8");
    expect(exp).toContain("const map = rampSamples(c, s, sr);");
    expect(exp).toContain("if (retimed(c))");
  });
});
