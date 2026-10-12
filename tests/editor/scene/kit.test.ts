import { describe, expect, it } from "vitest";
import { SCENE_KIT_API, SCENE_KIT_JS } from "@/lib/editor/scene/kit";
import { SCENE_CSP, SCENE_RUNTIME_JS, sceneDoc, THREE_URL } from "@/lib/editor/scene/runtime";

// The kit runs inside the scene page; its pure parts are checked here by running the very same source.
type Kit = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const load = (): Kit => {
  const mod = { exports: {} as Kit };
  new Function("module", "window", SCENE_KIT_JS)(mod, undefined);
  return mod.exports;
};

describe("the scene kit", () => {
  const K = load();
  it("loads as plain JavaScript and offers every function it documents", () => {
    for (const name of ["clamp", "lerp", "seg", "tween", "spring", "springTo", "keys", "envelope", "rng", "noise2", "noise3", "curl", "shake", "mix", "counter", "swarm", "metaballs", "glow", "bloom", "lightSweep", "echo", "grain", "vignette", "rgbSplit", "glass", "camera", "project", "inSpace", "picture", "textPoints", "imagePoints", "fit", "wrap", "text"])
      expect(typeof K[name], name).toBe("function");
    for (const name of ["springTo", "swarm", "metaballs", "glass", "inSpace", "lightSweep", "rgbSplit", "bloom"]) expect(SCENE_KIT_API).toContain(`K.${name}(`);
  });
  it("is deterministic: the same seed, the same numbers", () => {
    const a = K.rng(42), b = K.rng(42);
    const xs = Array.from({ length: 50 }, () => a());
    expect(Array.from({ length: 50 }, () => b())).toEqual(xs);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(K.noise3(0.3, 0.7, 1.1)).toBe(K.noise3(0.3, 0.7, 1.1));
    expect(Math.abs(K.noise2(12.3, 4.5))).toBeLessThanOrEqual(1);
  });
  it("eases from 0 to 1, and the silk landing decelerates", () => {
    for (const [name, f] of Object.entries(K.ease as Record<string, (x: number) => number>)) {
      expect(f(0), name).toBeCloseTo(0, 3);
      expect(f(1), name).toBeCloseTo(1, 3);
    }
    // most of the way in the first half, a long soft landing after it
    expect(K.ease.silk(0.3)).toBeGreaterThan(0.7);
    expect(K.ease.silk(0.9) - K.ease.silk(0.8)).toBeLessThan(0.05);
    expect(K.bezier(0.25, 0.1, 0.25, 1)(0.5)).toBeCloseTo(0.8024, 2);
  });
  it("springs settle at their target, and retargeting stays a function of time", () => {
    expect(K.spring(0)).toBe(0);
    expect(K.spring(3)).toBeCloseTo(1, 3);
    // a light damping overshoots, a heavy one never does
    const peak = (o: object) => Math.max(...Array.from({ length: 200 }, (_, i) => K.spring(i / 100, o)));
    expect(peak({ stiffness: 200, damping: 10 })).toBeGreaterThan(1.05);
    expect(peak({ stiffness: 170, damping: 40 })).toBeLessThanOrEqual(1.0001);
    const ch = [[0, 100], [1, 40], [2, 80]];
    expect(K.springTo(0, 0, ch)).toBe(0);
    expect(K.springTo(0.99, 0, ch)).toBeCloseTo(100, 0);
    expect(K.springTo(5, 0, ch)).toBeCloseTo(80, 1);
    expect(K.springTo(1.5, 0, ch)).toBe(K.springTo(1.5, 0, ch));
  });
  it("times things: segments, tweens, envelopes, keys, beats", () => {
    expect(K.seg(1, 2, 1)).toBe(0);
    expect(K.seg(2.5, 2, 1)).toBe(0.5);
    expect(K.tween(3, 1, 2, 10, 20, K.ease.linear)).toBe(20);
    expect(K.envelope(0.5, 1, 3)).toBe(0);
    expect(K.envelope(2, 1, 3)).toBe(1);
    expect(K.keys(1, [[0, 0], [2, 10]], K.ease.linear)).toBe(5);
    expect(K.beat(1.25, 120)).toEqual({ n: 2, f: 0.5 });
  });
  it("counts and writes digits the way they are asked", () => {
    expect(K.counter(1, 0, 1250, { comma: true, suffix: "+" })).toBe("1,250+");
    expect(K.counter(1, 0, 70, { suffix: "٪", arabic: true })).toBe("٧٠٪");
    expect(K.counter(0, 0, 70)).toBe("0");
    expect(K.mix("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(K.isArabic("مرحبا")).toBe(true);
    expect(K.isArabic("hello")).toBe(false);
  });
});

describe("the scene page", () => {
  it("allows no network but three.js and the fonts' CDN", () => {
    expect(SCENE_CSP).toContain("default-src 'none'");
    expect(SCENE_CSP).toContain("img-src data: blob:");
    expect(SCENE_CSP).not.toMatch(/\*/);
    expect(SCENE_CSP).toContain("form-action 'none'");
    const doc = sceneDoc();
    expect(doc).toContain(THREE_URL);
    expect(doc.startsWith("<!doctype html>")).toBe(true);
  });
  it("embeds the kit and the runtime without breaking out of their script tags", () => {
    expect(SCENE_KIT_JS).not.toMatch(/<\/script/i);
    expect(SCENE_RUNTIME_JS).not.toMatch(/<\/script/i);
  });
  it("freezes the clocks and seeds Math.random inside the page", () => {
    expect(SCENE_RUNTIME_JS).toContain("Math.random = function");
    expect(SCENE_RUNTIME_JS).toContain("Date.now = function");
    expect(SCENE_RUNTIME_JS).toContain("e.source !== parent");
  });
});
