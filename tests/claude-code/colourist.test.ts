import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { checkProgram, COMPUTE_KIT_JS, GRADE_KIT_API, readFinish } from "@/lib/claude-code/compute";
import { GRADE_CONTRACT, GRADE_RUBRIC } from "@/lib/claude-code/skill";
import { decodeLog, gamutToRec709, LOGS } from "@/lib/editor/grade";
import { readScope, scopeLine, scopeOf } from "@/lib/editor/scopes";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const K: any = runInNewContext(`${COMPUTE_KIT_JS}; K`, { Math });
type V3 = [number, number, number];
const inside = (v: number[]) => v.every((x) => x >= 0 && x <= 1);

describe("حيدرا ماكس the colourist · the kit (scene light, a tone scale on luminance, Oklab)", () => {
  it("decodes every camera log exactly as the editor's own «log» field does", () => {
    expect(K.logs.sort()).toEqual(LOGS.map((l) => l.id).sort());
    for (const l of LOGS)
      for (const range of ["video", "full"] as const)
        for (let v = -0.05; v <= 1.05; v += 0.05) {
          const want = decodeLog(l.id, v, range), got = K.logDecode(l.id, v, range);
          if (Number.isFinite(want)) expect(got).toBeCloseTo(want, 9);
        }
    // C-Log3's 18% grey (34.3% on video levels) comes back as 0.18
    expect(K.logDecode("clog3", 0.343, "video")).toBeCloseTo(0.18, 2);
  });

  it("takes the camera's gamut to Rec.709 with the editor's matrices, then exposure and printer lights", () => {
    const c = { r: 0.5, g: 0.42, b: 0.38 };
    const raw = [c.r, c.g, c.b].map((v) => decodeLog("clog3", v)) as V3;
    const m = gamutToRec709("clog3", "camera");
    const want = [0, 1, 2].map((i) => Math.max(0, m[i * 3] * raw[0] + m[i * 3 + 1] * raw[1] + m[i * 3 + 2] * raw[2]));
    const got = K.scene(c, { log: "clog3" });
    for (let i = 0; i < 3; i++) expect(got[i]).toBeCloseTo(want[i], 9);
    const lit = K.scene(c, { log: "clog3", exposure: -1, printer: [1.1, 1, 0.9] });
    expect(lit[0]).toBeCloseTo(want[0] * 0.5 * 1.1, 9);
    expect(lit[2]).toBeCloseTo(want[2] * 0.5 * 0.9, 9);
    // a display picture: its own linear light; an unknown log is an error the program sees
    expect(K.scene({ r: 1, g: 1, b: 1 })).toEqual([1, 1, 1]);
    expect(() => K.scene(c, { log: "nope" })).toThrow(/unknown log/);
  });

  it("tones luminance only: grey lands where asked, monotone, highlights go to white (not pink), blacks clean", () => {
    expect(K.tonescale(0.18, { grey: 0.11, toe: 0 })).toBeCloseTo(0.11, 6);
    let prev = -1;
    for (let y = 0; y < 20; y += 0.05) {
      const t = K.tonescale(y);
      expect(t).toBeGreaterThanOrEqual(prev);
      expect(t).toBeLessThanOrEqual(1.02);
      prev = t;
    }
    expect(K.tonescale(0, { black: 0.004 })).toBe(0);
    // a warm colour keeps its hue in the mids and loses its chroma near white (the path to white)
    const mid = K.oklch(K.display([0.2, 0.12, 0.08]));
    const hot = K.oklch(K.display([20, 12, 8]));
    const raw = K.oklch([0.2, 0.12, 0.08]);
    expect(Math.abs(mid.h - raw.h)).toBeLessThan(3);
    expect(hot.L).toBeGreaterThan(0.9);
    expect(hot.C).toBeLessThan(mid.C);
  });

  it("Oklab both ways; vibrance spares strong colours and greys; the ceiling is soft; nothing leaves the gamut", () => {
    const v: V3 = [0.3, 0.6, 0.2];
    const back = K.fromOklab(K.oklab(v));
    for (let i = 0; i < 3; i++) expect(back[i]).toBeCloseTo(v[i], 6);
    const lch = K.oklch(v), again = K.fromOklch(lch);
    for (let i = 0; i < 3; i++) expect(again[i]).toBeCloseTo(v[i], 6);
    expect(K.vibrant(0, 0.8)).toBe(0);
    expect(K.vibrant(0.03, 0.8)).toBeCloseTo(0.054, 3);
    expect(K.vibrant(0.3, 0.8)).toBe(0.3);
    let prev = 0;
    for (let c = 0; c < 0.5; c += 0.01) {
      const y = K.ceiling(c, 0.24);
      expect(y).toBeGreaterThanOrEqual(prev);
      expect(y).toBeLessThan(0.24);
      prev = y;
    }
    for (let L = 0; L <= 1; L += 0.1) for (let h = 0; h < 360; h += 30) expect(inside(K.inGamut({ L, C: 0.35, h }))).toBe(true);
    // inside already: untouched
    const ok = K.inGamut(K.oklab([0.4, 0.5, 0.3]));
    expect(ok[1]).toBeCloseTo(0.5, 5);
    expect(K.hueBand(51, 51, 24)).toBe(1);
    expect(K.hueBand(51 + 24, 51, 24)).toBe(0);
    expect(K.hueBand(359, 5, 20)).toBeGreaterThan(0.4);
  });

  it("the contract's own example runs as a LUT: finite, inside, and a grey stays grey", () => {
    const code = GRADE_CONTRACT.slice(GRADE_CONTRACT.indexOf("THE SHAPE")).match(/function grade\(c, K\) \{[\s\S]*?\n\}/)![0];
    expect(checkProgram("grade", code).ok).toBe(true);
    const grade = new Function("K", `${code}\n;return grade;`)(K);
    const n = 9;
    for (let b = 0; b < n; b++) for (let g = 0; g < n; g++) for (let r = 0; r < n; r++) {
      const out = grade({ r: r / (n - 1), g: g / (n - 1), b: b / (n - 1) }, K);
      expect(out.every((x: number) => Number.isFinite(x))).toBe(true);
      expect(inside(out)).toBe(true);
    }
    const grey = K.oklch(K.decode(Object.fromEntries(["r", "g", "b"].map((k, i) => [k, grade({ r: 0.45, g: 0.45, b: 0.45 }, K)[i]]))));
    expect(grey.C).toBeLessThan(0.03);
  });

  it("finish(K): only vignette, halation, grain and sharpen, checked like any grade", () => {
    expect(readFinish({ vignette: { amount: 0.2 }, grain: { amount: 9 }, lut: "x", exposure: 3 })).toEqual({ vignette: { amount: 0.2, size: 0.7, soft: 0.5, round: 0.5 }, grain: { amount: 1, size: 0.5 } });
    expect(readFinish({ sharpen: 0.1 })).toEqual({ sharpen: 0.1 });
    expect(readFinish(null)).toEqual({});
    expect(readFinish([1])).toEqual({});
  });

  it("is taught the method, not a look: measure → light → tone on luminance → Oklab → in gamut → look again", () => {
    for (const k of ["MEASURE FIRST", "PRINTER LIGHTS", "TONE ON LUMINANCE ONLY", "COLOUR, IN OKLAB", "SATURATION IS VIBRANCE", "SUBTRACTIVE DENSITY", "STAY IN GAMUT", "LOOK AGAIN", "function finish(K)"]) expect(GRADE_CONTRACT).toContain(k);
    for (const k of ["K.scene(", "K.display(", "K.tonescale(", "K.oklch(", "K.skinKey(", "K.vibrant(", "K.ceiling(", "K.inGamut("]) expect(GRADE_KIT_API).toContain(k);
    expect(GRADE_RUBRIC.find((r) => r.id === "color")!.en).toContain("فاقع");
  });
});

describe("حيدرا ماكس the colourist · the measurements he reads (Oklab, in the scope)", () => {
  const frame = (f: (i: number) => [number, number, number], n = 10000) => {
    const a = new Uint8ClampedArray(n * 4);
    for (let i = 0; i < n; i++) a.set([...f(i), 255], i * 4);
    return a;
  };
  it("finds this skin's Oklab hue, its burning highlights, the greens and the near-whites", () => {
    const s = scopeOf(frame((i) => (i < 4000 ? [200, 150, 120] : i < 4400 ? [255, 205, 170] : i < 7000 ? [70, 110, 40] : [235, 228, 220])), 100, 100);
    expect(s.ok!.skin!.h).toBeGreaterThan(40);
    expect(s.ok!.skin!.h).toBeLessThan(70);
    expect(s.ok!.skin!.hot).toBeCloseTo(4, 0);
    expect(s.ok!.green!.share).toBeCloseTo(26, 0);
    expect(s.ok!.green!.h).toBeGreaterThan(110);
    expect(s.ok!.bright!.share).toBeGreaterThan(25);
    expect(s.ok!.flat).toBe(false);
    expect(scopeLine(s)).toContain("Oklab:");
    // it travels to the server and back
    expect(readScope(JSON.parse(JSON.stringify(s)))!.ok).toEqual(s.ok);
  });
  it("calls flat, lifted, colourless footage log", () => {
    const s = scopeOf(frame((i) => { const v = 70 + Math.round((i / 9999) * 150); return [v, v - 3, v - 5]; }), 100, 100);
    expect(s.ok!.flat).toBe(true);
    expect(scopeLine(s)).toContain("UNDECODED LOG");
  });
  it("an old scope without the Oklab block is still read", () => {
    const s = scopeOf(frame(() => [120, 120, 120]), 100, 100);
    const { ok, ...old } = s;
    void ok;
    expect(readScope(old)!.ok).toBeUndefined();
  });
});
