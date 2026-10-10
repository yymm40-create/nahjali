// «صدّر» — what the exported file will be: its size, its frame rate and its bitrate, decided before a single frame is
// drawn. Pure (the tests run it): the panel shows the person exactly what they will get, and the export engine is
// handed plain numbers. «نفس المصدر» («المدخل نفس المخرج») reads the biggest source video of the timeline and matches
// it — the same short side, the same frame rate, and a bitrate not under its own, so nothing is lost on the way out.

import { duration, type Timeline } from "./model";

/** The short side of the file, in pixels, or the source's own. */
export type ExportRes = 480 | 720 | 1080 | 1440 | 2160 | "source";
/** How many bits a second: a level, the source's own, or megabits the person typed. */
export type ExportQuality = "low" | "medium" | "high" | "max" | "source" | { mbps: number };
/** The frames a second: the project's, or the source's own. */
export type ExportFps = "project" | "source";

export const RES_LIST: ExportRes[] = [480, 720, 1080, 1440, 2160, "source"];
export const RES_AR: Record<string, string> = { 480: "480p", 720: "720p", 1080: "1080p", 1440: "1440p (2K)", 2160: "2160p (4K)", source: "نفس المصدر" };
export const RES_HINT: Record<string, string> = {
  480: "أخف وأسرع · للجوال الضعيف",
  720: "خفيف · للواتساب والسوشيال",
  1080: "المعتاد · إنستقرام ويوتيوب",
  1440: "أوضح · شاشات الكمبيوتر",
  2160: "4K · أعلى دقة (ثقيل على الجهاز)",
  source: "نفس دقة المقطع الأصلي — بلا تصغير",
};
export const QUALITY_LIST: Exclude<ExportQuality, { mbps: number }>[] = ["low", "medium", "high", "max", "source"];
export const QUALITY_AR: Record<string, string> = { low: "خفيف", medium: "متوسط", high: "عالي", max: "أقصى جودة", source: "نفس المصدر" };

/** Bits per pixel per frame for each level: the usual H.264 practice (a higher one keeps more detail in movement). */
const BPP: Record<"low" | "medium" | "high" | "max", number> = { low: 0.05, medium: 0.08, high: 0.12, max: 0.2 };
/** The bitrate never goes under this or over that (bits a second), whatever is asked. */
export const BITRATE_MIN = 500_000;
export const BITRATE_MAX = 200_000_000;
/** The sound's bitrate for each level (bits a second). */
export const AUDIO_BITRATE: Record<"low" | "medium" | "high" | "max" | "source", number> = { low: 96_000, medium: 128_000, high: 192_000, max: 320_000, source: 256_000 };

/** What the timeline's biggest source video is (read from the files in the browser; null when there is none). */
export interface SourceInfo {
  width: number;
  height: number;
  /** its real frame rate, when it could be measured */
  fps: number | null;
  /** its own bitrate in megabits a second, when it could be measured */
  mbps: number | null;
  /** the file it came from, for the line shown to the person */
  name?: string;
}

export interface ExportOpts {
  res: ExportRes;
  quality: ExportQuality;
  fps: ExportFps;
}

export interface ExportPlan {
  width: number;
  height: number;
  fps: number;
  /** bits a second for the picture */
  bitrate: number;
  /** the same, in megabits, rounded for the eye */
  mbps: number;
  audioBitrate: number;
  /** about how big the file will be, in bytes */
  bytes: number;
  /** the picture is big enough (or the project long enough) that a weak device may struggle */
  heavy: boolean;
  /** «نفس المصدر» was asked for but no source could be read: the project's own numbers were used */
  noSource: boolean;
}

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The short side the file will have: what was chosen, or the source's own (never past 4K). */
export function shortSideOf(res: ExportRes, source?: SourceInfo | null): number {
  if (res !== "source") return res;
  if (!source) return 1080;
  return clamp(Math.min(source.width, source.height), 240, 2160);
}

/** The file's size in pixels: the project's shape, scaled so its short side is the one chosen. */
export function sizeFor(tl: Pick<Timeline, "width" | "height">, res: ExportRes, source?: SourceInfo | null) {
  const short = shortSideOf(res, source);
  const k = short / Math.min(tl.width, tl.height);
  return { width: even(tl.width * k), height: even(tl.height * k) };
}

/** The frame rate: the project's, or the source's own (12–60, whole frames). */
export function fpsFor(tl: Pick<Timeline, "fps">, fps: ExportFps, source?: SourceInfo | null): number {
  if (fps === "source" && source?.fps) return clamp(Math.round(source.fps), 12, 60);
  return clamp(Math.round(tl.fps) || 30, 12, 60);
}

/**
 * The picture's bitrate in bits a second. A level is the usual bits-per-pixel practice for that size and frame rate;
 * «نفس المصدر» takes the source's own rate (scaled when the file comes out smaller than the source), and never less
 * than the «high» level, so the export is never the weaker of the two. A typed number is used as it is.
 */
export function bitrateFor(width: number, height: number, fps: number, quality: ExportQuality, source?: SourceInfo | null): number {
  const pixels = width * height;
  if (typeof quality === "object") return clamp(Math.round(quality.mbps * 1_000_000), BITRATE_MIN, BITRATE_MAX);
  const level = (k: "low" | "medium" | "high" | "max") => pixels * fps * BPP[k];
  if (quality === "source") {
    const own = source?.mbps ? source.mbps * 1_000_000 : 0;
    // the source's own rate belongs to its own size: a smaller file needs proportionally less for the same look
    const scaled = source && source.width * source.height > 0 ? own * Math.min(1, pixels / (source.width * source.height)) : own;
    return clamp(Math.round(Math.max(scaled, level("high"))), BITRATE_MIN, BITRATE_MAX);
  }
  return clamp(Math.round(level(quality)), BITRATE_MIN, BITRATE_MAX);
}

/** Everything the export needs, and everything the person is shown, from the choices and the timeline. */
export function exportPlan(tl: Pick<Timeline, "width" | "height" | "fps" | "tracks">, o: ExportOpts, source?: SourceInfo | null): ExportPlan {
  const { width, height } = sizeFor(tl, o.res, source);
  const fps = fpsFor(tl, o.fps, source);
  const bitrate = bitrateFor(width, height, fps, o.quality, source);
  const audioBitrate = AUDIO_BITRATE[typeof o.quality === "object" ? "high" : o.quality];
  const ms = duration(tl as Timeline);
  const bytes = Math.round(((bitrate + audioBitrate) * (ms / 1000)) / 8);
  const pixels = width * height;
  return {
    width,
    height,
    fps,
    bitrate,
    mbps: Math.round((bitrate / 1_000_000) * 10) / 10,
    audioBitrate,
    bytes,
    // 4K at all, or 1440p past four minutes, or any size past a quarter of an hour: a weak device may not finish
    heavy: pixels >= 3840 * 2000 || (pixels >= 2560 * 1400 && ms > 4 * 60_000) || ms > 15 * 60_000,
    noSource: (o.res === "source" || o.quality === "source" || o.fps === "source") && !source,
  };
}

/** «260 MB» / «1.4 GB» for a size in bytes. */
export function fmtBytes(bytes: number): string {
  const mb = bytes / 1_000_000;
  if (mb >= 1000) return `${(mb / 1000).toFixed(mb >= 10_000 ? 0 : 1)} GB`;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

/** The file's name: the project's title with what it came out as («مونتاج 4K 30fps»). */
export const exportName = (title: string, plan: ExportPlan) => `${title || "مونتاج"} ${Math.min(plan.width, plan.height)}p ${plan.fps}fps`;

// ───────── «نفس المصدر»: which file of the timeline the export matches ─────────

/** What the plan needs to know about a file of the project (the editor's own asset view fits as it is). */
export interface PlanAsset {
  id: string;
  kind: "video" | "audio" | "image";
  name: string;
  bytes: number;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  hasAudio?: boolean;
}

/**
 * The biggest VIDEO actually used on the timeline: the one the export matches when «نفس المصدر» is asked for. Its
 * bitrate is estimated from the file's own size over its length (a little taken off for its sound); its frame rate is
 * not in the file's row, so it stays null until the browser measures it (`fps` then comes from the project).
 */
export function sourceFromTimeline(tl: Pick<Timeline, "tracks">, assets: PlanAsset[]): SourceInfo | null {
  const used = new Set(tl.tracks.flatMap((t) => t.clips.map((c) => c.assetId).filter((x): x is string => !!x)));
  const videos = assets.filter((a) => a.kind === "video" && used.has(a.id) && a.width && a.height);
  if (!videos.length) return null;
  const best = videos.reduce((x, y) => (x.width! * x.height! >= y.width! * y.height! ? x : y));
  const seconds = (best.durationMs ?? 0) / 1000;
  // the file's own rate: its bytes over its seconds, less the usual sound (never negative, never silly)
  const mbps = seconds > 0.2 && best.bytes > 0 ? Math.max(0.3, (best.bytes * 8) / seconds / 1_000_000 - 0.2) : null;
  return { width: best.width!, height: best.height!, fps: null, mbps: mbps ? Math.round(mbps * 10) / 10 : null, name: best.name };
}

/** The line the person reads about the source: «3840×2160 · 30 ف/ث · 45 ميجابت». */
export function sourceLine(s: SourceInfo | null): string {
  if (!s) return "ما فيه مقطع فيديو في التايملاين أطابقه";
  return [`${s.width}×${s.height}`, s.fps ? `${Math.round(s.fps)} ف/ث` : null, s.mbps ? `${s.mbps} ميجابت/ث` : null].filter(Boolean).join(" · ");
}
