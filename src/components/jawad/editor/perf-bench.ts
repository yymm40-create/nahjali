// «الأداء» on the page: the person's choice kept on this device, the device measured once (its GPU by name and by a
// short timing of the same keying work on the GPU and on the CPU), and the plan every part of the editor asks for —
// the WebGL power preference, the WebCodecs encoder hint (checked with isConfigSupported before it is used), how
// many background jobs run at once, and the preview's GPU working size. The rules: src/lib/editor/perf.ts.

import { keyPixels } from "@/lib/editor/key-math";
import { DEFAULT_PERF, planFor, readPerf, PERF_KEY, type DeviceReport, type HwHint, type PerfPlan, type PerfPrefs, type Phase } from "@/lib/editor/perf";

let prefs: PerfPrefs | null = null;
let device: DeviceReport | null = null;
const listeners = new Set<() => void>();

export function loadPerf(): PerfPrefs {
  if (prefs) return prefs;
  try {
    prefs = readPerf(JSON.parse(localStorage.getItem(PERF_KEY) ?? "null"));
  } catch {
    prefs = { ...DEFAULT_PERF };
  }
  return prefs;
}

export function savePerf(p: PerfPrefs) {
  prefs = readPerf(p);
  try {
    localStorage.setItem(PERF_KEY, JSON.stringify(prefs));
  } catch {
    /* not kept */
  }
  for (const fn of listeners) fn();
}

/** Called when the choice changes (the GL contexts make themselves again with the new power). */
export function onPerfChange(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

/** What the device is, by name (no timing). */
export function deviceNow(): DeviceReport {
  if (device) return device;
  const n = typeof navigator === "undefined" ? ({} as Navigator & { deviceMemory?: number }) : (navigator as Navigator & { deviceMemory?: number });
  let renderer = "";
  let webgl2 = false;
  try {
    const c = document.createElement("canvas");
    const g = c.getContext("webgl2");
    if (g) {
      webgl2 = true;
      const dbg = g.getExtension("WEBGL_debug_renderer_info");
      renderer = String(dbg ? g.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER));
      g.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    /* none */
  }
  device = {
    cores: n.hardwareConcurrency || 4,
    renderer,
    webgl2,
    webcodecs: typeof VideoEncoder !== "undefined" && typeof VideoDecoder !== "undefined",
    memoryGB: n.deviceMemory ?? null,
    bench: null,
  };
  return device;
}

/**
 * «قيّم جهازي»: the same keying work timed on the GPU (a WebGL2 pass over a 640×360 picture, 24 times) and on the CPU
 * (key-math on 320×180, scaled to the same pixels). Kept for this page; the automatic mode reads it.
 */
export async function benchDevice(): Promise<DeviceReport> {
  const d = deviceNow();
  const W = 640,
    H = 360;
  const noise = document.createElement("canvas");
  noise.width = W;
  noise.height = H;
  const g2 = noise.getContext("2d")!;
  const img = g2.createImageData(W, H);
  for (let i = 0; i < img.data.length; i += 4) {
    const screen = (i / 4) % W > W * 0.35;
    img.data[i] = screen ? 10 + ((i * 7) % 20) : 200;
    img.data[i + 1] = screen ? 170 + ((i * 13) % 30) : 150;
    img.data[i + 2] = screen ? 60 + ((i * 3) % 20) : 130;
    img.data[i + 3] = 255;
  }
  g2.putImageData(img, 0, 0);
  const key = { kind: "chroma" as const, color: "#0ab040", tolerance: 0.4, soft: 0.15, spill: 0.6, choke: 0.2, clean: 0.15, fill: 0.15, low: 0, high: 0, hair: 0.5, steady: 0.5, invert: false, show: false };
  // the CPU: 320×180, 6 times → scaled to 640×360 × 24
  const small = document.createElement("canvas");
  small.width = W / 2;
  small.height = H / 2;
  const gs = small.getContext("2d", { willReadFrequently: true })!;
  gs.drawImage(noise, 0, 0, W / 2, H / 2);
  const px = gs.getImageData(0, 0, W / 2, H / 2);
  const t0 = performance.now();
  for (let i = 0; i < 6; i++) keyPixels(new Uint8ClampedArray(px.data), W / 2, H / 2, key);
  const cpuMs = ((performance.now() - t0) / 6) * 4 * 24;
  // the GPU: the real shader, 24 frames, read back at the end so the work is done
  let gpuMs = Number.POSITIVE_INFINITY;
  if (d.webgl2) {
    const { keyFrame } = await import("./key-gl");
    const t1 = performance.now();
    let out: HTMLCanvasElement | null = null;
    for (let i = 0; i < 24; i++) out = keyFrame(noise, W, H, key, { id: "bench", ms: i * 33 });
    if (out) out.getContext("webgl2")?.readPixels(0, 0, 1, 1, 0x1908, 0x1401, new Uint8Array(4));
    gpuMs = out ? performance.now() - t1 : Number.POSITIVE_INFINITY;
  }
  device = { ...d, bench: { gpuMs: Math.round(gpuMs * 10) / 10, cpuMs: Math.round(cpuMs * 10) / 10 } };
  return device;
}

/** The plan for a phase, from the kept choice and what is known of the device. */
export function perfPlan(phase: Phase): PerfPlan {
  return planFor(loadPerf(), deviceNow(), phase);
}

/** WebGL's powerPreference for the editor's contexts (the timeline's plan: that is where they live). */
export function glPower(): "high-performance" | "low-power" | "default" {
  try {
    return perfPlan("timeline").power;
  } catch {
    return "default";
  }
}

/**
 * The encoder hint the export (or a light copy) wants; the caller confirms with the browser that an encoder with it
 * exists for its very configuration (mediabunny's canEncodeVideo) and otherwise uses «no-preference» — never an
 * error on the way.
 */
export function wantedEncode(): HwHint {
  if (typeof VideoEncoder === "undefined") return "no-preference";
  return perfPlan("render").encode;
}
