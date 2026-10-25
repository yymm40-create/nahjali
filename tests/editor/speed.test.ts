import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { stretch } from "@/components/jawad/editor/stretch";

const SR = 48_000;
const tone = (freqs: number[], seconds: number) => {
  const x = new Float32Array(Math.round(SR * seconds));
  for (let i = 0; i < x.length; i++) for (const f of freqs) x[i] += (0.4 / freqs.length) * Math.sin((2 * Math.PI * f * i) / SR);
  return x;
};
/** The strongest frequency near `around` (a DFT scan in 0.5 Hz steps over the middle of the sound). */
function peak(x: Float32Array, around: number) {
  const a = Math.floor(x.length * 0.25), b = Math.floor(x.length * 0.75);
  let best = 0, bestP = -1;
  for (let f = around * 0.8; f <= around * 1.2; f += 0.5) {
    let re = 0, im = 0;
    for (let i = a; i < b; i++) {
      re += x[i] * Math.cos((2 * Math.PI * f * i) / SR);
      im += x[i] * Math.sin((2 * Math.PI * f * i) / SR);
    }
    const p = re * re + im * im;
    if (p > bestP) {
      bestP = p;
      best = f;
    }
  }
  return best;
}
const rms = (x: Float32Array) => {
  const a = Math.floor(x.length * 0.1), b = Math.floor(x.length * 0.9);
  let s = 0;
  for (let i = a; i < b; i++) s += x[i] * x[i];
  return Math.sqrt(s / (b - a));
};

const SPEEDS = [0.5, 0.75, 1.25, 1.5, 1.75, 2];

describe("السرعة مثل يوتيوب: الصوت يحتفظ بطبقته وجودته", () => {
  for (const speed of SPEEDS) {
    it(`×${speed}: the pitch stays, the length follows the speed, the loudness stays`, () => {
      const src = tone([220], 2);
      const outLen = Math.round(SR * 1 / speed);
      const [out] = stretch([src], 0, speed, outLen, SR);
      expect(out.length).toBe(outLen);
      // a plain rate change would move 220 Hz to 220 × speed (×1.5 → 330 Hz: the "chipmunk"); kept, it stays at 220
      expect(Math.abs(peak(out, 220) - 220)).toBeLessThanOrEqual(2);
      expect(rms(out) / rms(src)).toBeGreaterThan(0.85);
      expect(rms(out) / rms(src)).toBeLessThan(1.15);
    });
  }

  it("keeps a chord's two notes where they were (a voice's harmonics stay in place)", () => {
    const src = tone([200, 300], 2.4);
    for (const speed of [0.75, 1.5]) {
      const [out] = stretch([src], 0, speed, Math.round((src.length - 4096) / speed), SR);
      expect(Math.abs(peak(out, 200) - 200)).toBeLessThanOrEqual(2);
      expect(Math.abs(peak(out, 300) - 300)).toBeLessThanOrEqual(2);
    }
  });

  it("stretches both channels of a stereo sound alike", () => {
    const l = tone([220], 1.5), r = tone([330], 1.5);
    const [ol, or] = stretch([l, r], 0, 1.5, Math.round(SR * 0.8), SR);
    expect(Math.abs(peak(ol, 220) - 220)).toBeLessThanOrEqual(2);
    expect(Math.abs(peak(or, 330) - 330)).toBeLessThanOrEqual(2);
  });

  it("×1 is the very samples (nothing processed, nothing lost)", () => {
    const src = tone([220, 431], 0.5);
    const [out] = stretch([src], 100, 1, 1000, SR);
    expect(Array.from(out)).toEqual(Array.from(src.subarray(100, 1100)));
  });

  it("works at 44.1 kHz and 96 kHz too (the window follows the sample rate)", () => {
    for (const sr of [44_100, 96_000]) {
      const x = new Float32Array(sr * 2);
      for (let i = 0; i < x.length; i++) x[i] = 0.4 * Math.sin((2 * Math.PI * 220 * i) / sr);
      const [out] = stretch([x], 0, 1.5, sr, sr);
      // measured at this rate: count the zero crossings (220 Hz → 440 a second)
      let z = 0;
      for (let i = Math.floor(sr * 0.2) + 1; i < Math.floor(sr * 0.8); i++) if ((out[i - 1] < 0) !== (out[i] < 0)) z++;
      expect(Math.abs(z / 0.6 - 440)).toBeLessThan(10);
    }
  });
});

describe("المعاينة ما تغيّر طبقة الصوت", () => {
  const player = readFileSync("src/components/jawad/editor/player.ts", "utf8");
  it("never plays a clip's sound through Web Audio at a changed rate (that is the chipmunk voice)", () => {
    expect(player).not.toMatch(/playbackRate\.value\s*=\s*c\.speed/);
    expect(player).toContain("if (clip.speed !== 1) return null;");
    expect(player).toContain("stretchedOf(worked.buf, worked.key, clip.speed)");
  });
  it("lets the browser keep the pitch on the elements (with the old prefixed names)", () => {
    expect(player).toContain("m.preservesPitch = true;");
    expect(player).toContain("webkitPreservesPitch: true");
  });
  it("the export stretches at the sound's own sample rate", () => {
    expect(readFileSync("src/components/jawad/editor/export.ts", "utf8")).toContain("stretch(channels, at, speed, outLen, sr)");
  });
});

describe("التحكم مثل يوتيوب", () => {
  it("has YouTube's steps, a custom slider, and حيدرا ماكس knows the range", () => {
    const ins = readFileSync("src/components/jawad/editor/Inspector.tsx", "utf8");
    expect(ins).toContain("const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3];");
    expect(ins).toMatch(/<Slider label="مخصص" value=\{clip\.speed\} min=\{0\.25\} max=\{4\} step=\{0\.05\}/);
    expect(readFileSync("src/lib/editor/assistant-commands.ts", "utf8")).toContain("speed 0.25–4");
  });
});
