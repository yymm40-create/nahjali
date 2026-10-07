import { describe, expect, it } from "vitest";
import { alignTo, maskOutline, resample } from "@/lib/editor/contour";
import type { Pt } from "@/lib/editor/grade";

const W = 64,
  H = 48;
const draw = (f: (x: number, y: number) => boolean) => {
  const v = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) v[y * W + x] = f(x, y) ? 255 : 0;
  return v;
};
const area = (p: Pt[]) => Math.abs(p.reduce((s, a, i) => s + a.x * p[(i + 1) % p.length].y - p[(i + 1) % p.length].x * a.y, 0)) / 2;

describe("«ماسك ذكي» outline", () => {
  it("a circle comes back as 48 corners around it, the right size", () => {
    const o = maskOutline(draw((x, y) => (x - 32) ** 2 + (y - 24) ** 2 < 15 ** 2), W, H)!;
    expect(o.points).toHaveLength(48);
    expect(o.centre.x).toBeCloseTo(0.5, 1);
    // π r² in 0…1 units (the pixel outline sits on the edge pixels' centres, a little inside)
    const want = (Math.PI * 15 * 15) / (W * H);
    expect(area(o.points)).toBeGreaterThan(want * 0.8);
    expect(area(o.points)).toBeLessThan(want * 1.1);
    for (const p of o.points) expect(Math.hypot((p.x - 0.5) * W, (p.y - 0.5) * H)).toBeGreaterThan(12);
  });
  it("picks the biggest piece, or the one near where the subject was", () => {
    const v = draw((x, y) => (x < 10 && y < 10) || (x > 30 && x < 60 && y > 20 && y < 45));
    expect(maskOutline(v, W, H)!.centre.x).toBeGreaterThan(0.6);
    expect(maskOutline(v, W, H, 48, { x: 0.05, y: 0.1 })!.centre.x).toBeLessThan(0.2);
    expect(maskOutline(draw(() => false), W, H)).toBeNull();
  });
  it("resamples evenly and aligns to the outline before it", () => {
    const sq = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
    const r = resample(sq, 8);
    expect(r[2]).toEqual({ x: 1, y: 0 });
    const turned = [...r.slice(3), ...r.slice(0, 3)];
    expect(alignTo(turned, r)).toEqual(r);
  });
});

describe("a tracked outline over time", () => {
  it("is read back (same corner count only) and blended between moments", async () => {
    const { readGrade, shapeAt } = await import("@/lib/editor/grade");
    const sq = (x: number) => [{ x, y: 0 }, { x: x + 0.1, y: 0 }, { x: x + 0.1, y: 0.1 }, { x, y: 0.1 }];
    const g = readGrade({ mask: { kind: "path", points: sq(0), shapes: [{ t: 1000, points: sq(0.4) }, { t: 0, points: sq(0) }, { t: 500, points: sq(0).slice(0, 3) }] } })!;
    expect(g.mask!.shapes.map((s) => s.t)).toEqual([0, 1000]);
    expect(shapeAt(g.mask!, 500)[0].x).toBeCloseTo(0.2, 6);
    expect(shapeAt(g.mask!, 5000)[0].x).toBeCloseTo(0.4, 6);
    // not a path: no outlines kept
    expect(readGrade({ mask: { kind: "ellipse", shapes: [{ t: 0, points: sq(0) }] } })!.mask!.shapes).toEqual([]);
  });
});
