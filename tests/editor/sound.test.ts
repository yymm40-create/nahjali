import { describe, expect, it } from "vitest";
import { apply, applyAll } from "@/lib/editor/commands";
import { emptyTimeline, hasSoundFx, readSound } from "@/lib/editor/model";
import { denoise, shiftPitch } from "@/components/jawad/editor/voice";
import { image, lib, main, video } from "./helpers";

const assets = lib(video("v", 6000), image("p"));
const R = 48000;

/** Rises through zero per second: the main frequency of a plain tone. */
const freq = (x: Float32Array, from = 4800, to = x.length - 4800) => {
  let n = 0;
  for (let i = from + 1; i < to; i++) if (x[i - 1] < 0 && x[i] >= 0) n++;
  return (n / (to - from)) * R;
};
const tone = (hz: number, len = R) => new Float32Array(len).map((_, i) => 0.5 * Math.sin((2 * Math.PI * hz * i) / R));

describe("a clip's sound work", () => {
  it("is cleaned when read: bad values clamped, nothing set = null", () => {
    expect(readSound({ clean: 3, enhance: true, effect: "nope", mix: -1, pitch: 40 })).toEqual({ clean: 1, enhance: true, effect: null, mix: 0, pitch: 12 });
    expect(readSound({ clean: 0, enhance: false, effect: null, pitch: 0 })).toBeNull();
    expect(readSound("x")).toBeNull();
  });

  it("is set field by field, and back to as recorded with null", () => {
    let t = applyAll(emptyTimeline(), [{ type: "add_clip", assetId: "v" }, { type: "update_clip", clipId: "$1", patch: { sound: { clean: 0.8 } } }, { type: "update_clip", clipId: "$1", patch: { sound: { effect: "reverb", mix: 0.4 } } }], assets).timeline;
    const c = main(t).clips[0];
    expect(c.sound).toEqual({ clean: 0.8, enhance: false, effect: "reverb", mix: 0.4, pitch: 0 });
    expect(hasSoundFx(c)).toBe(true);
    t = apply(t, { type: "update_clip", clipId: c.id, patch: { sound: null } }, assets).timeline;
    expect(main(t).clips[0].sound).toBeNull();
  });

  it("stays with both halves of a split, and refuses a picture", () => {
    const t = applyAll(emptyTimeline(), [{ type: "add_clip", assetId: "v" }, { type: "update_clip", clipId: "$1", patch: { sound: { enhance: true } } }, { type: "split", at: 3000 }], assets).timeline;
    expect(main(t).clips.map((c) => c.sound?.enhance)).toEqual([true, true]);
    const p = apply(emptyTimeline(), { type: "add_clip", assetId: "p" }, assets).timeline;
    expect(() => apply(p, { type: "update_clip", clipId: main(p).clips[0].id, patch: { sound: { clean: 1 } } }, assets)).toThrow(/فيها صوت/);
  });
});

describe("voice pitch", () => {
  it("moves a tone an octave up or down and keeps its length", () => {
    const x = tone(300);
    const up = shiftPitch(x, 12);
    const down = shiftPitch(x, -12);
    expect(up.length).toBe(x.length);
    expect(freq(up)).toBeGreaterThan(560);
    expect(freq(up)).toBeLessThan(640);
    expect(freq(down)).toBeGreaterThan(130);
    expect(freq(down)).toBeLessThan(170);
  });
});

describe("noise reduction", async () => {
  // the RNNoise build checks for a browser
  (globalThis as { window?: unknown }).window ??= globalThis;
  const { Rnnoise } = await import("@shiguredo/rnnoise-wasm");
  const load = () => Rnnoise.load();
  const rms = (a: Float32Array, s = R / 2, e = a.length - R / 2) => Math.sqrt(a.subarray(s, e).reduce((m, v) => m + v * v, 0) / (e - s));

  it("takes out steady noise", async () => {
    let seed = 7;
    const noise = new Float32Array(R * 2).map(() => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.1);
    const out = await denoise(noise, 1, load);
    expect(rms(out)).toBeLessThan(rms(noise) * 0.1);
  });

  it("keeps a voice in place (no delay) and blends with the original at lower strengths", async () => {
    // a gliding voice-like sound
    const voice = new Float32Array(R * 2).map((_, i) => {
      const t = i / R;
      const ph = 2 * Math.PI * (100 * t + 25 * t * t + 8 * Math.sin(5 * t));
      let v = 0;
      for (let h = 1; h <= 12; h++) v += Math.sin(ph * h) / h;
      return 0.15 * v * (0.5 + 0.5 * Math.sin(2 * Math.PI * 3 * t));
    });
    const out = await denoise(voice, 1, load);
    let best = -Infinity;
    let lag = 0;
    for (let l = -100; l <= 100; l++) {
      let s = 0;
      for (let i = R / 2; i < R; i++) s += out[i] * voice[i - l];
      if (s > best) [best, lag] = [s, l];
    }
    expect(Math.abs(lag)).toBeLessThanOrEqual(2);
    const half = await denoise(voice, 0, load);
    expect(Array.from(half.subarray(1000, 1010))).toEqual(Array.from(voice.subarray(1000, 1010)));
  });
});
