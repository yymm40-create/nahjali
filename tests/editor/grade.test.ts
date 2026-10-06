import { describe, expect, it } from "vitest";
import { applyLook, curveAt, gamutToRec709, gradeIsNeutral, hueCurveAt, LOGS, LOOKS, logToLinear, maskAt, NEUTRAL_GRADE, parseCube, readGrade, sampleCurve, toCube, lutBytes, type LogId } from "@/lib/editor/grade";

describe("camera logs", () => {
  // 18% grey lands where the makers' papers say (the encoded value of middle grey)
  const grey: [LogId, number][] = [
    ["slog3", 420 / 1023],
    ["slog2", 347 / 1023],
    ["vlog", 0.423],
    ["logc3", 0.391],
    ["logc4", 0.2783],
    ["flog", 0.463],
    ["flog2", 0.392],
    ["bmd5", 0.383],
    ["applelog", 0.488],
    ["redlog3g10", 1 / 3],
    ["clog3", 0.343 * (876 / 1023) + 64 / 1023],
    ["clog2", 0.398 * (876 / 1023) + 64 / 1023],
  ];
  for (const [id, code] of grey) {
    it(`${id}: middle grey decodes to about 0.18`, () => {
      expect(logToLinear(id, code)).toBeGreaterThan(0.15);
      expect(logToLinear(id, code)).toBeLessThan(0.22);
    });
  }
  it("every log is monotone and black stays near zero", () => {
    for (const l of LOGS) {
      if (l.id === "none") continue;
      let last = -Infinity;
      for (let i = 0; i <= 100; i++) {
        const v = logToLinear(l.id, i / 100);
        expect(v).toBeGreaterThanOrEqual(last - 1e-9);
        last = v;
      }
      expect(Math.abs(logToLinear(l.id, l.id === "redlog3g10" || l.id === "hlg" || l.id === "nlog" ? 0 : 0.09))).toBeLessThan(0.08);
    }
  });
  it("gamut matrices keep white white and match the published S-Gamut3.Cine one", () => {
    for (const l of LOGS) {
      const m = gamutToRec709(l.id);
      const w = [m[0] + m[1] + m[2], m[3] + m[4] + m[5], m[6] + m[7] + m[8]];
      for (const c of w) expect(c).toBeCloseTo(1, 3);
    }
    const m = gamutToRec709("slog3");
    expect(m[0]).toBeCloseTo(1.626947, 3);
    expect(m[4]).toBeCloseTo(1.417941, 3);
    expect(m[8]).toBeCloseTo(1.240356, 3);
    expect(gamutToRec709("none")).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });
});

describe("curves", () => {
  it("a straight line stays straight, and the curve goes through its points", () => {
    expect(curveAt([{ x: 0, y: 0 }, { x: 1, y: 1 }], 0.3)).toBeCloseTo(0.3, 6);
    const pts = [{ x: 0, y: 0 }, { x: 0.25, y: 0.1 }, { x: 0.75, y: 0.9 }, { x: 1, y: 1 }];
    expect(curveAt(pts, 0.25)).toBeCloseTo(0.1, 6);
    expect(curveAt(pts, 0.75)).toBeCloseTo(0.9, 6);
    // monotone: no overshoot between the points
    let last = 0;
    for (let i = 0; i <= 100; i++) {
      const v = curveAt(pts, i / 100);
      expect(v).toBeGreaterThanOrEqual(last - 1e-9);
      last = v;
    }
  });
  it("hue curves wrap around", () => {
    const pts = [{ x: 0.1, y: 0.8 }, { x: 0.5, y: 0.5 }];
    expect(hueCurveAt(pts, 0.1)).toBeCloseTo(0.8, 6);
    expect(hueCurveAt(pts, 1.1)).toBeCloseTo(0.8, 6);
    expect(hueCurveAt(pts, 0)).toBeCloseTo(hueCurveAt(pts, 1), 6);
    expect(sampleCurve(pts, 256, true)).toHaveLength(256);
  });
});

describe("grade model", () => {
  it("reads a patch over the neutral grade and clamps", () => {
    const g = readGrade({ ...NEUTRAL_GRADE, exposure: 9, contrast: "x", log: "slog3", secondaries: [{ hue: 400 }] })!;
    expect(g.exposure).toBe(5);
    expect(g.contrast).toBe(1);
    expect(g.log).toBe("slog3");
    expect(g.secondaries[0].hue).toBe(180);
    expect(g.secondaries[0].key.hueWidth).toBeGreaterThan(0);
  });
  it("knows what is neutral", () => {
    expect(gradeIsNeutral(null)).toBe(true);
    expect(gradeIsNeutral(readGrade(NEUTRAL_GRADE))).toBe(true);
    expect(gradeIsNeutral(readGrade({ ...NEUTRAL_GRADE, temp: 0.2 }))).toBe(false);
  });
  it("looks apply and keep the log, the window and the secondaries", () => {
    const base = readGrade({ ...NEUTRAL_GRADE, log: "vlog", mask: { kind: "rect" }, secondaries: [{}] })!;
    for (const l of LOOKS) {
      const g = applyLook(base, l);
      expect(g.look).toBe(l.id);
      expect(g.log).toBe("vlog");
      expect(g.mask?.kind).toBe("rect");
      expect(g.secondaries).toHaveLength(1);
      expect(gradeIsNeutral(g)).toBe(false);
    }
  });
  it("a mask moves between its points", () => {
    const m = readGrade({ mask: { kind: "ellipse", keys: [{ t: 0, x: 0.2, y: 0.2 }, { t: 1000, x: 0.8, y: 0.8 }] } })!.mask!;
    expect(maskAt(m, -5)).toEqual({ x: 0.2, y: 0.2 });
    expect(maskAt(m, 500).x).toBeCloseTo(0.5, 6);
    expect(maskAt(m, 5000)).toEqual({ x: 0.8, y: 0.8 });
  });
});

describe(".cube", () => {
  const identity = (n: number) => {
    const lines = [`TITLE "id"`, `LUT_3D_SIZE ${n}`];
    for (let b = 0; b < n; b++) for (let g = 0; g < n; g++) for (let r = 0; r < n; r++) lines.push(`${r / (n - 1)} ${g / (n - 1)} ${b / (n - 1)}`);
    return lines.join("\n");
  };
  it("parses an identity cube (red fastest) and keeps its name", () => {
    const l = parseCube(identity(3));
    expect(l.name).toBe("id");
    expect(l.size).toBe(3);
    const b = lutBytes(l);
    expect(Array.from(b.slice(0, 6))).toEqual([0, 0, 0, 128, 0, 0]);
    expect(Array.from(b.slice(-3))).toEqual([255, 255, 255]);
  });
  it("resamples big cubes down to 33 and reads 1D cubes", () => {
    expect(parseCube(identity(65)).size).toBe(33);
    const one = parseCube("LUT_1D_SIZE 2\n0 0 0\n1 0.5 1\n");
    expect(one.size).toBe(17);
    expect(Array.from(lutBytes(one).slice(-3))).toEqual([255, 128, 255]);
  });
  it("writes a cube that parses back", () => {
    const l = parseCube(toCube("round", 3, lutBytes(parseCube(identity(3)))));
    expect(l.name).toBe("round");
    expect(Array.from(lutBytes(l).slice(-3))).toEqual([255, 255, 255]);
  });
  it("refuses other files", () => {
    expect(() => parseCube("hello")).toThrow();
  });
});
