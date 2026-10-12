// «مختبر الموشن» — what the browser makes from a loaded scene: a probe (frames across the whole piece, to catch a
// bug before حيدرة reviews it), contact sheets and stills for his review, and the final MP4 (WebCodecs through
// Mediabunny, the same encoder as the export, with motion blur from sub-frames).

import { BufferTarget, CanvasSource, canEncodeVideo, getFirstEncodableVideoCodec, Mp4OutputFormat, Output } from "mediabunny";
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

/** The final film: every frame at full size (motion blur when the scene asks for it), as an MP4 blob. */
export async function renderVideo(host: SceneHost, o: { duration: number; fps: number; blur: number }, onProgress: (p: number) => void, signal?: AbortSignal): Promise<Blob> {
  const w = host.w - (host.w % 2), h = host.h - (host.h % 2);
  const bitrate = Math.round(w * h * o.fps * 0.16);
  const codec = await getFirstEncodableVideoCodec(["avc", "vp9", "av1"], { width: w, height: h, bitrate });
  if (!codec) throw new Error(`متصفحك ما يقدر يصدّر فيديو بمقاس ${w}×${h}. جرّب Chrome أو Edge على الكمبيوتر.`);
  const want = wantedEncode();
  const hw = want !== "no-preference" && (await canEncodeVideo(codec, { width: w, height: h, bitrate, hardwareAcceleration: want }).catch(() => false)) ? want : "no-preference";
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d", { alpha: false })!;
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
  const source = new CanvasSource(canvas as unknown as HTMLCanvasElement, { codec, bitrate, keyFrameInterval: 2, hardwareAcceleration: hw });
  output.addVideoTrack(source, { frameRate: o.fps });
  await output.start();
  const frames = Math.max(1, Math.round(o.duration * o.fps));
  const sub = o.blur > 0 ? 6 : 1;
  for (let i = 0; i < frames; i++) {
    if (signal?.aborted) throw new DOMException("cancelled", "AbortError");
    const t = i / o.fps;
    const bm = await host.frame(t, { scale: 1, sub, shutter: o.blur });
    ctx.drawImage(bm, 0, 0, w, h);
    bm.close();
    await source.add(t, 1 / o.fps);
    if (i % 5 === 0) onProgress(i / frames);
  }
  source.close();
  await output.finalize();
  onProgress(1);
  return new Blob([(output.target as BufferTarget).buffer!], { type: "video/mp4" });
}
