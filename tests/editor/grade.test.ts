import { describe, expect, it } from "vitest";
import { apply, applyAll } from "@/lib/editor/commands";
import { emptyTimeline, readTimeline } from "@/lib/editor/model";
import { lib, video } from "./helpers";
import { applyLook, curveAt, decodeLog, filmic, srgbEncode, gamutToRec709, gradeIsNeutral, hueCurveAt, LOGS, LOOKS, logToLinear, maskAt, NEUTRAL_GRADE, parseCube, readGrade, sampleCurve, toCube, lutBytes, type LogId } from "@/lib/editor/grade";

describe("camera logs", () => {
  // 18% grey as the browser hands it over for a video-levels file (64 → 0, 940 → 1), per the makers' papers
  const ire = (code10: number) => (code10 - 64) / 876;
  const grey: [LogId, number][] = [
    ["slog3", ire(420)],
    ["slog2", ire(347)],
    ["vlog", ire(433)],
    ["logc3", ire(400)],
    ["logc4", ire(0.2783 * 1023)],
    ["flog", ire(470)],
    ["flog2", ire(0.392 * 1023)],
    ["bmd5", ire(0.383 * 1023)],
    ["redlog3g10", ire(1023 / 3)],
    ["nlog", ire(0.3628 * 1023)],
    // Canon's papers give grey on video levels already (IRE/100)
    ["clog3", 0.343],
    ["clog2", 0.398],
    ["clog", 0.3434],
    ["applelog", 0.488],
  ];
  for (const [id, v] of grey) {
    it(`${id}: middle grey decodes to 0.18 from the browser's value`, () => {
      expect(decodeLog(id, v, "video")).toBeGreaterThan(0.17);
      expect(decodeLog(id, v, "video")).toBeLessThan(0.19);
    });
  }
  it("a full-range file gives the same scene light", () => {
    // the same grey stored as full code values
    expect(decodeLog("slog3", 420 / 1023, "full")).toBeCloseTo(decodeLog("slog3", ire(420), "video"), 5);
    expect(decodeLog("clog3", (0.343 * 876 + 64) / 1023, "full")).toBeCloseTo(decodeLog("clog3", 0.343, "video"), 5);
  });
  it("after the tone map grey shows at ~41% like DaVinci's CST, black stays black, white rolls off", () => {
    expect(srgbEncode(filmic(0.18))).toBeGreaterThan(0.39);
    expect(srgbEncode(filmic(0.18))).toBeLessThan(0.43);
    expect(srgbEncode(filmic(0))).toBeLessThan(0.01);
    expect(srgbEncode(filmic(1))).toBeLessThan(0.9);
    expect(srgbEncode(filmic(8))).toBeGreaterThan(0.95);
  });
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
    expect(gamutToRec709("clog3", "rec709")).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    const r2020 = gamutToRec709("clog3", "rec2020");
    expect(r2020[0]).toBeCloseTo(1.660491, 3);
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

describe("grading layers", () => {
  const assets = lib(video("a", 5000));
  const start = () => applyAll(emptyTimeline("16:9"), [{ type: "add_clip", assetId: "a" }], assets).timeline;
  const clipOf = (t: ReturnType<typeof start>) => t.tracks.find((x) => x.kind === "video")!.clips[0];

  it("a change to layer 2 makes two layers, the first one untouched", () => {
    let t = start();
    const id = clipOf(t).id;
    t = apply(t, { type: "update_clip", clipId: id, patch: { grade: { exposure: 0.5 } } }, assets).timeline;
    t = apply(t, { type: "update_clip", clipId: id, patch: { grade: { layer: 1, saturation: 0.5, name: "البشرة" } } }, assets).timeline;
    const g = clipOf(t).grades;
    expect(g).toHaveLength(2);
    expect(g[0].exposure).toBe(0.5);
    expect(g[0].saturation).toBe(1);
    expect(g[1].saturation).toBe(0.5);
    expect(g[1].name).toBe("البشرة");
  });
  it("layers switch off, get replaced, and clear", () => {
    let t = start();
    const id = clipOf(t).id;
    t = apply(t, { type: "update_clip", clipId: id, patch: { grades: [{ ...NEUTRAL_GRADE, temp: 0.3 }, { ...NEUTRAL_GRADE, on: false }] } }, assets).timeline;
    expect(clipOf(t).grades.map((g) => g.on)).toEqual([true, false]);
    expect(gradeIsNeutral(clipOf(t).grades[1])).toBe(true);
    t = apply(t, { type: "update_clip", clipId: id, patch: { grade: null } }, assets).timeline;
    expect(clipOf(t).grades).toEqual([]);
  });
  it("a saved clip with the old single grade opens as layer 1", () => {
    const t = start();
    const raw = JSON.parse(JSON.stringify(t));
    const c = raw.tracks.find((x: { kind: string }) => x.kind === "video").clips[0];
    delete c.grades;
    c.grade = { ...NEUTRAL_GRADE, log: "clog3", compress: 0.4 };
    const read = readTimeline(raw);
    const g = read.tracks.find((x) => x.kind === "video")!.clips[0].grades;
    expect(g).toHaveLength(1);
    expect(g[0].log).toBe("clog3");
    expect(g[0].compress).toBe(0.4);
  });
});

describe("grading by «حيدرة»", () => {
  const assets = lib(video("a", 5000));
  const start = () => applyAll(emptyTimeline("16:9"), [{ type: "add_clip", assetId: "a" }], assets).timeline;
  const clipOf = (t: ReturnType<typeof start>) => t.tracks.find((x) => x.kind === "video")!.clips[0];

  it("wheels and curves merge field by field", () => {
    let t = start();
    const id = clipOf(t).id;
    t = apply(t, { type: "update_clip", clipId: id, patch: { grade: { gain: { rgb: [0.04, 0.01, -0.04], y: 0 }, curves: { ...NEUTRAL_GRADE.curves, r: [{ x: 0, y: 0.05 }, { x: 1, y: 1 }] } } } }, assets).timeline;
    t = apply(t, { type: "update_clip", clipId: id, patch: { grade: { gain: { y: 0.1 } as never, curves: { master: [{ x: 0, y: 0 }, { x: 0.25, y: 0.22 }, { x: 1, y: 1 }] } as never } } }, assets).timeline;
    const g = clipOf(t).grades[0];
    expect(g.gain.rgb).toEqual([0.04, 0.01, -0.04]);
    expect(g.gain.y).toBe(0.1);
    expect(g.curves.r[0].y).toBe(0.05);
    expect(g.curves.master).toHaveLength(3);
  });
  it("a look by its id is applied, keeping the log, then the rest of the patch on top", () => {
    let t = start();
    const id = clipOf(t).id;
    t = apply(t, { type: "update_clip", clipId: id, patch: { grade: { log: "clog3", exposure: 0.3 } } }, assets).timeline;
    t = apply(t, { type: "update_clip", clipId: id, patch: { grade: { look: "teal-orange", amount: 0.6 } } }, assets).timeline;
    const g = clipOf(t).grades[0];
    expect(g.look).toBe("teal-orange");
    expect(g.log).toBe("clog3");
    expect(g.amount).toBe(0.6);
    expect(g.split.shadowSat).toBeGreaterThan(0);
  });
  it("Claude is shown the grade, the crop and the timelines", async () => {
    const { context } = await import("@/lib/editor/assistant-core");
    let t = start();
    const id = clipOf(t).id;
    t = apply(t, { type: "update_clip", clipId: id, patch: { grade: { temp: 0.2, name: "أساسي" }, crop: { l: 0.1 } } }, assets).timeline;
    t = apply(t, { type: "seq_new", name: "نسخة قصيرة" }, assets).timeline;
    t = apply(t, { type: "seq_open", id: t.seqs![0].id }, assets).timeline;
    const ctx = context(t, [], new Map(), {});
    const c = ctx.tracks.flatMap((x) => x.clips).find((x) => x.id === id)!;
    expect(c.grades).toEqual([{ name: "أساسي", temp: 0.2 }]);
    expect(c.crop?.l).toBe(0.1);
    expect(ctx.sequences).toHaveLength(2);
    expect(ctx.sequences!.filter((s) => "open" in s)).toHaveLength(1);
  });
});
