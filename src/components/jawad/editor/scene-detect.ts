// «التقطيع الذكي» in the browser: small frames of a video, sampled across a part of it, then the shot changes found in
// them (scenes.ts) and each one pinned to its exact frame. The browser's own video decoder does the work (WebCodecs,
// through mediabunny); where it can't read the file, a hidden <video> is seeked instead (slower).

import { ALL_FORMATS, CanvasSink, Input, UrlSource } from "mediabunny";
import { findCuts, frameFeature, sharpenCut, type Sensitivity } from "@/lib/editor/scenes";

const W = 48;
const H = 27;

export interface SceneProgress {
  done: number;
  total: number;
}

/** A sampling step that keeps long videos quick and short ones precise (seconds). */
export const sampleStep = (seconds: number) => (seconds <= 90 ? 0.25 : seconds <= 600 ? 0.4 : 0.6);

/** The moments (seconds in the file) where the shot changes between `from` and `to`. */
export async function detectScenes(url: string, from: number, to: number, o: { sensitivity?: Sensitivity; onProgress?: (p: SceneProgress) => void; signal?: AbortSignal } = {}) {
  const step = sampleStep(to - from);
  const times: number[] = [];
  for (let i = 0; from + i * step <= to + 1e-6; i++) times.push(Math.round((from + i * step) * 1000) / 1000);
  const reader = (await webCodecsReader(url).catch(() => null)) ?? (await elementReader(url));
  try {
    const feats = await reader.features(times, (i) => o.onProgress?.({ done: i, total: times.length }), o.signal);
    const rough = findCuts(times, feats, o.sensitivity ?? "normal");
    // each change pinned to its frame: dense samples between the two around it
    const exact: number[] = [];
    for (const c of rough) {
      if (o.signal?.aborted) throw new DOMException("aborted", "AbortError");
      // (counted in frames, so the last one is exactly the sample after the change)
      const n = Math.max(1, Math.ceil((c.after - c.before) * 30 - 1e-6));
      const dense = Array.from({ length: n + 1 }, (_, i) => Math.round((c.before + ((c.after - c.before) * i) / n) * 1000) / 1000);
      const f = await reader.features(dense, () => {}, o.signal);
      exact.push(sharpenCut(dense, f) ?? c.at);
    }
    return exact;
  } finally {
    reader.close();
  }
}

interface Reader {
  features: (times: number[], tick: (i: number) => void, signal?: AbortSignal) => Promise<Float32Array[]>;
  close: () => void;
}

const pixels = (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) => ctx.getImageData(0, 0, W, H).data;

async function webCodecsReader(url: string): Promise<Reader> {
  const input = new Input({ source: new UrlSource(url), formats: ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack();
  if (!track || !(await track.canDecode())) throw new Error("no decoder");
  const sink = new CanvasSink(track, { width: W, height: H, fit: "fill" });
  const scratch = new OffscreenCanvas(W, H).getContext("2d", { willReadFrequently: true })!;
  return {
    async features(times, tick, signal) {
      const out: Float32Array[] = [];
      let last: Float32Array | null = null;
      for await (const wc of sink.canvasesAtTimestamps(times)) {
        if (signal?.aborted) throw new DOMException("aborted", "AbortError");
        if (wc) {
          scratch.clearRect(0, 0, W, H);
          scratch.drawImage(wc.canvas, 0, 0, W, H);
          last = frameFeature(pixels(scratch), W, H);
        }
        // (a moment before the first frame repeats the next one found)
        out.push(last ?? new Float32Array(24 + 64));
        tick(out.length);
      }
      return out;
    },
    close: () => input.dispose?.(),
  };
}

async function elementReader(url: string): Promise<Reader> {
  const v = document.createElement("video");
  v.crossOrigin = "anonymous";
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.src = url;
  await new Promise<void>((ok, fail) => {
    v.onloadeddata = () => ok();
    v.onerror = () => fail(new Error("ما قدرنا نقرأ هذا الفيديو في المتصفح."));
  });
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  return {
    async features(times, tick, signal) {
      const out: Float32Array[] = [];
      for (const t of times) {
        if (signal?.aborted) throw new DOMException("aborted", "AbortError");
        await new Promise<void>((ok) => {
          v.onseeked = () => ok();
          v.currentTime = Math.min(t, Math.max(0, v.duration - 0.04));
        });
        ctx.drawImage(v, 0, 0, W, H);
        out.push(frameFeature(pixels(ctx), W, H));
        tick(out.length);
      }
      return out;
    },
    close: () => {
      v.removeAttribute("src");
      v.load();
    },
  };
}
