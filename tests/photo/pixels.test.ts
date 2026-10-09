import { describe, expect, it } from "vitest";
import { adjustPixels, effectiveAdjust, isIdentity } from "@/lib/photo/pixels";
import { ADJUSTS, FILTERS, NO_ADJUST, type Adjust } from "@config/photo";

const px = (...rgb: number[]) => new Uint8ClampedArray(rgb.flatMap((v, i) => (i % 3 === 2 ? [v, 255] : [v])));
const one = (r: number, g: number, b: number, a: Partial<Adjust>) => {
  const d = new Uint8ClampedArray([r, g, b, 255]);
  adjustPixels(d, 1, 1, { ...NO_ADJUST, ...a });
  return [...d];
};
const variance = (d: Uint8ClampedArray) => {
  const v = [...d].filter((_, i) => i % 4 === 0);
  const m = v.reduce((s, x) => s + x, 0) / v.length;
  return v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length;
};

describe("the sliders on pixels", () => {
  it("do nothing at zero, and leave the alpha alone", () => {
    expect(isIdentity(NO_ADJUST)).toBe(true);
    const d = new Uint8ClampedArray([10, 20, 30, 77, 200, 100, 50, 0]);
    const before = [...d];
    adjustPixels(d, 2, 1, NO_ADJUST);
    expect([...d]).toEqual(before);
    const e = new Uint8ClampedArray([10, 20, 30, 77]);
    adjustPixels(e, 1, 1, { ...NO_ADJUST, exposure: 40, saturation: 30, vignette: 50, grain: 20 });
    expect(e[3]).toBe(77);
  });

  it("exposure doubles or halves the light", () => {
    expect(one(100, 100, 100, { exposure: 100 })).toEqual([200, 200, 200, 255]);
    expect(one(100, 100, 100, { exposure: -100 })).toEqual([50, 50, 50, 255]);
  });

  it("saturation -100 is grey, +100 pushes a colour away from its grey", () => {
    const [r, g, b] = one(200, 120, 40, { saturation: -100 });
    expect(Math.abs(r - g)).toBeLessThanOrEqual(1);
    expect(Math.abs(g - b)).toBeLessThanOrEqual(1);
    const [r2, , b2] = one(200, 120, 40, { saturation: 100 });
    expect(r2 - b2).toBeGreaterThan(200 - 40);
  });

  it("temperature warms (more red, less blue) or cools", () => {
    const warm = one(128, 128, 128, { temperature: 60 });
    expect(warm[0]).toBeGreaterThan(128);
    expect(warm[2]).toBeLessThan(128);
    const cool = one(128, 128, 128, { temperature: -60 });
    expect(cool[0]).toBeLessThan(128);
    expect(cool[2]).toBeGreaterThan(128);
  });

  it("contrast moves values away from the middle; negative pulls them in", () => {
    expect(one(200, 200, 200, { contrast: 60 })[0]).toBeGreaterThan(200);
    expect(one(60, 60, 60, { contrast: 60 })[0]).toBeLessThan(60);
    expect(one(200, 200, 200, { contrast: -60 })[0]).toBeLessThan(200);
    expect(one(128, 128, 128, { contrast: 80 })[0]).toBeGreaterThanOrEqual(127);
  });

  it("shadows lift the dark and barely touch the bright; highlights tame the bright and barely touch the dark", () => {
    const darkUp = one(30, 30, 30, { shadows: 100 })[0] - 30;
    const whiteUp = one(240, 240, 240, { shadows: 100 })[0] - 240;
    expect(darkUp).toBeGreaterThan(20);
    expect(whiteUp).toBeLessThan(darkUp / 4);
    const brightDown = 230 - one(230, 230, 230, { highlights: -100 })[0];
    const darkDown = 30 - one(30, 30, 30, { highlights: -100 })[0];
    expect(brightDown).toBeGreaterThan(25);
    expect(darkDown).toBeLessThan(brightDown / 4);
  });

  it("turns the hue: pure red at 120° becomes mostly green", () => {
    const [r, g, b] = one(255, 0, 0, { hue: 120 });
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
    const same = one(255, 0, 0, { hue: 0 });
    expect(same).toEqual([255, 0, 0, 255]);
  });

  it("the dark edges darken the corners and keep the centre", () => {
    const w = 9;
    const d = new Uint8ClampedArray(w * w * 4).fill(200);
    for (let i = 3; i < d.length; i += 4) d[i] = 255;
    adjustPixels(d, w, w, { ...NO_ADJUST, vignette: 100 });
    const at = (x: number, y: number) => d[(y * w + x) * 4];
    expect(at(4, 4)).toBe(200);
    expect(at(0, 0)).toBeLessThan(120);
    expect(at(0, 0)).toBeLessThan(at(1, 1));
  });

  it("grain adds noise that is the same every time", () => {
    const make = () => {
      const d = new Uint8ClampedArray(16 * 16 * 4).fill(128);
      adjustPixels(d, 16, 16, { ...NO_ADJUST, grain: 60 });
      return d;
    };
    const a = make();
    expect(variance(a)).toBeGreaterThan(20);
    expect([...a]).toEqual([...make()]);
  });

  it("blur softens a hard pattern, and sharpen hardens an edge", () => {
    const w = 16;
    const checker = () => {
      const d = new Uint8ClampedArray(w * w * 4);
      for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) d.set([(x + y) % 2 ? 255 : 0, (x + y) % 2 ? 255 : 0, (x + y) % 2 ? 255 : 0, 255], (y * w + x) * 4);
      return d;
    };
    const base = variance(checker());
    const soft = checker();
    adjustPixels(soft, w, w, { ...NO_ADJUST, blur: 60 });
    expect(variance(soft)).toBeLessThan(base / 2);
    // an edge: left half 90, right half 160
    const edge = new Uint8ClampedArray(w * w * 4);
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) edge.set([x < w / 2 ? 90 : 160, x < w / 2 ? 90 : 160, x < w / 2 ? 90 : 160, 255], (y * w + x) * 4);
    const before = edge[(4 * w + w / 2) * 4] - edge[(4 * w + w / 2 - 1) * 4];
    adjustPixels(edge, w, w, { ...NO_ADJUST, sharpen: 100 });
    // sharper: the dark side gets darker and the bright side brighter next to the edge
    expect(edge[(4 * w + w / 2 - 1) * 4]).toBeLessThan(90);
    expect(edge[(4 * w + w / 2) * 4]).toBeGreaterThan(160);
    expect(edge[(4 * w + w / 2) * 4] - edge[(4 * w + w / 2 - 1) * 4]).toBeGreaterThan(before);
  });

  it("always stays inside 0–255", () => {
    const d = px(250, 5, 128, 0, 255, 60);
    adjustPixels(d, 2, 1, { ...NO_ADJUST, exposure: 100, contrast: 100, saturation: 100, shadows: -100, highlights: 100, sharpen: 100 });
    for (const v of d) expect(v >= 0 && v <= 255).toBe(true);
  });
});

describe("looks", () => {
  it("are their sliders scaled by the strength, added to the person's own, and kept in range", () => {
    const cin = FILTERS.find((f) => f.id === "cinematic")!;
    const full = effectiveAdjust(NO_ADJUST, { id: "cinematic", strength: 100 });
    expect(full.contrast).toBe(cin.adjust.contrast);
    const half = effectiveAdjust(NO_ADJUST, { id: "cinematic", strength: 50 });
    expect(half.contrast).toBe((cin.adjust.contrast ?? 0) / 2);
    expect(effectiveAdjust(NO_ADJUST, { id: "cinematic", strength: 0 })).toEqual(NO_ADJUST);
    const mine = effectiveAdjust({ ...NO_ADJUST, contrast: 90 }, { id: "cinematic", strength: 100 });
    expect(mine.contrast).toBe(100);
    expect(effectiveAdjust(NO_ADJUST, { id: "nope", strength: 100 })).toEqual(NO_ADJUST);
  });

  it("every look keeps all its sliders in each slider's range, and none is empty except «بدون»", () => {
    for (const f of FILTERS) {
      if (f.id === "none") expect(Object.keys(f.adjust)).toHaveLength(0);
      else expect(Object.keys(f.adjust).length).toBeGreaterThan(0);
      for (const [k, v] of Object.entries(f.adjust)) {
        const def = ADJUSTS.find((a) => a.key === k)!;
        expect(def).toBeTruthy();
        expect(v).toBeGreaterThanOrEqual(def.min);
        expect(v).toBeLessThanOrEqual(def.max);
      }
    }
    expect(new Set(FILTERS.map((f) => f.id)).size).toBe(FILTERS.length);
  });
});
