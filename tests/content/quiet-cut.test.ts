import { describe, expect, it } from "vitest";
import { quietestNear } from "@/components/claude-code/draw";

/** one second of «speech» (a loud tone) with a silent gap from `gapFrom` to `gapTo` */
function voice(RATE: number, gapFrom: number, gapTo: number) {
  const c = new Float32Array(RATE);
  for (let i = 0; i < RATE; i++) {
    const t = i / RATE;
    c[i] = t >= gapFrom && t < gapTo ? 0.001 * Math.sin(i) : 0.5 * Math.sin(2 * Math.PI * 220 * t);
  }
  return [c, c];
}

describe("a slide's sound is cut in a real silence", () => {
  it("moves a cut planned inside a word to the pause next to it", () => {
    const RATE = 16000;
    // the window starts at second 10; the plan says 10.5, the real pause is 10.62–10.72
    const at = quietestNear(voice(RATE, 0.62, 0.72), RATE, 10, 10.5, 0.3);
    expect(at).toBeGreaterThan(10.62);
    expect(at).toBeLessThan(10.72);
  });
  it("keeps a cut that is already in the pause", () => {
    const RATE = 16000;
    const at = quietestNear(voice(RATE, 0.4, 0.6), RATE, 10, 10.5, 0.3);
    expect(Math.abs(at - 10.5)).toBeLessThan(0.06);
  });
  it("gives the same cut for the same sound (two slides that meet agree)", () => {
    const RATE = 16000;
    const ch = voice(RATE, 0.3, 0.35);
    expect(quietestNear(ch, RATE, 0, 0.5, 0.3)).toBe(quietestNear(ch, RATE, 0, 0.5, 0.3));
  });
});
