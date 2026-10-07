import { describe, expect, it } from "vitest";
import { scopeLine, scopeOf } from "@/lib/editor/scopes";

const frame = (f: (i: number) => [number, number, number], n = 10000) => {
  const a = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const [r, g, b] = f(i);
    a.set([r, g, b, 255], i * 4);
  }
  return a;
};

describe("scopes", () => {
  it("a grey ramp spreads 0–100 and has no cast", () => {
    const s = scopeOf(frame((i) => { const v = Math.round((i / 9999) * 255); return [v, v, v]; }), 100, 100);
    expect(s.p2).toBeLessThan(4);
    expect(s.p50).toBeGreaterThan(45);
    expect(s.p50).toBeLessThan(55);
    expect(s.p98).toBeGreaterThan(96);
    expect(s.cast.mids).toEqual({ r: 0, b: 0 });
    expect(s.skin).toBeNull();
  });
  it("a warm frame shows a red cast; clipping is counted", () => {
    const s = scopeOf(frame((i) => (i < 2000 ? [255, 255, 255] : [140, 120, 105])), 100, 100);
    expect(s.blown).toBeCloseTo(20, 0);
    expect(s.cast.mids.r).toBeGreaterThan(5);
    expect(s.cast.mids.b).toBeLessThan(-3);
  });
  it("skin tones are found on the skin line", () => {
    const s = scopeOf(frame(() => [200, 150, 120]), 100, 100);
    expect(s.skin!.share).toBe(100);
    expect(s.skin!.hue).toBeGreaterThan(15);
    expect(s.skin!.hue).toBeLessThan(30);
    expect(scopeLine(s)).toContain("skin 100%");
  });
});
