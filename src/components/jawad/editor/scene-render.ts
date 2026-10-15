// «مختبر الموشن» — what the browser makes from a loaded scene: a probe (frames across the whole piece, to catch a
// bug before حيدرة reviews it), contact sheets and stills for his review, and the final MP4 (WebCodecs through
// Mediabunny, the same encoder as the export, with motion blur from sub-frames).

import { BufferTarget, CanvasSource, canEncodeVideo, getFirstEncodableVideoCodec, Mp4OutputFormat, Output, WebMOutputFormat } from "mediabunny";
import { wantedEncode } from "./perf-bench";
import { SceneError, type SceneHost } from "./scene-host";

const toJpeg64 = async (c: HTMLCanvasElement | OffscreenCanvas, q = 0.82) => {
  const blob = c instanceof OffscreenCanvas ? await c.convertToBlob({ type: "image/jpeg", quality: q }) : await new Promise<Blob>((r, no) => c.toBlob((b) => (b ? r(b) : no(new Error("jpeg"))), "image/jpeg", q));
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
};

/** Draws frames across the whole piece (small and fast): the first error, with its time, or null. */
export async function probe(host: SceneHost, duration: number, n = 16): Promise<SceneError | null> {
  for (let i = 0; i < n; i++) {
    const t = (duration * i) / (n - 1 || 1);
    try {
      (await host.frame(Math.min(t, duration - 1e-3), { scale: 0.25 })).close();
    } catch (e) {
      return e instanceof SceneError ? e : new SceneError(String(e), "frame", t);
    }
  }
  return null;
}

/** One contact sheet: `count` frames from `from` to `to`, tiled with the time under each (what a director scans). */
export async function contactSheet(host: SceneHost, from: number, to: number, count = 24, cols = 6): Promise<string> {
  const cellW = host.w >= host.h ? 320 : 180;
  const cellH = Math.round((cellW * host.h) / host.w);
  const rows = Math.ceil(count / cols);
  const pad = 22;
  const c = new OffscreenCanvas(cols * cellW, rows * (cellH + pad));
  const g = c.getContext("2d")!;
  g.fillStyle = "#1b1b1f";
  g.fillRect(0, 0, c.width, c.height);
  g.font = "600 14px sans-serif";
  g.textAlign = "center";
  for (let i = 0; i < count; i++) {
    const t = from + ((to - from) * i) / (count - 1 || 1);
    const bm = await host.frame(Math.min(t, to - 1e-3), { scale: cellW / host.w });
    const x = (i % cols) * cellW, y = Math.floor(i / cols) * (cellH + pad);
    g.drawImage(bm, x, y, cellW, cellH);
    bm.close();
    g.fillStyle = "#e6e8e6";
    g.fillText(`${t.toFixed(2)}s`, x + cellW / 2, y + cellH + 16);
  }
  return toJpeg64(c, 0.8);
}

/** Full stills (long side ≤ 1280) at the given times. */
export async function stills(host: SceneHost, times: number[], duration: number): Promise<string[]> {
  const s = Math.min(1, 1280 / Math.max(host.w, host.h));
  const out: string[] = [];
  for (const t of times) {
    const bm = await host.frame(Math.min(Math.max(0, t), duration - 1e-3), { scale: s, sub: 4, shutter: 0.5 });
    const c = new OffscreenCanvas(bm.width, bm.height);
    c.getContext("2d")!.drawImage(bm, 0, 0);
    bm.close();
    out.push(await toJpeg64(c, 0.86));
  }
  return out;
}

/** The moments a director looks at: the hook, the beats in between, and the ending. */
export const reviewTimes = (duration: number) => [0.4, duration * 0.25, duration * 0.5, duration * 0.75, Math.max(0, duration - 0.6)].map((t) => Math.round(t * 100) / 100);

/**
 * What ONE full-size frame of this scene really costs on this device, in milliseconds: three frames drawn across the
 * piece (the first one thrown away, so a cold start doesn't count), averaged. A render of hundreds of frames is
 * planned from this instead of being started blind.
 */
export async function frameCost(host: SceneHost, duration: number, sub: number, signal?: AbortSignal): Promise<number> {
  const times = [duration * 0.1, duration * 0.45, duration * 0.8];
  let total = 0;
  for (const [i, t] of times.entries()) {
    if (signal?.aborted) throw new DOMException("cancelled", "AbortError");
    const started = performance.now();
    (await host.frame(Math.min(t, duration - 1e-3), { scale: 1, sub, shutter: sub > 1 ? 0.5 : 0 })).close();
    if (i > 0) total += performance.now() - started;
  }
  return total / (times.length - 1);
}

/**
 * The final film: every frame at full size (motion blur when the scene asks for it), as an MP4 blob. `sub` is how many
 * sub-frames each one averages — the lab lowers it when the measured cost says the render would take too long.
 * `onProgress` is told the share done, the frame reached and how many there are, so the wait is never silent.
 */
export async function renderVideo(host: SceneHost, o: { duration: number; fps: number; blur: number; sub?: number; /** خلفية شفافة: WebM (VP9) بقناة ألفا بدل MP4 */ transparent?: boolean }, onProgress: (p: number, frame: number, frames: number) => void, signal?: AbortSignal): Promise<Blob> {
  const w = host.w - (host.w % 2), h = host.h - (host.h % 2);
  const bitrate = Math.round(w * h * o.fps * 0.16);
  // transparent: only VP9 keeps an alpha channel in a browser encoder, muxed into WebM (MP4/H.264 has no alpha)
  const codec = o.transparent ? ((await canEncodeVideo("vp9", { width: w, height: h, bitrate, alpha: "keep" }).catch(() => false)) ? "vp9" : null) : await getFirstEncodableVideoCodec(["avc", "vp9", "av1"], { width: w, height: h, bitrate });
  if (!codec) throw new Error(o.transparent ? "متصفحك ما يقدر يصدّر فيديو بخلفية شفافة. جرّب Chrome أو Edge على الكمبيوتر." : `متصفحك ما يقدر يصدّر فيديو بمقاس ${w}×${h}. جرّب Chrome أو Edge على الكمبيوتر.`);
  const want = wantedEncode();
  const hw = want !== "no-preference" && (await canEncodeVideo(codec, { width: w, height: h, bitrate, hardwareAcceleration: want, alpha: o.transparent ? "keep" : "discard" }).catch(() => false)) ? want : "no-preference";
  const canvas = new OffscreenCanvas(w, h);
  // a transparent render never fills its background first (drawOnce in runtime.ts only paints one when the scene asks for it)
  const ctx = canvas.getContext("2d", { alpha: !!o.transparent })!;
  const output = new Output({ format: o.transparent ? new WebMOutputFormat() : new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
  const source = new CanvasSource(canvas as unknown as HTMLCanvasElement, { codec, bitrate, keyFrameInterval: 2, hardwareAcceleration: hw, alpha: o.transparent ? "keep" : "discard" });
  output.addVideoTrack(source, { frameRate: o.fps });
  await output.start();
  const frames = Math.max(1, Math.round(o.duration * o.fps));
  const sub = Math.max(1, Math.round(o.sub ?? (o.blur > 0 ? 6 : 1)));
  for (let i = 0; i < frames; i++) {
    if (signal?.aborted) throw new DOMException("cancelled", "AbortError");
    const t = i / o.fps;
    const bm = await host.frame(t, { scale: 1, sub, shutter: o.blur });
    // a transparent frame may leave empty pixels (alpha 0): cleared first, or the last frame's pixels would show through
    if (o.transparent) ctx.clearRect(0, 0, w, h);
    ctx.drawImage(bm, 0, 0, w, h);
    bm.close();
    await source.add(t, 1 / o.fps);
    if (i % 5 === 0 || i === frames - 1) onProgress(i / frames, i, frames);
  }
  source.close();
  await output.finalize();
  onProgress(1, frames, frames);
  return new Blob([(output.target as BufferTarget).buffer!], { type: o.transparent ? "video/webm" : "video/mp4" });
}
