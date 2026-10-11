import { describe, expect, it } from "vitest";
import { glow, scopeData, skinLine, vectorTargets, VEC } from "@/lib/editor/scope-draw";

const fill = (w: number, h: number, rgb: [number, number, number]) => {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) px.set([...rgb, 255], i * 4);
  return px;
};

describe("«السكوبات»", () => {
  it("a pure red picture: the red parade at the top, green and blue at the bottom", () => {
    const d = scopeData(fill(32, 18, [255, 0, 0]), 32, 18, 16);
    expect(d.parade[0][255]).toBeGreaterThan(0);
    expect(d.parade[1][0]).toBeGreaterThan(0);
    expect(d.parade[2][0]).toBeGreaterThan(0);
    expect(d.parade[1][255]).toBe(0);
    expect(d.hist[0][255]).toBe(32 * 18);
  });
  it("every pixel is counted once in each scope", () => {
    const d = scopeData(fill(20, 10, [120, 130, 140]), 20, 10, 10);
    expect(d.vec.reduce((a, b) => a + b, 0)).toBe(200);
    expect(d.wave.reduce((a, b) => a + b, 0)).toBe(200);
    expect(d.hist[3].reduce((a, b) => a + b, 0)).toBe(200);
  });
  it("grey sits in the middle of the vectorscope; red goes toward its box", () => {
    const grey = scopeData(fill(8, 8, [128, 128, 128]), 8, 8, 8);
    expect(grey.vec[Math.floor(VEC / 2) * VEC + Math.floor(VEC / 2)]).toBe(64);
    const red = scopeData(fill(8, 8, [255, 0, 0]), 8, 8, 8);
    const [, rx, ry] = vectorTargets()[0];
    const cell = Math.min(VEC - 1, Math.floor(ry * VEC)) * VEC + Math.min(VEC - 1, Math.floor(rx * VEC));
    expect(red.vec[cell]).toBeGreaterThan(0);
  });
  it("the skin line points between red and yellow (up and to the right)", () => {
    const s = skinLine();
    expect(Math.hypot(s.x, s.y)).toBeCloseTo(1, 5);
    expect(s.y).toBeLessThan(0);
  });
  it("a count shows as brightness, a lone pixel still visible", () => {
    expect(glow(0, 100)).toBe(0);
    expect(glow(1, 10000)).toBeGreaterThan(0.03);
    expect(glow(100, 100)).toBe(1);
  });
});
