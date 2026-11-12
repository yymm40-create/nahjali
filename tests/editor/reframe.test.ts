import { describe, expect, it } from "vitest";
import { apply, applyAll } from "@/lib/editor/commands";
import { emptyTimeline, transformAt, DEFAULT_TRANSFORM, LIMITS } from "@/lib/editor/model";
import { aimAt, bounds, cropPath, followed, REFRAME, toKeys, type FaceFrame, type Geometry } from "@/lib/editor/reframe";
import type { FaceBox } from "@/lib/editor/talk-motion";
import { lib, main, video } from "./helpers";

// a 16:9 video in a 9:16 frame: the picture is about 3.16 frames wide
const G: Geometry = { W: 1080, H: 1920, sw: 1920, sh: 1080, scale: 1 };
const face = (x: number, y = 0.4, w = 0.1): FaceBox => ({ x, y, w, h: w * 1.4 });
/** five looks a second for `sec` seconds, the face where `at` says (null = none) */
const frames = (sec: number, at: (t: number) => FaceBox | FaceBox[] | null): FaceFrame[] =>
  Array.from({ length: Math.round(sec * 5) }, (_, i) => {
    const ms = i * 200;
    const f = at(ms);
    return { ms, faces: f ? (Array.isArray(f) ? f : [f]) : [] };
  });
const steps = (xs: number[]) => xs.slice(1).map((x, i) => Math.abs(x - xs[i]));

describe("the bounds", () => {
  it("lets the centre move only as far as the picture still covers the frame", () => {
    const b = bounds(G);
    expect(b.w).toBeCloseTo(1920 / 1080 / (1080 / 1920), 5);
    expect(b.x[0]).toBeCloseTo(0.5 - (b.w - 1) / 2, 5);
    expect(b.y).toEqual([0.5, 0.5]); // the height fits exactly: no room up or down
    // a picture narrower than the frame can't move at all
    expect(bounds({ ...G, sw: 500, sh: 1000 }).x).toEqual([0.5, 0.5]);
  });

  it("aims to put the face in the middle, inside the bounds", () => {
    const a = aimAt(face(0.5), G);
    expect(a.x).toBeCloseTo(0.5, 5);
    const left = aimAt(face(0.02), G);
    expect(left.x).toBeCloseTo(bounds(G).x[1], 5); // the far left edge: as far as it goes, no black bar
  });
});

describe("the camera path", () => {
  it("stays put while the face moves a little (dead zone)", () => {
    const path = cropPath(frames(6, (t) => face(0.5 + 0.01 * Math.sin(t / 150))), G, DEFAULT_TRANSFORM);
    const xs = path.map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(0.02);
  });

  it("follows a face that crosses the frame, never faster than the cap and never outside the bounds", () => {
    const path = cropPath(frames(10, (t) => face(0.15 + (0.7 * t) / 10_000)), G, DEFAULT_TRANSFORM);
    const xs = path.map((p) => p.x);
    const b = bounds(G);
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(b.x[0] - 1e-9);
      expect(x).toBeLessThanOrEqual(b.x[1] + 1e-9);
    }
    for (const d of steps(xs)) expect(d).toBeLessThanOrEqual(REFRAME.maxSpeed * 0.2 + 1e-9);
    // it really went across: the face ends near the middle of the frame
    const last = path[path.length - 1];
    expect(Math.abs(last.x - aimAt(face(0.15 + 0.7 * 0.98), G).x)).toBeLessThan(0.35);
    expect(xs[0] - last.x).toBeGreaterThan(1);
  });

  it("jumps no faster than the cap when the face jumps (a cut to a wide shot)", () => {
    const path = cropPath(frames(6, (t) => face(t < 2000 ? 0.2 : 0.8)), G, DEFAULT_TRANSFORM);
    for (const d of steps(path.map((p) => p.x))) expect(d).toBeLessThanOrEqual(REFRAME.maxSpeed * 0.2 + 1e-9);
  });

  it("holds where no face is seen", () => {
    const path = cropPath(frames(8, (t) => (t < 3000 ? face(0.3) : t < 6000 ? null : face(0.3))), G, DEFAULT_TRANSFORM);
    const held = path.filter((p) => p.t >= 3000 && p.t < 6000).map((p) => p.x);
    expect(Math.max(...held) - Math.min(...held)).toBeLessThan(1e-6);
  });

  it("with no face at all, stays where the clip was (kept inside the bounds)", () => {
    const path = cropPath(frames(3, () => null), G, { x: 9, y: 0.5 });
    expect(new Set(path.map((p) => p.x)).size).toBe(1);
    expect(path[0].x).toBeCloseTo(bounds(G).x[1], 5);
  });

  it("keeps a square frame covered too", () => {
    const sq: Geometry = { ...G, W: 1080, H: 1080, scale: 1.3 };
    const b = bounds(sq);
    const path = cropPath(frames(6, (t) => face(t < 3000 ? 0.05 : 0.95, t < 3000 ? 0.1 : 0.9)), sq, DEFAULT_TRANSFORM);
    for (const p of path) {
      expect(p.x).toBeGreaterThanOrEqual(b.x[0] - 1e-9);
      expect(p.x).toBeLessThanOrEqual(b.x[1] + 1e-9);
      expect(p.y).toBeGreaterThanOrEqual(b.y[0] - 1e-9);
      expect(p.y).toBeLessThanOrEqual(b.y[1] + 1e-9);
    }
  });
});

describe("whom it follows", () => {
  it("stays on the same person when someone small passes by", () => {
    const f = followed(frames(4, (t) => [face(0.3, 0.4, 0.12), ...(t > 1000 && t < 2000 ? [face(0.8, 0.4, 0.14)] : [])]));
    expect(f.every((x) => x && Math.abs(x.x - 0.3) < 0.01)).toBe(true);
  });

  it("turns to a clearly bigger face only once it has stayed a while", () => {
    const f = followed(frames(5, (t) => (t < 1000 ? [face(0.3, 0.4, 0.1)] : [face(0.3, 0.4, 0.1), face(0.75, 0.4, 0.2)])));
    const ms = (i: number) => i * 200;
    const switched = f.findIndex((x) => x && x.x > 0.7);
    expect(ms(switched)).toBeGreaterThanOrEqual(1000 + REFRAME.switchMs);
    expect(f.slice(switched).every((x) => x && x.x > 0.7)).toBe(true);
  });
});

describe("the motion points", () => {
  it("are few, within the editor's limit, and keep the clip's scale", () => {
    const path = cropPath(frames(240, (t) => face(0.5 + 0.35 * Math.sin(t / 4000))), G, DEFAULT_TRANSFORM);
    const keys = toKeys(path, { ...DEFAULT_TRANSFORM, scale: 1.2 });
    expect(keys.length).toBeGreaterThan(2);
    expect(keys.length).toBeLessThanOrEqual(LIMITS.keys);
    expect(keys.every((k) => k.scale === 1.2)).toBe(true);
    expect(toKeys(cropPath(frames(3, () => face(0.5)), G, DEFAULT_TRANSFORM), DEFAULT_TRANSFORM)).toHaveLength(1);
  });

  it("go on the clip as one change it can move afterwards", () => {
    const assets = lib(video("a", 10_000));
    const t = applyAll(emptyTimeline("9:16"), [{ type: "add_clip", assetId: "a" }], assets).timeline;
    const clip = main(t).clips[0];
    const keys = toKeys(cropPath(frames(10, (ms) => face(0.2 + 0.06 * ms / 1000)), G, clip.transform), clip.transform);
    const r = apply(t, { type: "set_keys", clipId: clip.id, keys, label: "اتبع الوجه" }, assets);
    expect(r.label).toBe("اتبع الوجه");
    const after = main(r.timeline).clips[0];
    expect(after.keys.length).toBe(keys.length);
    expect(transformAt(after, 0).x).toBeCloseTo(keys[0].x, 4);
    // a point moved by hand afterwards
    const moved = apply(r.timeline, { type: "set_key", clipId: clip.id, at: 5000, transform: { x: 0.5 } }, assets).timeline;
    expect(transformAt(main(moved).clips[0], 5000).x).toBeCloseTo(0.5, 4);
  });
});
