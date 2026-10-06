// «الممنتج الذكي» — the timeline document. Pure (browser and server). Times are whole milliseconds on the timeline;
// a clip shows its source from `in` to `out` (source milliseconds) starting at `start`. Media files are never
// changed: clips only point at them, so every edit can be undone.
//
// Tracks are drawn bottom to top in array order: the first video track is the main one (magnetic: no gaps), tracks
// after it are drawn over it. Audio tracks are heard, not drawn. Time always runs left → right, even in Arabic.

export const EDITOR_VERSION = 1;

export type AssetKind = "video" | "audio" | "image";
export type TrackKind = "video" | "audio" | "text";

export interface Transform {
  /** centre of the clip, as a fraction of the frame (0.5 = middle) */
  x: number;
  y: number;
  /** 1 = fills the frame as `fit` says */
  scale: number;
  /** degrees */
  rotate: number;
  /** 0–1 */
  opacity: number;
}

export interface TextStyle {
  body: string;
  size: number; // fraction of the frame's height (0.06 = 6 %)
  color: string;
  /** a box behind the words (CapCut's «خلفية») or none */
  box: string | null;
  weight: 400 | 700 | 900;
  align: "center" | "right" | "left";
  font: "readex" | "naskh" | "kufi";
}

/** A colour look (CapCut's «فلاتر» + «ضبط»): 1 = unchanged for the three factors, warmth −1 (cool) … 1 (warm). */
export interface ColorGrade {
  preset: ColorPreset;
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
}
export const COLOR_PRESETS = {
  none: { label: "بدون", filter: "" },
  vivid: { label: "زاهي", filter: "saturate(1.35) contrast(1.08)" },
  warm: { label: "دافئ", filter: "sepia(0.25) saturate(1.15) hue-rotate(-8deg)" },
  cool: { label: "بارد", filter: "saturate(0.95) hue-rotate(12deg) brightness(1.02)" },
  bw: { label: "أبيض وأسود", filter: "grayscale(1) contrast(1.1)" },
  vintage: { label: "قديم", filter: "sepia(0.45) contrast(0.9) brightness(1.05) saturate(0.85)" },
  cinema: { label: "سينمائي", filter: "contrast(1.18) saturate(0.82) brightness(0.95)" },
  fade: { label: "باهت", filter: "contrast(0.82) brightness(1.08) saturate(0.8)" },
} as const;
export type ColorPreset = keyof typeof COLOR_PRESETS;
export const NEUTRAL_COLOR: ColorGrade = { preset: "none", brightness: 1, contrast: 1, saturation: 1, warmth: 0 };

/** The canvas filter for a colour look ("" when it changes nothing). */
export function colorFilter(g: ColorGrade | null) {
  if (!g) return "";
  const parts: string[] = [COLOR_PRESETS[g.preset]?.filter ?? ""];
  if (g.brightness !== 1) parts.push(`brightness(${g.brightness})`);
  if (g.contrast !== 1) parts.push(`contrast(${g.contrast})`);
  if (g.saturation !== 1) parts.push(`saturate(${g.saturation})`);
  if (g.warmth > 0) parts.push(`sepia(${(g.warmth * 0.35).toFixed(3)})`);
  if (g.warmth < 0) parts.push(`hue-rotate(${(-g.warmth * 18).toFixed(1)}deg)`);
  return parts.filter(Boolean).join(" ");
}

/** How one picture gives way to the next on the same track (it happens around the cut; the length doesn't change). */
export const TRANSITIONS = {
  fade: { label: "تلاشي", icon: "◐" },
  black: { label: "عبر الأسود", icon: "●" },
  white: { label: "وميض أبيض", icon: "○" },
  slide: { label: "انزلاق", icon: "⇠" },
  zoom: { label: "تكبير", icon: "⤢" },
  wipe: { label: "مسح", icon: "▧" },
} as const;
export type TransitionKind = keyof typeof TRANSITIONS;
export interface Transition {
  kind: TransitionKind;
  ms: number;
}
export const TRANSITION_MS = { min: 200, max: 2000, default: 600 } as const;

/** A moment of a moving clip («نقطة حركة»): where it is at source time `t` (ms); between two points it glides. */
export interface Key extends Transform {
  t: number;
}

export interface Clip {
  id: string;
  /** the media file (null for a text clip) */
  assetId: string | null;
  start: number;
  in: number;
  out: number;
  /** 1 = normal (phase 2 lets people change it) */
  speed: number;
  /** 0–2 (1 = as recorded) */
  volume: number;
  /** cover = fill the frame (crop), contain = whole picture with bars */
  fit: "cover" | "contain";
  transform: Transform;
  text: TextStyle | null;
  /** motion: when there are points, they decide the transform */
  keys: Key[];
  color: ColorGrade | null;
  /** into the next clip on the same track, when it starts right where this one ends */
  transition: Transition | null;
  /** sound fading in at the start and out at the end (ms) */
  fadeIn: number;
  fadeOut: number;
  /** the picture's outline: picture-in-picture looks better rounded or round */
  shape: "rect" | "rounded" | "circle";
}

export interface Track {
  id: string;
  kind: TrackKind;
  name: string;
  muted: boolean;
  hidden: boolean;
  locked: boolean;
  /** sound track that gets quieter by itself while someone speaks (music under a voice: «خفض تلقائي») */
  duck: boolean;
  /** clips never overlap and are kept sorted by `start` */
  clips: Clip[];
}

export interface Timeline {
  v: number;
  width: number;
  height: number;
  fps: number;
  background: string;
  /** the main track closes its gaps by itself (CapCut's «المغناطيس»); off = clips stay where they are put */
  magnetic: boolean;
  /** beat marks (timeline ms) the cuts snap to */
  markers: number[];
  tracks: Track[];
}

/** What the timeline needs to know about a media file. */
export interface AssetInfo {
  id: string;
  kind: AssetKind;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  /** a video file has a sound track we can hear */
  hasAudio?: boolean;
}

export const RATIOS = {
  "9:16": { width: 1080, height: 1920, label: "طولي (ريلز وتيك توك وشورتس)" },
  "16:9": { width: 1920, height: 1080, label: "عرضي (يوتيوب)" },
  "1:1": { width: 1080, height: 1080, label: "مربع" },
  "4:5": { width: 1080, height: 1350, label: "منشور (٤:٥)" },
} as const;
export type Ratio = keyof typeof RATIOS;
export const ratioOf = (t: Pick<Timeline, "width" | "height">): Ratio =>
  (Object.keys(RATIOS) as Ratio[]).find((r) => RATIOS[r].width * t.height === RATIOS[r].height * t.width) ?? "16:9";

/** Kinds of projects people start from (the migration's check). */
export const PROJECT_KINDS = {
  reel: { label: "ريلز / مقطع قصير", ratio: "9:16" as Ratio, icon: "📱" },
  horizontal: { label: "فيديو عرضي", ratio: "16:9" as Ratio, icon: "🖥️" },
  podcast: { label: "بودكاست", ratio: "16:9" as Ratio, icon: "🎙️" },
  poem: { label: "قصيدة", ratio: "9:16" as Ratio, icon: "📜" },
} as const;
export type ProjectKind = keyof typeof PROJECT_KINDS;
export const isProjectKind = (s: unknown): s is ProjectKind => typeof s === "string" && s in PROJECT_KINDS;

/** Limits that keep a document sane (not product limits: a project has no maximum length). */
export const LIMITS = { tracks: 40, clips: 3000, text: 500, minClipMs: 100, maxMs: 24 * 3600_000, keys: 200, markers: 5000 } as const;

export const DEFAULT_TRANSFORM: Transform = { x: 0.5, y: 0.5, scale: 1, rotate: 0, opacity: 1 };
export const DEFAULT_TEXT: TextStyle = { body: "اكتب هنا", size: 0.06, color: "#ffffff", box: null, weight: 700, align: "center", font: "readex" };
/** How long a picture or a text lasts when it is first placed. */
export const STILL_MS = 3000;

export const newId = (p = "c") => `${p}${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;

export function emptyTimeline(ratio: Ratio = "9:16"): Timeline {
  const { width, height } = RATIOS[ratio];
  return {
    v: EDITOR_VERSION,
    width,
    height,
    fps: 30,
    background: "#000000",
    magnetic: true,
    markers: [],
    tracks: [
      { id: "main", kind: "video", name: "الرئيسي", muted: false, hidden: false, locked: false, duck: false, clips: [] },
      { id: newId("t"), kind: "audio", name: "صوت", muted: false, hidden: false, locked: false, duck: false, clips: [] },
    ],
  };
}

export const clipLength = (c: Pick<Clip, "in" | "out" | "speed">) => Math.max(0, Math.round((c.out - c.in) / (c.speed || 1)));
export const clipEnd = (c: Clip) => c.start + clipLength(c);
export const trackEnd = (t: Track) => t.clips.reduce((m, c) => Math.max(m, clipEnd(c)), 0);
export const duration = (t: Timeline) => t.tracks.reduce((m, tr) => Math.max(m, trackEnd(tr)), 0);
/** The main track: the first video track (it keeps no gaps). */
export const mainTrack = (t: Timeline) => t.tracks.find((x) => x.kind === "video");
export const isMain = (t: Timeline, trackId: string) => mainTrack(t)?.id === trackId;

/** Where in its source a clip is at timeline time `ms`. */
export const sourceTime = (c: Clip, ms: number) => c.in + (ms - c.start) * (c.speed || 1);
/** Clips (with their track) playing at `ms`, bottom to top. */
export function clipsAt(t: Timeline, ms: number) {
  const out: { track: Track; clip: Clip }[] = [];
  for (const track of t.tracks) {
    for (const clip of track.clips) if (ms >= clip.start && ms < clipEnd(clip)) out.push({ track, clip });
  }
  return out;
}

/** A clip's place and look at timeline time `ms` (its motion points, eased; outside them it holds the nearest). */
export function transformAt(c: Clip, ms: number): Transform {
  if (!c.keys.length) return c.transform;
  const s = sourceTime(c, ms);
  const k = c.keys;
  if (s <= k[0].t) return k[0];
  const last = k[k.length - 1];
  if (s >= last.t) return last;
  const i = k.findIndex((x) => x.t > s);
  const a = k[i - 1];
  const b = k[i];
  const r = (s - a.t) / (b.t - a.t || 1);
  const e = r * r * (3 - 2 * r);
  const mix = (x: number, y: number) => x + (y - x) * e;
  return { x: mix(a.x, b.x), y: mix(a.y, b.y), scale: mix(a.scale, b.scale), rotate: mix(a.rotate, b.rotate), opacity: mix(a.opacity, b.opacity) };
}

/**
 * A transition happening on `track` at `ms`: the outgoing clip `a`, the incoming `b` and how far along it is (0–1).
 * It runs over the cut, half before and half after, so nothing moves on the timeline.
 */
export function transitionAt(track: Track, ms: number) {
  const cs = track.clips;
  for (let i = 0; i + 1 < cs.length; i++) {
    const a = cs[i];
    const b = cs[i + 1];
    if (!a.transition || b.start !== clipEnd(a)) continue;
    const d = Math.min(a.transition.ms, clipLength(a), clipLength(b));
    const from = b.start - d / 2;
    if (ms >= from && ms < from + d) return { a, b, p: (ms - from) / d, kind: a.transition.kind, from, to: from + d };
    if (b.start > ms + d) break;
  }
  return null;
}

/** Sound fading in and out at a clip's edges: 0–1. */
export function fadeAt(c: Clip, ms: number) {
  let f = 1;
  if (c.fadeIn > 0) f = Math.min(f, (ms - c.start) / c.fadeIn);
  if (c.fadeOut > 0) f = Math.min(f, (clipEnd(c) - ms) / c.fadeOut);
  return Math.max(0, Math.min(1, f));
}

export const DUCK = { level: 0.25, rampMs: 300 } as const;

/** Where someone (or something) is heard on the tracks that don't duck: merged [start, end) spans. */
export function voiceSpans(t: Timeline, hasSound: (c: Clip) => boolean) {
  const spans: [number, number][] = [];
  for (const track of t.tracks) {
    if (track.muted || track.duck || track.kind === "text") continue;
    for (const c of track.clips) if (c.volume > 0 && hasSound(c)) spans.push([c.start, clipEnd(c)]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const s of spans) {
    const last = out[out.length - 1];
    if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
    else out.push([s[0], s[1]]);
  }
  return out;
}

/** A ducking track's level at `ms`: lowered inside the voice, gliding back up over DUCK.rampMs around it. */
export function duckAt(spans: [number, number][], ms: number) {
  let dist = Infinity;
  for (const [a, b] of spans) {
    if (ms >= a && ms < b) return DUCK.level;
    dist = Math.min(dist, Math.abs(ms - a), Math.abs(ms - b));
    if (a > ms + DUCK.rampMs) break;
  }
  return DUCK.level + (1 - DUCK.level) * Math.min(1, dist / DUCK.rampMs);
}

/** A clip's loudness at `ms` (volume × fades × ducking). */
export const gainAt = (track: Track, c: Clip, ms: number, spans: [number, number][]) => c.volume * fadeAt(c, ms) * (track.duck ? duckAt(spans, ms) : 1);

export function findClip(t: Timeline, clipId: string) {
  for (const track of t.tracks) {
    const i = track.clips.findIndex((c) => c.id === clipId);
    if (i >= 0) return { track, clip: track.clips[i], index: i };
  }
  return null;
}

/** "1:05.3" for the timeline's ruler and labels. */
export function formatTime(ms: number, tenths = true) {
  const s = Math.max(0, ms) / 1000;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const ss = tenths ? sec.toFixed(1).padStart(4, "0") : String(Math.floor(sec)).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

// ---------- reading a stored document (the server's check, and the browser's when it loads one) ----------

const num = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
const int = (v: unknown, lo: number, hi: number, d: number) => Math.round(num(v, lo, hi, d));
const str = (v: unknown, max: number, d = "") => (typeof v === "string" ? v.slice(0, max) : d);
const COLOR = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;
const color = (v: unknown, d: string) => (typeof v === "string" && COLOR.test(v) ? v : d);
const ID = /^[a-z0-9_-]{1,40}$/i;
const id = (v: unknown, p: string) => (typeof v === "string" && ID.test(v) ? v : newId(p));
const pick = <T extends string | number>(v: unknown, all: readonly T[], d: T): T => (all.includes(v as T) ? (v as T) : d);

function readText(v: unknown): TextStyle | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  return {
    body: str(o.body, LIMITS.text, ""),
    size: num(o.size, 0.01, 0.4, DEFAULT_TEXT.size),
    color: color(o.color, DEFAULT_TEXT.color),
    box: o.box == null ? null : color(o.box, "#000000aa"),
    weight: pick<400 | 700 | 900>(Number(o.weight), [400, 700, 900], 700),
    align: pick(o.align, ["center", "right", "left"] as const, "center"),
    font: pick(o.font, ["readex", "naskh", "kufi"] as const, "readex"),
  };
}

function readTransform(tr: Record<string, unknown>): Transform {
  return {
    x: num(tr.x, -2, 3, 0.5),
    y: num(tr.y, -2, 3, 0.5),
    scale: num(tr.scale, 0.05, 10, 1),
    rotate: num(tr.rotate, -360, 360, 0),
    opacity: num(tr.opacity, 0, 1, 1),
  };
}

function readColor(v: unknown): ColorGrade | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  return {
    preset: pick(o.preset, Object.keys(COLOR_PRESETS) as ColorPreset[], "none"),
    brightness: num(o.brightness, 0.2, 2, 1),
    contrast: num(o.contrast, 0.2, 2, 1),
    saturation: num(o.saturation, 0, 3, 1),
    warmth: num(o.warmth, -1, 1, 0),
  };
}

function readClip(v: unknown, kind: TrackKind, assets: Set<string> | null): Clip | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const text = kind === "text" ? readText(o.text) : null;
  const assetId = kind === "text" ? null : str(o.assetId, 64) || null;
  if (kind === "text" ? !text : !assetId || (assets && !assets.has(assetId))) return null;
  const tr = (o.transform ?? {}) as Record<string, unknown>;
  const inMs = int(o.in, 0, LIMITS.maxMs, 0);
  const out = int(o.out, inMs + LIMITS.minClipMs, LIMITS.maxMs, inMs + STILL_MS);
  return {
    id: id(o.id, "c"),
    assetId,
    start: int(o.start, 0, LIMITS.maxMs, 0),
    in: inMs,
    out,
    speed: num(o.speed, 0.1, 10, 1),
    volume: num(o.volume, 0, 2, 1),
    fit: pick(o.fit, ["cover", "contain"] as const, "cover"),
    transform: readTransform(tr),
    text,
    keys: (Array.isArray(o.keys) ? o.keys.slice(0, LIMITS.keys) : [])
      .filter((k): k is Record<string, unknown> => !!k && typeof k === "object")
      .map((k) => ({ t: int(k.t, 0, LIMITS.maxMs, 0), ...readTransform(k) }))
      .sort((a, b) => a.t - b.t)
      .filter((k, i, all) => i === 0 || k.t !== all[i - 1].t),
    color: kind === "audio" ? null : readColor(o.color),
    transition:
      kind !== "audio" && o.transition && typeof o.transition === "object"
        ? {
            kind: pick((o.transition as Record<string, unknown>).kind, Object.keys(TRANSITIONS) as TransitionKind[], "fade"),
            ms: int((o.transition as Record<string, unknown>).ms, TRANSITION_MS.min, TRANSITION_MS.max, TRANSITION_MS.default),
          }
        : null,
    fadeIn: int(o.fadeIn, 0, 60_000, 0),
    fadeOut: int(o.fadeOut, 0, 60_000, 0),
    shape: pick(o.shape, ["rect", "rounded", "circle"] as const, "rect"),
  };
}

/**
 * A stored or received document made safe: unknown fields dropped, numbers clamped, clips on media that isn't in the
 * project (when `assets` is given) removed, overlaps resolved. Never throws.
 */
export function readTimeline(raw: unknown, assets: Set<string> | null = null): Timeline {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const tracksIn = Array.isArray(o.tracks) ? o.tracks.slice(0, LIMITS.tracks) : [];
  let clips = 0;
  const seen = new Set<string>();
  const tracks: Track[] = [];
  for (const tv of tracksIn) {
    if (!tv || typeof tv !== "object") continue;
    const t = tv as Record<string, unknown>;
    const kind = pick(t.kind, ["video", "audio", "text"] as const, "video");
    let tid = id(t.id, "t");
    if (seen.has(tid)) tid = newId("t");
    seen.add(tid);
    const list: Clip[] = [];
    for (const cv of Array.isArray(t.clips) ? t.clips : []) {
      if (clips >= LIMITS.clips) break;
      const c = readClip(cv, kind, assets);
      if (!c) continue;
      if (seen.has(c.id)) c.id = newId("c");
      seen.add(c.id);
      list.push(c);
      clips++;
    }
    tracks.push({ id: tid, kind, name: str(t.name, 40, ""), muted: t.muted === true, hidden: t.hidden === true, locked: t.locked === true, duck: kind === "audio" && t.duck === true, clips: settle(list) });
  }
  if (!tracks.some((t) => t.kind === "video")) tracks.unshift({ id: "main", kind: "video", name: "الرئيسي", muted: false, hidden: false, locked: false, duck: false, clips: [] });
  const width = int(o.width, 144, 4096, 1080);
  const height = int(o.height, 144, 4096, 1920);
  const out: Timeline = { v: EDITOR_VERSION, width: width - (width % 2), height: height - (height % 2), fps: pick<number>(Number(o.fps), [24, 25, 30, 60], 30), background: color(o.background, "#000000"), magnetic: o.magnetic !== false, markers: readMarkers(o.markers), tracks };
  const main = mainTrack(out);
  if (main && out.magnetic) main.clips = pack(main.clips);
  return out;
}

function readMarkers(v: unknown) {
  const list = (Array.isArray(v) ? v.slice(0, LIMITS.markers) : []).map((m) => Math.round(Number(m))).filter((m) => Number.isFinite(m) && m >= 0 && m <= LIMITS.maxMs);
  return [...new Set(list)].sort((a, b) => a - b);
}

/** Sorted, and any clip that would overlap the one before it moved just after it. */
export function settle(clips: Clip[]) {
  const sorted = [...clips].sort((a, b) => a.start - b.start);
  let end = 0;
  for (const c of sorted) {
    if (c.start < end) c.start = end;
    end = clipEnd(c);
  }
  return sorted;
}

/** The main track's rule: clips one after the other from 0, no gaps (`keepOrder`: in the given order, not by start). */
export function pack(clips: Clip[], keepOrder = false) {
  const sorted = keepOrder ? [...clips] : [...clips].sort((a, b) => a.start - b.start);
  let at = 0;
  for (const c of sorted) {
    c.start = at;
    at += clipLength(c);
  }
  return sorted;
}
