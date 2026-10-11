import { describe, expect, it } from "vitest";
import { apply, applyAll } from "@/lib/editor/commands";
import { duration, emptyTimeline, NEW_KEY, readKey, readTimeline } from "@/lib/editor/model";
import { KEYMAPS, keyTable } from "@/lib/editor/shortcuts";
import { nextRate, rateLabel, SHUTTLE_MAX } from "@/lib/editor/shuttle";
import { PREVIEW_ZOOMS, previewSize, readPreviewZoom, stepZoom } from "@/lib/editor/preview-zoom";
import { classifyGpu, describeDevice, planFor, readPerf, type DeviceReport } from "@/lib/editor/perf";
import { hairAlpha, keyMatte, keyParams, keyPixels, steadyMatte } from "@/lib/editor/key-math";
import { makeScene, score } from "./key-scenes";
import { lib, main, sound, spans, video } from "./helpers";

// The owner's six notes on «حيدرة كت»: the magnet on every track, clips (not words) selected, the preview's zoom,
// the J/K/L shuttle, hair and flicker in the key, and the performance choice.

const assets = lib(video("a", 4000), video("b", 6000), video("c", 2000), sound("m", 20000));
const built = () => applyAll(emptyTimeline("16:9"), [{ type: "add_clip", assetId: "a" }, { type: "add_clip", assetId: "b" }, { type: "add_clip", assetId: "c" }, { type: "add_clip", assetId: "m" }], assets).timeline;

describe("1 — «مغناطيس كل المسارات»", () => {
  it("is off in old and new projects, and needs the magnet", () => {
    expect(emptyTimeline("9:16").magnetAll).toBe(false);
    expect(readTimeline({ magnetic: true }).magnetAll).toBe(false);
    expect(readTimeline({ magnetic: true, magnetAll: true }).magnetAll).toBe(true);
    // without the magnet the all-tracks magnet means nothing
    expect(readTimeline({ magnetic: false, magnetAll: true }).magnetAll).toBe(false);
    const t = apply(apply(emptyTimeline("9:16"), { type: "set_magnet_all", on: true }, assets).timeline, { type: "set_magnetic", on: false }, assets).timeline;
    expect(t.magnetAll).toBe(false);
  });
  it("turning it on turns the magnet on with it", () => {
    const off = apply(emptyTimeline("9:16"), { type: "set_magnetic", on: false }, assets).timeline;
    const on = apply(off, { type: "set_magnet_all", on: true }, assets).timeline;
    expect(on.magnetic).toBe(true);
    expect(on.magnetAll).toBe(true);
  });
  it("deleting a clip takes its seconds out of every track — above and below — and pulls the rest back", () => {
    const t = apply(built(), { type: "set_magnet_all", on: true }, assets).timeline;
    expect(duration(t)).toBe(20000);
    const b = main(t).clips[1].id;
    const out = apply(t, { type: "delete", clipIds: [b], ripple: false }, assets).timeline;
    // the main track: a then c, no gap
    expect(spans(out)).toEqual([["a", 0, 4000], ["c", 4000, 6000]]);
    // the sound lost the same six seconds (4–10 s): cut there, its two pieces now 14 s long, so everything stays in step
    expect(spans(out, "audio")).toEqual([["m", 0, 4000], ["m", 4000, 14000]]);
    expect(duration(out)).toBe(14000);
  });
  it("without it, a delete leaves the other tracks alone", () => {
    const t = built();
    const b = main(t).clips[1].id;
    const out = apply(t, { type: "delete", clipIds: [b], ripple: true }, assets).timeline;
    expect(spans(out)).toEqual([["a", 0, 4000], ["c", 4000, 6000]]);
    expect(spans(out, "audio")).toEqual([["m", 0, 20000]]);
  });
  it("refuses while a track in the span is locked", () => {
    let t = apply(built(), { type: "set_magnet_all", on: true }, assets).timeline;
    const audio = t.tracks.find((x) => x.kind === "audio")!;
    t = apply(t, { type: "update_track", trackId: audio.id, patch: { locked: true } }, assets).timeline;
    expect(() => apply(t, { type: "delete", clipIds: [main(t).clips[1].id], ripple: false }, assets)).toThrow(/مقفول/);
  });
});

describe("4 — the J/K/L shuttle", () => {
  it("our own keys have J, K and L like the big programs", () => {
    expect(KEYMAPS.jawad.playFwd).toEqual(["L"]);
    expect(KEYMAPS.jawad.back).toEqual(["J"]);
    expect(KEYMAPS.jawad.pause).toEqual(["K"]);
    const t = keyTable("jawad");
    expect(t.get("L")?.action).toBe("playFwd");
    expect(t.get("J")?.action).toBe("back");
    expect(t.get("K")?.action).toBe("pause");
  });
  it("each press the same way doubles the speed up to ×8; the other way turns around at ×1", () => {
    expect(nextRate(1, false, 1)).toBe(1);
    expect(nextRate(1, true, 1)).toBe(2);
    expect(nextRate(2, true, 1)).toBe(4);
    expect(nextRate(4, true, 1)).toBe(8);
    expect(nextRate(8, true, 1)).toBe(SHUTTLE_MAX);
    expect(nextRate(4, true, -1)).toBe(-1);
    expect(nextRate(-1, true, -1)).toBe(-2);
    expect(nextRate(-8, true, -1)).toBe(-8);
    expect(nextRate(-2, false, 1)).toBe(1);
  });
  it("labels the speed", () => {
    expect(rateLabel(1)).toBe("");
    expect(rateLabel(4)).toBe("×4");
    expect(rateLabel(-2)).toBe("◀ ×2");
  });
});

describe("3 — «تكبير المعاينة»", () => {
  it("offers eight sizes, «ملء» among them", () => {
    expect(PREVIEW_ZOOMS).toHaveLength(8);
    expect(PREVIEW_ZOOMS.map((z) => z.id)).toContain("fit");
    expect(PREVIEW_ZOOMS.map((z) => z.id)).toContain("120");
    expect(readPreviewZoom("150")).toBe("150");
    expect(readPreviewZoom("nope")).toBe("fit");
  });
  it("sizes the picture from the stage and the frame's shape", () => {
    // a 16:9 frame on a 1000×500 stage fits at 888×500
    const fit = previewSize(1000, 500, 1920, 1080, "fit");
    expect(fit).toEqual({ w: 889, h: 500, fits: true });
    const big = previewSize(1000, 500, 1920, 1080, "120");
    expect(big.w).toBe(1067);
    expect(big.fits).toBe(false);
    const half = previewSize(1000, 500, 1080, 1920, "50");
    expect(half.h).toBe(250);
    expect(half.fits).toBe(true);
    // no stage yet: the frame's own size
    expect(previewSize(0, 0, 1080, 1920, "200")).toEqual({ w: 1080, h: 1920, fits: true });
  });
  it("steps through the sizes in order", () => {
    expect(stepZoom("fit", 1)).toBe("120");
    expect(stepZoom("fit", -1)).toBe("75");
    expect(stepZoom("400", 1)).toBe("400");
    expect(stepZoom("25", -1)).toBe("25");
  });
});

describe("5 — the key's hair edge and steadiness", () => {
  it("is on by default and read from stored keys", () => {
    expect(NEW_KEY.hair).toBe(0.5);
    expect(NEW_KEY.steady).toBe(0.5);
    const k = readKey({ kind: "chroma", color: "#00ff00" })!;
    expect(k.hair).toBe(0.5);
    expect(readKey({ kind: "chroma", color: "#00ff00", hair: 2, steady: -1 })).toMatchObject({ hair: 1, steady: 0 });
  });
  it("a strand of hair over the screen keeps the alpha of its mix; the screen's shadow keeps none", () => {
    const P = keyParams({ color: "#00b140", tolerance: 0.4, soft: 0.15, spill: 0.6, choke: 0, hair: 1 });
    const screen = [0, 0.69, 0.25];
    const hair = [0.17, 0.12, 0.09];
    const mix = (a: number) => screen.map((c, i) => c * (1 - a) + hair[i] * a) as [number, number, number];
    expect(hairAlpha(...mix(0), P)).toBe(0);
    // the shadow: the same colour, darker — still no alpha
    expect(hairAlpha(screen[0] * 0.5, screen[1] * 0.5, screen[2] * 0.5, P)).toBe(0);
    const a30 = hairAlpha(...mix(0.3), P);
    const a50 = hairAlpha(...mix(0.5), P);
    expect(a30).toBeGreaterThan(0.05);
    expect(a50).toBeGreaterThan(a30);
    expect(a50).toBeGreaterThan(0.3);
    expect(a50).toBeLessThan(0.75);
  });
  it("on the training shots the edge pixels come closer to their true mix, and the screen still goes", () => {
    let errOff = 0,
      errOn = 0,
      n = 0,
      ok = 0;
    const N = 300;
    for (let seed = 1; seed <= N; seed++) {
      const s = makeScene(seed);
      const color = `#${s.screen.map((c) => Math.round(c * 255).toString(16).padStart(2, "0")).join("")}`;
      const off = keyPixels(new Uint8ClampedArray(s.px), s.w, s.h, { color, tolerance: 0.35, soft: 0.15, spill: 0, choke: 0, hair: 0 });
      const on = keyPixels(new Uint8ClampedArray(s.px), s.w, s.h, { color, tolerance: 0.35, soft: 0.15, spill: 0, choke: 0, hair: 0.5 });
      const r = score(s, on);
      if (r.removed >= 0.97 && r.kept >= 0.97) ok++;
      for (let i = 0; i < s.w * s.h; i++) {
        if (s.truth[i] !== 2) continue;
        // an edge pixel of the person over the screen: its alpha should be partial, not 0 or 1
        const want = 0.5;
        errOff += Math.abs(off[i * 4 + 3] / 255 - want);
        errOn += Math.abs(on[i * 4 + 3] / 255 - want);
        n++;
      }
    }
    expect(ok / N).toBeGreaterThanOrEqual(0.97);
    expect(errOn / n).toBeLessThan(errOff / n);
  }, 60_000);
  it("steadiness calms a flicker of noise and lets a real move through", () => {
    const prev = new Float32Array([0.5, 0.5, 1, 0]);
    const cur = new Float32Array([0.6, 0.4, 0, 1]);
    const out = steadyMatte(new Float32Array(cur), prev, 1);
    // the small changes are pulled most of the way back
    expect(Math.abs(out[0] - 0.5)).toBeLessThan(0.03);
    expect(Math.abs(out[1] - 0.5)).toBeLessThan(0.03);
    // the big ones (a move) stay
    expect(out[2]).toBe(0);
    expect(out[3]).toBe(1);
    // nothing at 0, or without a previous frame
    expect(steadyMatte(new Float32Array(cur), prev, 0)).toEqual(cur);
    expect(steadyMatte(new Float32Array(cur), null, 1)).toEqual(cur);
    expect(steadyMatte(new Float32Array(cur), new Float32Array(2), 1)).toEqual(cur);
  });
  it("the whole matte of a frame leans on the previous one", () => {
    const s = makeScene(7);
    const color = `#${s.screen.map((c) => Math.round(c * 255).toString(16).padStart(2, "0")).join("")}`;
    const P = keyParams({ color, tolerance: 0.35, soft: 0.15, spill: 0, choke: 0, steady: 1 });
    const m1 = keyMatte(new Uint8ClampedArray(s.px), s.w, s.h, P, null);
    // the same picture with noise on it: the second matte, steadied, moves less from the first than the raw one does
    const noisy = new Uint8ClampedArray(s.px);
    for (let i = 0; i < noisy.length; i += 4) {
      const d = ((i * 2654435761) % 21) - 10;
      noisy[i] += d;
      noisy[i + 1] += d;
      noisy[i + 2] += d;
    }
    const raw = keyMatte(noisy, s.w, s.h, { ...P, steady: 0 }, null);
    const calm = keyMatte(noisy, s.w, s.h, P, m1);
    const diff = (a: Float32Array, b: Float32Array) => a.reduce((t, v, i) => t + Math.abs(v - b[i]), 0);
    expect(diff(calm, m1)).toBeLessThan(diff(raw, m1));
  });
});

describe("6 — «الأداء»", () => {
  const dev = (renderer: string, more: Partial<DeviceReport> = {}): DeviceReport => ({ cores: 8, renderer, webgl2: true, webcodecs: true, memoryGB: 16, bench: null, ...more });
  it("knows the graphics cards by name", () => {
    expect(classifyGpu("ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)")).toBe("discrete");
    expect(classifyGpu("ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11)")).toBe("integrated");
    expect(classifyGpu("ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11)")).toBe("integrated");
    expect(classifyGpu("ANGLE (AMD, AMD Radeon RX 7800 XT, D3D11)")).toBe("discrete");
    expect(classifyGpu("ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Pro, Unspecified Version)")).toBe("unified");
    expect(classifyGpu("Google SwiftShader")).toBe("software");
    expect(classifyGpu("Mali-G78")).toBe("integrated");
    expect(classifyGpu("")).toBe("none");
  });
  it("reads a kept choice safely", () => {
    expect(readPerf(null)).toEqual({ mode: "auto", share: 100 });
    expect(readPerf({ mode: "gpu", share: 50 })).toEqual({ mode: "gpu", share: 50 });
    expect(readPerf({ mode: "x", share: 33 })).toEqual({ mode: "auto", share: 100 });
  });
  it("automatic: the timeline leans on the processor, the export on the card's encoder", () => {
    const d = dev("NVIDIA GeForce RTX 3060");
    const tl = planFor({ mode: "auto", share: 100 }, d, "timeline");
    expect(tl.useGpu).toBe(true);
    expect(tl.power).toBe("default");
    expect(tl.parallel).toBe(4);
    expect(tl.maxSide).toBe(1920);
    const r = planFor({ mode: "auto", share: 100 }, d, "render");
    expect(r.encode).toBe("prefer-hardware");
    expect(r.power).toBe("high-performance");
    expect(r.why.join(" ")).toMatch(/NVENC/);
  });
  it("the processor only, the integrated card, and the share", () => {
    const d = dev("Intel Iris Xe", { cores: 4 });
    const cpu = planFor({ mode: "cpu", share: 100 }, d, "render");
    expect(cpu.useGpu).toBe(false);
    expect(cpu.encode).toBe("prefer-software");
    expect(cpu.power).toBe("low-power");
    const ig = planFor({ mode: "integrated", share: 50 }, d, "timeline");
    expect(ig.power).toBe("low-power");
    expect(ig.parallel).toBe(2);
    expect(ig.maxSide).toBe(1080);
    expect(planFor({ mode: "auto", share: 25 }, d, "timeline").parallel).toBe(1);
    // the export always works at full size
    expect(planFor({ mode: "auto", share: 25 }, d, "render").maxSide).toBe(1920);
  });
  it("a software renderer or a measured slow card hands the shaders to the processor; no WebCodecs means no hint", () => {
    expect(planFor({ mode: "auto", share: 100 }, dev("Google SwiftShader"), "timeline").useGpu).toBe(false);
    expect(planFor({ mode: "gpu", share: 100 }, dev("Google SwiftShader"), "timeline").useGpu).toBe(false);
    const slow = planFor({ mode: "auto", share: 100 }, dev("Intel UHD 620", { bench: { gpuMs: 900, cpuMs: 300 } }), "timeline");
    expect(slow.useGpu).toBe(false);
    expect(slow.why.join(" ")).toMatch(/القياس/);
    expect(planFor({ mode: "gpu", share: 100 }, dev("Intel UHD 620", { bench: { gpuMs: 900, cpuMs: 300 } }), "timeline").useGpu).toBe(true);
    expect(planFor({ mode: "gpu", share: 100 }, dev("NVIDIA RTX", { webcodecs: false }), "render").encode).toBe("no-preference");
  });
  it("describes the device in a line", () => {
    const line = describeDevice(dev("ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)"));
    expect(line).toMatch(/8 أنوية/);
    expect(line).toMatch(/Apple/);
    expect(line).toMatch(/WebCodecs ✓/);
  });
});
