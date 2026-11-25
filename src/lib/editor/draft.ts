// «حيدرة كت» — «من فكرة لمسودة» (the CapCut «AI video maker» way). Pure (browser, server and tests).
//
// The person writes an idea (or pastes a script), picks a length, a shape, a language, a voice and a visual route —
// cheapest first: «صور + موشن» (a picture per scene, moved with code), «موشن بالكود فقط» (no generation but the voice
// and the music) or «فيديو مولّد» (a short generated video per scene, the dearest). «حيدرا ماكس» writes the plan first
// (scenes: what is said, the words on screen, what is seen, how long); the person edits it and sees its price before
// anything runs. On approval every part is an ordinary JAWAD AI job (each charged and refunded as usual), and when
// they are all back the draft is assembled into one ordinary timeline (one undo): the pictures with their slow moves
// and transitions, the voice-over, the music under it (ducking), the words on screen and captions from the script.
// A part that failed leaves its place (the moving background shows there) and is made again with «أعد هالمشهد».

import type { Command } from "./commands";
import type { MakeSpec } from "./make-any";
import { newMotion, type MotionColors, type MotionEl } from "./motion-elements";
import {
  CAPTION_STYLES,
  DEFAULT_TEXT,
  DEFAULT_TRANSFORM,
  EDITOR_VERSION,
  LIMITS,
  newId,
  RATIOS,
  type AnimKind,
  type CaptionStyle,
  type Clip,
  type Key,
  type Ratio,
  type TextStyle,
  type Timeline,
  type Track,
} from "./model";

// ───────── the choices ─────────

export const DRAFT_LENGTHS = [15, 30, 60, 90] as const;
export type DraftLength = (typeof DRAFT_LENGTHS)[number];
export const DRAFT_RATIOS: Ratio[] = ["9:16", "16:9", "1:1", "4:5"];
export const DRAFT_LANGS = { ar: "عربي", en: "English" } as const;
export type DraftLang = keyof typeof DRAFT_LANGS;

export type DraftRoute = "images" | "motion" | "video";
/** The visual routes, cheapest first: each scene's shortest and longest length (s) and its usual length. */
export const DRAFT_ROUTES: Record<DraftRoute, { label: string; icon: string; hint: string; minSec: number; maxSec: number; avgSec: number }> = {
  images: { label: "صور + موشن", icon: "🖼️", hint: "صورة مولّدة لكل مشهد تتحرك بالكود (زووم بطيء، انزلاق، كلام متحرك) — بدون توليد فيديو.", minSec: 2, maxSec: 12, avgSec: 5 },
  motion: { label: "موشن بالكود فقط", icon: "✨", hint: "مشاهد موشن مرسومة بالكود مثل «مختبر الموشن» — ما فيه توليد غير الصوت والموسيقى.", minSec: 2, maxSec: 12, avgSec: 5 },
  video: { label: "فيديو مولّد", icon: "🎥", hint: "كل مشهد فيديو قصير من مولّد الفيديو. أغلى طريق بفرق كبير.", minSec: 4, maxSec: 15, avgSec: 6 },
};
/** cheapest first (how the routes are shown) */
export const ROUTE_ORDER: DraftRoute[] = ["motion", "images", "video"];

/** The motion elements a scene of «موشن بالكود فقط» can be. */
export const DRAFT_MOTIONS = { title: "عنوان", phrase: "عبارة", list: "قائمة", big: "رقم كبير" } as const;
export type DraftMotion = keyof typeof DRAFT_MOTIONS;

export const DRAFT_CAPTIONS: [CaptionStyle | "none", string][] = [
  ["karaoke", "كلمة كلمة"],
  ["pop2", "كلمتين كلمتين"],
  ["classic", "عادي"],
  ["none", "بدون"],
];

/** Voices offered beside the person's own (sent as the description «حيدرا ماكس»'s voice picker reads). */
export const DRAFT_VOICES: [string, string][] = [
  ["", "تلقائي (راوي)"],
  ["elevenlabs: calm deep male narrator", "راوي هادئ"],
  ["elevenlabs: energetic young male storyteller", "حماسي"],
  ["none", "بدون تعليق صوتي"],
];
export const NO_VOICE = "none";

export const DRAFT_LIMITS = { scenes: 15, idea: 4000, title: 80, narration: 400, onScreen: 60, visual: 1200, music: 300, points: 3, point: 60, voice: 120 } as const;
/** after a scene's voice, before the next scene */
export const SCENE_TAIL_MS = 350;

export interface DraftScene {
  /** what the voice says (the script's words) */
  narration: string;
  /** the few words shown on screen */
  onScreen: string;
  /** what is seen (English, for the generator); empty in «موشن بالكود فقط» */
  visual: string;
  seconds: number;
  /** «موشن بالكود فقط»: the element the scene is */
  motion: DraftMotion;
  /** «قائمة»: its lines */
  points: string[];
}

export interface DraftPlan {
  title: string;
  scenes: DraftScene[];
  /** the music's description (English) */
  music: string;
}

export interface DraftOptions {
  seconds: DraftLength;
  ratio: Ratio;
  lang: DraftLang;
  route: DraftRoute;
  /** "" = automatic, "none" = no voice-over, else a voice's name or description */
  voice: string;
  music: boolean;
  /** a style of the library (config/film-styles.ts), "" = none */
  styleId: string;
  captions: CaptionStyle | "none";
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0009\u000b-\u001f]/g, " ").trim().slice(0, max) : "");
const half = (n: number) => Math.round(n * 2) / 2;

/** The choices as sent (anything unknown falls back to the default). */
export function readOptions(b: Record<string, unknown>): DraftOptions {
  const seconds = (DRAFT_LENGTHS as readonly number[]).includes(Number(b.seconds)) ? (Number(b.seconds) as DraftLength) : 30;
  const ratio = DRAFT_RATIOS.includes(b.ratio as Ratio) ? (b.ratio as Ratio) : "9:16";
  const lang: DraftLang = b.lang === "en" ? "en" : "ar";
  const route: DraftRoute = b.route === "motion" || b.route === "video" ? b.route : "images";
  const captions = DRAFT_CAPTIONS.some(([k]) => k === b.captions) ? (b.captions as CaptionStyle | "none") : "karaoke";
  return { seconds, ratio, lang, route, voice: str(b.voice, DRAFT_LIMITS.voice), music: b.music !== false, styleId: str(b.styleId, 60), captions };
}

export const hasVoice = (o: Pick<DraftOptions, "voice">) => o.voice !== NO_VOICE;

// ───────── the plan ─────────

/** How many scenes fit a length on a route (each scene inside the route's lengths, the total within ±10%). */
export function sceneRange(seconds: number, route: DraftRoute) {
  const r = DRAFT_ROUTES[route];
  const min = Math.max(1, Math.ceil((seconds * 0.9) / r.maxSec));
  const max = Math.max(min, Math.min(DRAFT_LIMITS.scenes, Math.floor((seconds * 1.1) / r.minSec)));
  return { min, max };
}

/** The usual number of scenes for a length on a route. */
export function suggestedScenes(seconds: number, route: DraftRoute) {
  const { min, max } = sceneRange(seconds, route);
  return Math.min(max, Math.max(min, Math.round(seconds / DRAFT_ROUTES[route].avgSec)));
}

export const planSeconds = (p: Pick<DraftPlan, "scenes">) => half(p.scenes.reduce((m, s) => m + s.seconds, 0));

export const emptyScene = (seconds = 4): DraftScene => ({ narration: "", onScreen: "", visual: "", seconds, motion: "title", points: [] });

/** A plan as Claude wrote it or the page sent it, made safe (never throws; scenes past the limit are dropped). */
export function readPlan(v: unknown): DraftPlan {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const scenes = (Array.isArray(o.scenes) ? o.scenes : [])
    .slice(0, DRAFT_LIMITS.scenes)
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s) => {
      const secs = Number(s.seconds);
      return {
        narration: str(s.narration, DRAFT_LIMITS.narration),
        onScreen: str(s.onScreen, DRAFT_LIMITS.onScreen),
        visual: str(s.visual, DRAFT_LIMITS.visual),
        seconds: Number.isFinite(secs) ? Math.min(20, Math.max(1, half(secs))) : 4,
        motion: typeof s.motion === "string" && s.motion in DRAFT_MOTIONS ? (s.motion as DraftMotion) : "title",
        points: (Array.isArray(s.points) ? s.points : []).map((x) => str(x, DRAFT_LIMITS.point)).filter(Boolean).slice(0, DRAFT_LIMITS.points),
      };
    });
  return { title: str(o.title, DRAFT_LIMITS.title), scenes, music: str(o.music, DRAFT_LIMITS.music) };
}

/** What stops a plan from being made (plain Arabic, one line each); empty = ready. */
export function planIssues(p: DraftPlan, o: Pick<DraftOptions, "seconds" | "route" | "voice">): string[] {
  const out: string[] = [];
  const r = DRAFT_ROUTES[o.route];
  const { min, max } = sceneRange(o.seconds, o.route);
  if (p.scenes.length < min) out.push(`المشاهد قليلة: لهالطول أقل شي ${min}.`);
  if (p.scenes.length > max) out.push(`المشاهد كثيرة: لهالطول أكثر شي ${max}.`);
  p.scenes.forEach((s, i) => {
    if (s.seconds < r.minSec || s.seconds > r.maxSec) out.push(`المشهد ${i + 1}: مدته لازم بين ${r.minSec} و${r.maxSec} ثانية.`);
    if (hasVoice(o) && !s.narration) out.push(`المشهد ${i + 1}: ما فيه كلام للتعليق الصوتي.`);
    if (o.route !== "motion" && !s.visual) out.push(`المشهد ${i + 1}: ما فيه وصف للي ينشاف.`);
    if (o.route === "motion" && !s.onScreen && !s.narration) out.push(`المشهد ${i + 1}: فاضي؛ اكتب كلامه أو اللي ينكتب على الشاشة.`);
  });
  const sum = planSeconds(p);
  if (p.scenes.length && Math.abs(sum - o.seconds) > o.seconds * 0.1) out.push(`مجموع المدد ${sum} ث والمطلوب ${o.seconds} ث (يسمح ±١٠٪). اضغط «وزّع المدد».`);
  return out;
}

/** The scenes' lengths fitted to the wanted length (each kept in the route's lengths, in half seconds). */
export function fitDurations(p: DraftPlan, seconds: number, route: DraftRoute): DraftPlan {
  if (!p.scenes.length) return p;
  const { minSec, maxSec } = DRAFT_ROUTES[route];
  const scenes = p.scenes.map((s) => ({ ...s }));
  const clampS = (n: number) => Math.min(maxSec, Math.max(minSec, n));
  const sum0 = scenes.reduce((m, s) => m + Math.max(0.5, s.seconds), 0);
  for (const s of scenes) s.seconds = clampS(half((Math.max(0.5, s.seconds) * seconds) / sum0));
  // what rounding and the bounds left over goes to the scenes with room, half a second at a time
  for (let guard = 0; guard < 400; guard++) {
    const diff = half(seconds - scenes.reduce((m, s) => m + s.seconds, 0));
    if (diff === 0) break;
    const step = diff > 0 ? 0.5 : -0.5;
    const room = scenes.filter((s) => (step > 0 ? s.seconds < maxSec : s.seconds > minSec));
    if (!room.length) break;
    // the longest gives first, the shortest takes first (the lengths stay even)
    room.sort((a, b) => (step > 0 ? a.seconds - b.seconds : b.seconds - a.seconds))[0].seconds += step;
  }
  return { ...p, scenes };
}

/** What Claude answers (strict JSON). */
export const DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "music", "scenes"],
  properties: {
    title: { type: "string", description: "A short title for the video, in the video's language (at most 8 words)." },
    music: { type: "string", description: "The background music in English: genre, mood, instruments, tempo. Instrumental only." },
    scenes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["narration", "onScreen", "visual", "seconds", "motion", "points"],
        properties: {
          narration: { type: "string", description: "What the voice says in this scene, in the video's language. Spoken, natural, short sentences." },
          onScreen: { type: "string", description: "2–6 words shown big on screen (the scene's key idea), in the video's language." },
          visual: { type: "string", description: "What is seen, in detailed English for the generator (subject, action, setting, light, camera). Empty for the motion-only route." },
          seconds: { type: "number", description: "The scene's length in seconds (the note gives the range)." },
          motion: { type: "string", enum: ["title", "phrase", "list", "big"], description: "Motion-only route: the element the scene is (title = a heading, phrase = a sentence with one stressed word, list = up to 3 short points, big = a number counting up). Else \"title\"." },
          points: { type: "array", items: { type: "string" }, description: "Motion-only route with motion \"list\": up to 3 very short points. Else empty." },
        },
      },
    },
  },
} as const;

// ───────── the parts (each one an ordinary JAWAD AI job) ─────────

export type PartKind = "image" | "video" | "speech" | "music";
export interface DraftPart {
  /** v{i}: scene i's picture or video · s{i}: scene i's voice · m: the music */
  key: string;
  kind: PartKind;
  scene: number | null;
}

export const partLabel = (p: Pick<DraftPart, "kind" | "scene">) => (p.kind === "music" ? "الموسيقى" : `${p.kind === "speech" ? "صوت" : p.kind === "video" ? "فيديو" : "صورة"} المشهد ${(p.scene ?? 0) + 1}`);

/** Everything to make for a plan, music first, then each scene's picture and voice. */
export function draftParts(p: DraftPlan, o: Pick<DraftOptions, "route" | "voice" | "music">): DraftPart[] {
  const out: DraftPart[] = [];
  if (o.music) out.push({ key: "m", kind: "music", scene: null });
  p.scenes.forEach((_, i) => {
    if (o.route !== "motion") out.push({ key: `v${i}`, kind: o.route === "video" ? "video" : "image", scene: i });
    if (hasVoice(o)) out.push({ key: `s${i}`, kind: "speech", scene: i });
  });
  return out;
}

/** The music's length (s): the video's, in steps of 5 as the generator takes it. */
export const musicSeconds = (p: DraftPlan) => Math.min(300, Math.max(10, Math.ceil(planSeconds(p) / 5) * 5));

/** What one part asks the generator for («اصنع لي…»'s request, priced and started by the server). */
export function partSpec(part: DraftPart, p: DraftPlan, o: Pick<DraftOptions, "ratio" | "voice">): MakeSpec {
  const s = part.scene != null ? p.scenes[part.scene] : null;
  const tall = RATIOS[o.ratio].height > RATIOS[o.ratio].width;
  const name = `${p.title || "مسودة"} · ${partLabel(part)}`.slice(0, 80);
  const base = { aspect: o.ratio, voice: "", withSound: false, quality: "", place: "library" as const, at: 0, name };
  switch (part.kind) {
    case "image":
      return { ...base, makeKind: "image", seconds: 0, quality: "medium", prompt: `${s?.visual ?? ""}\n\nA ${tall ? "vertical" : "wide"} cinematic frame, the subject clear, modest clothing. No writing, letters, captions or logos anywhere in the picture.` };
    case "video":
      return { ...base, makeKind: "video", seconds: Math.min(15, Math.max(4, Math.round(s?.seconds ?? 5))), quality: "720p", prompt: `${s?.visual ?? ""}\n\nOne continuous shot, smooth camera, modest clothing. No on-screen text.` };
    case "speech":
      return { ...base, makeKind: "speech", seconds: 0, voice: o.voice, prompt: s?.narration ?? "" };
    case "music":
      return { ...base, makeKind: "music", seconds: musicSeconds(p), prompt: p.music || "calm modern cinematic instrumental background, soft piano and strings, steady tempo" };
  }
}

/** A stand-in plan to price a route before Claude writes anything (scenes of the usual count and talking pace). */
export function samplePlan(seconds: number, route: DraftRoute, lang: DraftLang): DraftPlan {
  const n = suggestedScenes(seconds, route);
  const each = seconds / n;
  // about 2.3 spoken words a second (Arabic) / 2.6 (English)
  const words = Math.max(3, Math.round(each * (lang === "en" ? 2.6 : 2.3)));
  const narration = Array.from({ length: words }, () => (lang === "en" ? "words" : "كلمة")).join(" ");
  return fitDurations({ title: "", music: "", scenes: Array.from({ length: n }, () => ({ ...emptyScene(each), narration, onScreen: "—", visual: "a calm landscape at sunrise" })) }, seconds, route);
}

// ───────── the price ─────────

export interface PricedPart extends DraftPart {
  coins: number;
  /** why it can't be made now (the generator is closed, a setting it refuses…) */
  error?: string | null;
}

/** The total of a route = the sum of its parts (the planning is priced on its own, before it). */
export const draftTotal = (parts: { coins: number }[]) => parts.reduce((m, x) => m + Math.max(0, Math.round(x.coins) || 0), 0);

/** The price said in groups: the pictures (or videos), the voice, the music, and the total. */
export function priceGroups(parts: Pick<PricedPart, "kind" | "coins">[]) {
  const of = (k: PartKind[]) => draftTotal(parts.filter((x) => k.includes(x.kind)));
  return { visuals: of(["image", "video"]), voice: of(["speech"]), music: of(["music"]), total: draftTotal(parts) };
}

// ───────── running it ─────────

export type PartState = "queued" | "starting" | "waiting" | "ready" | "failed" | "placed" | "stopped";
export interface PartRun extends DraftPart {
  coins: number;
  state: PartState;
  /** how many times it was started (a new start is a new job, never the failed one again) */
  attempt: number;
  jobId: string | null;
  assetId?: string | null;
  durationMs?: number | null;
  error?: string | null;
}

export const isActive = (s: PartState) => s === "starting" || s === "waiting";

/** Where a run stands: all settled (nothing queued or on its way) is when the draft is built. */
export function runSummary(parts: Pick<PartRun, "state">[]) {
  const n = (k: PartState[]) => parts.filter((x) => k.includes(x.state)).length;
  const done = n(["ready", "placed"]);
  const failed = n(["failed", "stopped"]);
  const left = n(["queued", "starting", "waiting"]);
  return { total: parts.length, done, failed, left, active: n(["starting", "waiting"]), settled: left === 0 };
}

/** The next parts to start, keeping at most `max` on their way at once (JAWAD AI's limit on running jobs). */
export function nextToStart(parts: PartRun[], max: number) {
  const room = Math.max(0, max - parts.filter((x) => isActive(x.state)).length);
  return parts.filter((x) => x.state === "queued").slice(0, room);
}

/** A scene's parts as one status: «جاهز», «يتجهز», «في الدور», «ما نجح». */
export function sceneState(parts: PartRun[], scene: number): "ready" | "working" | "queued" | "failed" | "none" {
  const mine = parts.filter((x) => x.scene === scene);
  if (!mine.length) return "none";
  if (mine.some((x) => x.state === "failed" || x.state === "stopped")) return "failed";
  if (mine.every((x) => x.state === "ready" || x.state === "placed")) return "ready";
  if (mine.some((x) => isActive(x.state))) return "working";
  return "queued";
}

/** Failed parts made again: queued once more as a new attempt (the job that failed was refunded by JAWAD AI). */
export function retryParts(parts: PartRun[], keys: string[]): PartRun[] {
  return parts.map((x) => (keys.includes(x.key) && (x.state === "failed" || x.state === "stopped") ? { ...x, state: "queued" as const, attempt: x.attempt + 1, jobId: null, error: null } : x));
}

// ───────── the timeline ─────────

export interface DraftFile {
  assetId: string;
  kind: "image" | "video" | "audio";
  durationMs: number | null;
}

/** «هويتي» when set: its colours (the first is the accent) and an editor font. */
export interface DraftLook {
  colors: string[];
  font: string | null;
}

export interface BuiltInfo {
  mainId: string;
  voiceId: string;
  musicId: string;
  /** each scene's place on the timeline */
  scenes: { start: number; len: number }[];
}

export interface Built {
  timeline: Timeline;
  info: BuiltInfo;
  /** scenes whose picture or video isn't there (failed): their place shows the moving background */
  gaps: number[];
}

const HEX = /^#[0-9a-f]{6}$/i;

function blank(o: Partial<Clip> & Pick<Clip, "start" | "out">): Clip {
  return { id: newId("c"), assetId: null, seq: null, in: 0, speed: 1, volume: 1, fit: "cover", transform: { ...DEFAULT_TRANSFORM }, text: null, keys: [], color: null, grades: [], transition: null, fadeIn: 0, fadeOut: 0, shape: "rect", crop: null, blend: "normal", key: null, words: [], bg: null, sound: null, anim: null, fx: [], own: false, fix: null, ...o };
}
const track = (kind: Track["kind"], name: string, more: Partial<Track> = {}): Track => ({ id: newId("t"), kind, name, muted: false, hidden: false, locked: false, duck: false, clips: [], ...more });

/** Each scene's length (ms): its voice and a breath after it, else what the plan says. */
export function sceneLengths(p: DraftPlan, files: Record<string, DraftFile | undefined>): number[] {
  return p.scenes.map((s, i) => {
    const v = files[`s${i}`];
    if (v?.durationMs && v.durationMs > 0) return Math.max(1200, Math.round(v.durationMs + SCENE_TAIL_MS));
    return Math.max(LIMITS.minClipMs, Math.round(s.seconds * 1000));
  });
}

/** The slow moves a picture makes (ken burns / a drift), one after another so no two scenes move alike. */
const MOVES: [Pick<Key, "x" | "y" | "scale">, Pick<Key, "x" | "y" | "scale">][] = [
  [{ x: 0.5, y: 0.5, scale: 1 }, { x: 0.5, y: 0.5, scale: 1.14 }],
  [{ x: 0.46, y: 0.5, scale: 1.12 }, { x: 0.54, y: 0.5, scale: 1.12 }],
  [{ x: 0.5, y: 0.5, scale: 1.16 }, { x: 0.5, y: 0.5, scale: 1.03 }],
  [{ x: 0.5, y: 0.54, scale: 1.1 }, { x: 0.5, y: 0.46, scale: 1.16 }],
  [{ x: 0.54, y: 0.5, scale: 1.12 }, { x: 0.46, y: 0.5, scale: 1.12 }],
];

/** A scene's picture (moving slowly) or video (slowed a little when the voice is longer than it) on the main track. */
export function visualClip(file: DraftFile, i: number, start: number, len: number): Clip {
  if (file.kind === "image") {
    const [a, b] = MOVES[i % MOVES.length];
    const key = (t: number, m: Pick<Key, "x" | "y" | "scale">): Key => ({ t, rotate: 0, opacity: 1, ...m });
    return blank({ assetId: file.assetId, start, out: len, keys: [key(0, a), key(len, b)], transform: { ...DEFAULT_TRANSFORM, ...a } });
  }
  const d = file.durationMs && file.durationMs > LIMITS.minClipMs ? file.durationMs : len;
  if (d >= len) return blank({ assetId: file.assetId, start, out: len, volume: 0 });
  // a little slower to cover the words (never below half speed: past that it shows)
  const speed = Math.max(0.5, d / len);
  return blank({ assetId: file.assetId, start, out: d, speed, volume: 0 });
}

export const voiceClip = (file: DraftFile, start: number, len: number) => blank({ assetId: file.assetId, start, out: Math.max(LIMITS.minClipMs, Math.round(file.durationMs && file.durationMs > 0 ? file.durationMs : len)) });

export function musicClip(file: DraftFile, total: number) {
  const len = Math.max(LIMITS.minClipMs, Math.min(total, file.durationMs && file.durationMs > 0 ? file.durationMs : total));
  return blank({ assetId: file.assetId, start: 0, out: len, volume: 0.5, fadeIn: 600, fadeOut: Math.min(1500, Math.round(len / 3)) });
}

/** Spoken words, each with its share of `ms` by its length (an estimate: the job doesn't tell when each word is said). */
export function wordTimes(text: string, ms: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const weight = words.map((w) => w.length + 1);
  const all = weight.reduce((m, x) => m + x, 0) || 1;
  let at = 0;
  return words.map((w, i) => {
    const s = at;
    at += (weight[i] / all) * ms;
    return { w, s: Math.round(s), e: Math.round(at) };
  });
}

const ENDS = /[.!?؟،,؛:…]$/;
/** A scene's narration as captions (phrases of a few words, each word timed inside its phrase). */
export function captionItems(text: string, start: number, ms: number, maxWords: number) {
  const words = wordTimes(text, ms);
  const out: { start: number; end: number; body: string; words: { s: number; e: number; w: string }[] }[] = [];
  let cur: typeof words = [];
  const flush = () => {
    if (!cur.length) return;
    const s0 = cur[0].s;
    out.push({ start: start + s0, end: start + Math.max(cur[cur.length - 1].e, s0 + 300), body: cur.map((w) => w.w).join(" "), words: cur.map((w) => ({ s: w.s - s0, e: w.e - s0, w: w.w })) });
    cur = [];
  };
  for (const w of words) {
    cur.push(w);
    if (cur.length >= maxWords || ENDS.test(w.w)) flush();
  }
  flush();
  return out;
}

function motionColors(look: DraftLook): MotionColors | null {
  const c = look.colors.filter((x) => HEX.test(x));
  if (!c.length) return null;
  return { bg: "#0b1020", panel: "#151b30", text: "#ffffff", accent: c[0].toLowerCase(), second: (c[1] ?? c[0]).toLowerCase() };
}

/** «موشن بالكود فقط»: the scene as a motion element (a heading, a phrase, a list or a number). */
export function sceneMotion(s: DraftScene, len: number, look: DraftLook, tall: boolean): MotionEl {
  const font = look.font ?? "readex";
  const colors = motionColors(look);
  const words = (s.onScreen || s.narration).trim();
  const common = { font, ...(colors ? { colors } : { theme: "navy" as const }), size: tall ? 1.1 : 1 };
  const num = /[0-9٠-٩]+/.exec(`${s.onScreen} ${s.narration}`)?.[0];
  if (s.motion === "big" && num) return newMotion("big", { ...common, title: words.replace(num, "").trim().slice(0, 120) || words.slice(0, 120), sub: num, unit: "", y: 0.42 });
  if (s.motion === "list" && s.points.length) {
    const step = Math.max(400, Math.min(1200, Math.round((len - 800) / (s.points.length + 1))));
    return newMotion("list", { ...common, title: s.onScreen.slice(0, 120), items: s.points.map((text, k) => ({ text, at: 500 + k * step })), y: 0.5 });
  }
  if (s.motion === "phrase") {
    const last = words.split(/\s+/).filter(Boolean).pop() ?? "";
    return newMotion("phrase", { ...common, title: words.slice(0, 120), sub: last.slice(0, 80), y: 0.45, panel: false });
  }
  return newMotion("title", { ...common, title: words.slice(0, 120), sub: "", y: 0.4 });
}

const WORDS_PER_CAPTION: Record<CaptionStyle, number> = { karaoke: 4, pop2: 2, classic: 6, box: 6, neon: 4, poem: 8 };

/**
 * The draft as one ordinary timeline, from what came back (`files` by part key; a missing one leaves its place): the
 * moving background under everything, the scenes on the main track, the words on screen, the captions, the voice and
 * the music (quieter under the voice).
 */
export function assembleDraft(p: DraftPlan, o: Pick<DraftOptions, "route" | "ratio" | "captions">, files: Record<string, DraftFile | undefined>, look: DraftLook): Built {
  const { width, height } = RATIOS[o.ratio] ?? RATIOS["9:16"];
  const tall = height > width;
  const lens = sceneLengths(p, files);
  const starts: number[] = [];
  let at = 0;
  for (const l of lens) {
    starts.push(at);
    at += l;
  }
  const total = Math.max(LIMITS.minClipMs, at);
  const font = look.font ?? "readex";
  const accent = look.colors.find((c) => HEX.test(c)) ?? null;

  // under everything: soft shapes drifting on the brand's colours (what a missing scene shows)
  const bg = track("text", "خلفية متحركة", { motion: true, color: "#8b5cf6" });
  const ambient = newMotion("ambient", { ...(motionColors(look) ? { colors: motionColors(look)! } : { theme: "comfort" as const }), shape: "orbs", speed: 0.8 });
  bg.clips.push(blank({ start: 0, out: total, fit: "contain", text: { ...DEFAULT_TEXT, body: "خلفية متحركة" }, motion: ambient }));

  const main = track("video", "مشاهد المسودة");
  const gaps: number[] = [];
  if (o.route !== "motion") {
    p.scenes.forEach((_, i) => {
      const f = files[`v${i}`];
      if (!f || (f.kind !== "image" && f.kind !== "video")) {
        gaps.push(i);
        return;
      }
      main.clips.push(visualClip(f, i, starts[i], lens[i]));
    });
    // a soft change between scenes that touch
    const kind = o.route === "video" ? "fade" : "softDissolve";
    main.clips.forEach((c, k) => {
      const next = main.clips[k + 1];
      if (next && next.start === c.start + Math.round((c.out - c.in) / (c.speed || 1))) c.transition = { kind, ms: 400 };
    });
  }

  const tracks: Track[] = [bg, main];
  if (o.route === "motion") {
    const scenesTrack = track("text", "موشن المشاهد", { motion: true, color: "#8b5cf6" });
    p.scenes.forEach((s, i) => {
      if (!s.onScreen && !s.narration) return;
      const m = sceneMotion(s, lens[i], look, tall);
      scenesTrack.clips.push(blank({ start: starts[i], out: lens[i], fit: "contain", text: { ...DEFAULT_TEXT, body: (m.title || "موشن").slice(0, LIMITS.text) }, motion: m }));
    });
    tracks.push(scenesTrack);
  } else {
    const words = track("text", "كلام الشاشة");
    const style: Partial<TextStyle> = { size: tall ? 0.062 : 0.075, weight: 900, color: "#ffffff", font, box: accent, highlight: null };
    const anims: AnimKind[] = ["pop", "rise", "fromRight", "settle"];
    p.scenes.forEach((s, i) => {
      if (!s.onScreen || lens[i] < 1200) return;
      const from = starts[i] + 250;
      const len = lens[i] - 400;
      const inK = anims[i % anims.length];
      words.clips.push(blank({ start: from, out: len, fit: "contain", transform: { ...DEFAULT_TRANSFORM, y: tall ? 0.2 : 0.16 }, text: { ...DEFAULT_TEXT, ...style, body: s.onScreen.slice(0, LIMITS.text) }, anim: { in: inK, out: "fade", inMs: 380, outMs: 250 }, own: true }));
    });
    if (words.clips.length) tracks.push(words);
  }

  if (o.captions !== "none") {
    const look0 = CAPTION_STYLES[o.captions] ?? CAPTION_STYLES.karaoke;
    const cap = track("text", "كابشن");
    const y = tall ? 0.74 : 0.85;
    const style: Partial<TextStyle> = { ...look0.style, font, ...(accent && look0.style.highlight ? { highlight: accent } : {}) };
    p.scenes.forEach((s, i) => {
      if (!s.narration) return;
      const v = files[`s${i}`];
      const ms = v?.durationMs && v.durationMs > 0 ? v.durationMs : lens[i] - SCENE_TAIL_MS;
      for (const it of captionItems(s.narration, starts[i] + 60, Math.max(600, ms - 60), WORDS_PER_CAPTION[o.captions as CaptionStyle] ?? 4)) {
        cap.clips.push(blank({ start: it.start, out: Math.max(LIMITS.minClipMs, it.end - it.start), fit: "contain", transform: { ...DEFAULT_TRANSFORM, y }, text: { ...DEFAULT_TEXT, ...style, body: it.body.slice(0, LIMITS.text) }, words: it.words.slice(0, LIMITS.words) }));
      }
    });
    // phrases never overlap on one track
    let end = 0;
    cap.clips = cap.clips.filter((c) => {
      if (c.start < end) {
        const cut = end - c.start;
        if (c.out - cut < LIMITS.minClipMs) return false;
        c.start = end;
        c.out -= cut;
        c.words = c.words.map((w) => ({ ...w, s: Math.max(0, w.s - cut), e: Math.max(0, w.e - cut) }));
      }
      end = c.start + c.out;
      return true;
    });
    if (cap.clips.length) tracks.push(cap);
  }

  const voice = track("audio", "التعليق الصوتي");
  p.scenes.forEach((_, i) => {
    const f = files[`s${i}`];
    if (f?.kind === "audio") voice.clips.push(voiceClip(f, starts[i], lens[i]));
  });
  const music = track("audio", "الموسيقى", { duck: true });
  const mf = files.m;
  if (mf?.kind === "audio") music.clips.push(musicClip(mf, total));
  tracks.push(voice, music);

  const timeline: Timeline = {
    v: EDITOR_VERSION,
    width,
    height,
    fps: 30,
    background: "#000000",
    // with a scene missing or short, the main track keeps its place in time (the magnet would pull the next scenes off their words)
    // (also when a video slowed to half speed still ends before its scene does)
    magnetic: o.route !== "motion" && gaps.length === 0 && main.clips.every((c, k) => c.start === (k ? main.clips[k - 1].start + Math.round((main.clips[k - 1].out - main.clips[k - 1].in) / (main.clips[k - 1].speed || 1)) : 0)),
    magnetAll: false,
    markers: [],
    tracks,
  };
  return { timeline, info: { mainId: main.id, voiceId: voice.id, musicId: music.id, scenes: lens.map((len, i) => ({ start: starts[i], len })) }, gaps };
}

/** The draft put on the timeline as ONE change: a new «تسلسل» when the open one already has something on it. */
export function draftCommands(b: Built, now: Pick<Timeline, "tracks">, name: string): Command[] {
  const busy = now.tracks.some((t) => t.clips.length);
  const title = (name.trim() || "مسودة").slice(0, 40);
  return [...(busy ? [{ type: "seq_new" as const, name: title }] : []), { type: "use_template", name: title, timeline: b.timeline }];
}

/** A part that arrives after the draft was built (made again with «أعد هالمشهد»): put in its own place. */
export function placeLate(info: BuiltInfo, part: Pick<DraftPart, "kind" | "scene">, file: DraftFile): Command[] {
  if (part.kind === "music") return [{ type: "paste_clips", clips: [{ clip: musicClip(file, info.scenes.reduce((m, s) => Math.max(m, s.start + s.len), 0)), trackId: info.musicId }], at: 0 }];
  const sc = part.scene != null ? info.scenes[part.scene] : null;
  if (!sc) return [];
  if (part.kind === "speech") return [{ type: "paste_clips", clips: [{ clip: voiceClip(file, sc.start, sc.len), trackId: info.voiceId }], at: sc.start }];
  return [{ type: "paste_clips", clips: [{ clip: visualClip(file, part.scene!, sc.start, sc.len), trackId: info.mainId }], at: sc.start }];
}
