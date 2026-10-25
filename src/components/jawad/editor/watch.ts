// «👁️ حيدرا ماكس يشوف المقطع كامل» — the browser's part: the clip's video is played (muted, fast) and EVERY frame it shows
// is copied tiny and measured (brightness, change from the one before); where the browser can't hand over its frames
// one by one, it is stepped through many times a second instead. Then the frames worth seeing are drawn as numbered
// tiles on contact sheets with their timeline time. What is measured and picked is src/lib/editor/watch.ts.

import { findCuts, motionPerSecond, pickTimes, spansOf, WATCH, type FrameStat, type Watch } from "@/lib/editor/watch";

interface Clip {
  id: string;
  start: number;
  in: number;
  out: number;
  speed: number;
}

type FrameVideo = HTMLVideoElement & { requestVideoFrameCallback?: (cb: (now: number, meta: { mediaTime: number }) => void) => number };

const open = async (url: string): Promise<FrameVideo> => {
  const v = document.createElement("video") as FrameVideo;
  v.crossOrigin = "anonymous";
  v.muted = true;
  v.preload = "auto";
  v.playsInline = true;
  v.src = url;
  await new Promise<void>((ok, bad) => {
    v.onloadeddata = () => ok();
    v.onerror = () => bad(new Error("ما قدرت أفتح الفيديو."));
    setTimeout(() => bad(new Error("الفيديو ما فتح في وقته.")), 20_000);
  });
  return v;
};

const seek = (v: HTMLVideoElement, ms: number) =>
  new Promise<void>((ok) => {
    v.onseeked = () => ok();
    v.currentTime = Math.min(ms / 1000, Math.max(0, (v.duration || 0) - 0.03));
    setTimeout(ok, 4000);
  });

/** Every frame measured on a tiny copy: brightness and the change from the frame before. */
async function measure(v: FrameVideo, clip: Clip, onStep: (s: string) => void, signal?: AbortSignal): Promise<FrameStat[]> {
  const c = document.createElement("canvas");
  c.width = WATCH.probeW;
  c.height = WATCH.probeH;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  let prev: Uint8ClampedArray | null = null;
  const stats: FrameStat[] = [];
  const take = (mediaMs: number) => {
    ctx.drawImage(v, 0, 0, c.width, c.height);
    const px = ctx.getImageData(0, 0, c.width, c.height).data;
    let luma = 0;
    let diff = 0;
    for (let i = 0; i < px.length; i += 4) {
      const y = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
      luma += y;
      if (prev) diff += Math.abs(y - (0.2126 * prev[i] + 0.7152 * prev[i + 1] + 0.0722 * prev[i + 2]));
    }
    const n = px.length / 4;
    prev = px;
    stats.push({ t: Math.round(clip.start + (mediaMs - clip.in) / clip.speed), luma: luma / n, diff: stats.length ? (diff / n / 255) * 100 : 0 });
  };

  // every frame the browser shows, played fast (the frames still come one by one)
  if (typeof v.requestVideoFrameCallback === "function") {
    const ok = await new Promise<boolean>((done) => {
      const rate = Math.min(4, Math.max(1, (clip.out - clip.in) / 15_000));
      let finished = false;
      const end = (good: boolean) => {
        if (finished) return;
        finished = true;
        v.pause();
        done(good);
      };
      const tick = (_: number, meta: { mediaTime: number }) => {
        if (finished) return;
        if (signal?.aborted) return end(false);
        const ms = meta.mediaTime * 1000;
        if (ms >= clip.in - 1) take(ms);
        if (stats.length % 60 === 0) onStep(`حيدرا ماكس يشوف كل فريم… (${stats.length})`);
        if (ms >= clip.out - 20 || stats.length >= WATCH.measureMax) return end(true);
        v.requestVideoFrameCallback!(tick);
      };
      void seek(v, clip.in).then(() => {
        v.playbackRate = rate;
        v.requestVideoFrameCallback!(tick);
        v.onended = () => end(true);
        v.play().catch(() => end(false));
        setTimeout(() => end(stats.length > 10), (clip.out - clip.in) / rate + 20_000);
      });
    });
    if (ok && stats.length > 10) return stats;
    stats.length = 0;
    prev = null;
  }

  // stepped instead: many times a second
  const n = Math.min(WATCH.measureMax, Math.max(2, Math.round((clip.out - clip.in) / 125)));
  for (let i = 0; i < n; i++) {
    if (signal?.aborted) break;
    const ms = clip.in + ((clip.out - clip.in) * i) / Math.max(1, n - 1);
    await seek(v, ms);
    take(ms);
    if (i % 40 === 0) onStep(`حيدرا ماكس يشوف المقطع… (${i}/${n})`);
  }
  return stats;
}

/** The chosen frames drawn as numbered tiles, twelve to a sheet, each with its timeline time. */
async function sheetsOf(v: HTMLVideoElement, clip: Clip, times: number[], onStep: (s: string) => void, signal?: AbortSignal) {
  const cols = 4;
  const T = WATCH.tile;
  const sheets: { data: string; times: number[] }[] = [];
  for (let s = 0; s < times.length; s += WATCH.perSheet) {
    if (signal?.aborted) break;
    const part = times.slice(s, s + WATCH.perSheet);
    const c = document.createElement("canvas");
    c.width = cols * T;
    c.height = Math.ceil(part.length / cols) * T;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < part.length; i++) {
      const t = part[i];
      await seek(v, clip.in + (t - clip.start) * clip.speed);
      const x = (i % cols) * T;
      const y = Math.floor(i / cols) * T;
      const k = Math.min((T - 4) / v.videoWidth, (T - 4) / v.videoHeight);
      const w = v.videoWidth * k;
      const h = v.videoHeight * k;
      ctx.drawImage(v, x + (T - w) / 2, y + (T - h) / 2, w, h);
      // the tile's number and its time on the timeline
      const label = `#${s + i + 1} · ${(t / 1000).toFixed(2)}s`;
      ctx.font = "bold 18px system-ui, sans-serif";
      const lw = ctx.measureText(label).width + 12;
      ctx.fillStyle = "rgba(0,0,0,0.78)";
      ctx.fillRect(x + 4, y + T - 30, lw, 26);
      ctx.fillStyle = "#ffe14d";
      ctx.fillText(label, x + 10, y + T - 11);
      ctx.strokeStyle = "#333";
      ctx.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);
    }
    sheets.push({ data: c.toDataURL("image/jpeg", 0.7).split(",")[1], times: part });
    onStep(`حيدرا ماكس يرتّب اللقطات… (${Math.min(times.length, s + WATCH.perSheet)}/${times.length})`);
  }
  return sheets;
}

/** The whole clip watched: every frame measured, the cuts, black, frozen moments and motion found, the sheets drawn. */
export async function watchClip(url: string, clip: Clip, onStep: (s: string) => void, signal?: AbortSignal): Promise<Watch> {
  const v = await open(url);
  try {
    onStep("حيدرا ماكس يشوف كل فريم في المقطع…");
    const stats = await measure(v, clip, onStep, signal);
    const from = clip.start;
    const to = Math.round(clip.start + (clip.out - clip.in) / clip.speed);
    const cuts = findCuts(stats);
    const times = pickTimes(from, to, cuts);
    const sheets = await sheetsOf(v, clip, times, onStep, signal);
    return {
      clipId: clip.id,
      sheets,
      analysed: stats.length,
      from,
      to,
      cuts,
      black: spansOf(stats, (s) => s.luma < 16, 300),
      frozen: spansOf(stats.slice(1), (s) => s.diff < 0.4, 1000),
      motion: motionPerSecond(stats, from, to),
    };
  } finally {
    v.pause();
    v.removeAttribute("src");
    v.load();
  }
}
