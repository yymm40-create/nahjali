import { describe, expect, it } from "vitest";
import { detectKey, keyPixels, sampleAt, hexToRgb } from "@/lib/editor/key-math";
import { makeScene, score, type Scene } from "./key-scenes";

// «الكي» trained on a thousand made-up shots: the new key (found by itself, or picked off the screen) against the
// old one, which measured the chroma's distance (and lost the screen's shadows).

const N = 1000;
const scenes: Scene[] = Array.from({ length: N }, (_, i) => makeScene(i + 1));

/** The old key's matte (Cb/Cr distance, tolerance × 0.35), for the comparison. */
function oldKey(s: Scene, color: string, tol = 0.3, soft = 0.15) {
  const px = new Uint8ClampedArray(s.px);
  const [kr, kg, kb] = hexToRgb(color);
  const ky = 0.2126 * kr + 0.7152 * kg + 0.0722 * kb;
  const KB = (kb - ky) / 1.8556,
    KR = (kr - ky) / 1.5748;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i] / 255,
      g = px[i + 1] / 255,
      b = px[i + 2] / 255;
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const d = Math.hypot((b - y) / 1.8556 - KB, (r - y) / 1.5748 - KR);
    const t0 = tol * 0.35;
    const t = Math.min(1, Math.max(0, (d - t0) / (soft * 0.25 + 0.0005)));
    px[i + 3] = Math.round(t * t * (3 - 2 * t) * 255);
  }
  return px;
}

const pass = (r: { removed: number; kept: number }) => r.removed >= 0.97 && r.kept >= 0.97;

describe("«الكي»: 1000 training shots", () => {
  it("🪄 finds the screen by itself and removes it, keeping the person", () => {
    let ok = 0;
    const bad: string[] = [];
    for (const s of scenes) {
      const d = detectKey(s.px, s.w, s.h);
      if (!d) {
        bad.push(`${s.seed}:${s.kind}:none`);
        continue;
      }
      const out = keyPixels(new Uint8ClampedArray(s.px), s.w, s.h, { color: d.color, tolerance: d.tolerance, soft: 0.15, spill: 0.6, choke: 0 });
      const r = score(s, out);
      if (pass(r)) ok++;
      else bad.push(`${s.seed}:${s.kind}:${r.removed.toFixed(2)}/${r.kept.toFixed(2)}@${d.tolerance}`);
    }
    console.log(`auto: ${ok}/${N}`, bad.slice(0, 15).join(" "));
    expect(ok / N).toBeGreaterThanOrEqual(0.98);
  }, 120_000);

  it("🎯 a colour picked off the screen (with the usual tolerance) works too", () => {
    let ok = 0;
    let old = 0;
    for (const s of scenes) {
      // a click on the screen beside the person (a corner)
      const color = sampleAt(s.px, s.w, s.h, 6, 6, 3);
      const out = keyPixels(new Uint8ClampedArray(s.px), s.w, s.h, { color, tolerance: 0.4, soft: 0.15, spill: 0.6, choke: 0 });
      if (pass(score(s, out))) ok++;
      if (pass(score(s, oldKey(s, color)))) old++;
    }
    console.log(`picked: new ${ok}/${N}, old ${old}/${N}`);
    expect(ok / N).toBeGreaterThanOrEqual(0.97);
    expect(ok).toBeGreaterThan(old);
  }, 120_000);

  it("takes the screen's glow off the person's edge", () => {
    let before = 0,
      after = 0,
      n = 0;
    for (const s of scenes.slice(0, 300)) {
      if (s.kind !== "green") continue;
      const d = detectKey(s.px, s.w, s.h)!;
      const out = keyPixels(new Uint8ClampedArray(s.px), s.w, s.h, { color: d.color, tolerance: d.tolerance, soft: 0.15, spill: 1, choke: 0 });
      for (let i = 0; i < s.w * s.h; i++) {
        if (s.truth[i] !== 2 || out[i * 4 + 3] < 128) continue;
        const o = i * 4;
        before += Math.max(0, s.px[o + 1] - Math.max(s.px[o], s.px[o + 2]));
        after += Math.max(0, out[o + 1] - Math.max(out[o], out[o + 2]));
        n++;
      }
    }
    expect(n).toBeGreaterThan(0);
    expect(after).toBeLessThan(before * 0.05 + 1);
  }, 120_000);
});
