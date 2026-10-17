import { describe, expect, it } from "vitest";
import { SOUND_KIT_JS } from "@/lib/editor/scene/sound-kit";
import { SCENE_RUNTIME_JS, sceneDoc } from "@/lib/editor/scene/runtime";
import { fitSpans, speechSpans, voiceLines } from "@/lib/editor/scene/voice-lines";
import { readPlan } from "@/lib/editor/scene/contract";
import { SCENE_CONTRACT } from "@/lib/editor/scene/skill";

type S = Record<string, (...a: unknown[]) => void> & { L: Float32Array; R: Float32Array; rate: number };
const kit = () => {
  const w: { SFX?: { make: (r: number, s: number) => S; finish: (s: S) => { L: Float32Array; R: Float32Array; peak: number } } } = {};
  new Function("window", SOUND_KIT_JS)(w);
  return w.SFX!;
};

describe("the sound made in code", () => {
  it("writes every sound of the kit, finite, under 0 dBFS, the same every time", () => {
    const run = () => {
      const SFX = kit();
      const s = SFX.make(48000, 4);
      s.whoosh(0.5, {});
      s.hit(1, {});
      s.riser(1.2, 2.2, {});
      s.sub(2.2, {});
      s.pop(2.6, {});
      s.click(2.8, {});
      s.tick(2.9, {});
      s.shimmer(3, { dur: 0.6 });
      s.glitch(3.3, {});
      s.drone(0, 4, {});
      s.beat(0, 4, { bpm: 120, full: true });
      s.tone(0.1, { f: 440, to: 880, dur: 0.4, type: "saw" });
      return SFX.finish(s);
    };
    const a = run(), b = run();
    let peak = 0, energy = 0;
    for (let i = 0; i < a.L.length; i++) {
      expect(Number.isFinite(a.L[i]) && Number.isFinite(a.R[i])).toBe(true);
      peak = Math.max(peak, Math.abs(a.L[i]), Math.abs(a.R[i]));
      energy += a.L[i] * a.L[i];
    }
    expect(peak).toBeLessThan(1);
    expect(energy).toBeGreaterThan(100);
    expect(a.L[48000]).toBe(b.L[48000]);
    expect(a.L.length).toBe(4 * 48000);
  });
  it("a hit lands on its frame: silence before, sound right after", () => {
    const SFX = kit();
    const s = SFX.make(48000, 2);
    s.hit(1, { gain: 0.8 });
    const at = (t: number) => Math.abs(s.L[Math.round(t * 48000)]);
    expect(at(0.99)).toBe(0);
    let max = 0;
    for (let i = 48000; i < 48000 + 2400; i++) max = Math.max(max, Math.abs(s.L[i]));
    expect(max).toBeGreaterThan(0.2);
  });
  it("the scene page carries the synth and its runtime parses", () => {
    expect(sceneDoc()).toContain("window.SFX");
    expect(() => new Function(SCENE_RUNTIME_JS)).not.toThrow();
    expect(SCENE_CONTRACT).toContain("sound(K, S)");
  });
});

describe("«🎙️ بصوتي»: when each line is said", () => {
  // three spoken phrases (a tone with a little noise) separated by pauses, in a quiet room
  const rate = 16000;
  const take = (spans: [number, number][], len: number) => {
    const s = new Float32Array(Math.round(len * rate));
    let seed = 7;
    for (let i = 0; i < s.length; i++) {
      seed = (seed * 16807) % 2147483647;
      s[i] = ((seed / 2147483647) * 2 - 1) * 0.002;
    }
    for (const [a, b] of spans) for (let i = Math.round(a * rate); i < Math.round(b * rate); i++) s[i] += 0.3 * Math.sin((2 * Math.PI * 180 * i) / rate);
    return s;
  };
  it("finds the phrases and gives each line its time", () => {
    const s = take([[0.3, 1.4], [1.9, 3.0], [3.6, 4.5]], 5);
    const sp = speechSpans(s, rate);
    expect(sp.length).toBe(3);
    expect(sp[0][0]).toBeCloseTo(0.3, 1);
    expect(sp[2][1]).toBeCloseTo(4.5, 1);
    const lines = voiceLines(s, rate, ["الأول", "الثاني", "الثالث"]);
    expect(lines.map((l) => l.text)).toEqual(["الأول", "الثاني", "الثالث"]);
    expect(lines[1].from).toBeCloseTo(1.9, 1);
  });
  it("joins the nearest phrases or halves the longest to fit the script", () => {
    expect(fitSpans([[0, 1], [1.1, 2], [3, 4]], 2)).toEqual([[0, 2], [3, 4]]);
    expect(fitSpans([[0, 2], [3, 3.5]], 3)).toEqual([[0, 1], [1, 2], [3, 3.5]]);
  });
  it("the plan keeps the narration lines", () => {
    const p = readPlan({ narration: [{ text: "هلا", from: 0, to: 1.5 }, { text: "", from: 1, to: 2 }] }, 10);
    expect(p.narration).toEqual([{ text: "هلا", from: 0, to: 1.5 }]);
  });
});
