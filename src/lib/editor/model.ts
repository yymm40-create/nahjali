// «حيدرة كت» — the timeline document. Pure (browser and server). Times are whole milliseconds on the timeline;
// a clip shows its source from `in` to `out` (source milliseconds) starting at `start`. Media files are never
// changed: clips only point at them, so every edit can be undone.
//
// Tracks are drawn bottom to top in array order: the first video track is the main one (magnetic: no gaps), tracks
// after it are drawn over it. Audio tracks are heard, not drawn. Time always runs left → right, even in Arabic.

import { FX_BY_ID, FX_MAX } from "./effects";
import { TR_LIST } from "./transitions";
import { isFont } from "./fonts";
import { readGrades, type Grade } from "./grade";

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
  /** "readex" | "naskh" | "kufi" (the page's own) or a font id from fonts.ts */
  font: string;
  /** captions: the word being said right now in this colour (null = plain text) */
  highlight: string | null;
}

/** A caption's spoken word: from `s` to `e` ms after the clip starts. */
export interface Word {
  s: number;
  e: number;
  w: string;
}

/** Ready caption looks (the text style, and how high on the frame). */
export const CAPTION_STYLES = {
  karaoke: { label: "كلمة بكلمة", style: { color: "#ffffff", highlight: "#facc15", weight: 900, size: 0.056, box: null, font: "readex" } },
  classic: { label: "كلاسيكي", style: { color: "#ffffff", highlight: null, weight: 700, size: 0.052, box: null, font: "readex" } },
  box: { label: "على خلفية", style: { color: "#ffffff", highlight: null, weight: 700, size: 0.05, box: "#000000b3", font: "readex" } },
  neon: { label: "نيون", style: { color: "#b8f53d", highlight: "#ffffff", weight: 900, size: 0.064, box: null, font: "kufi" } },
  poem: { label: "قصيدة", style: { color: "#fef3c7", highlight: "#f59e0b", weight: 700, size: 0.058, box: null, font: "naskh" } },
} as const satisfies Record<string, { label: string; style: Partial<TextStyle> }>;
export type CaptionStyle = keyof typeof CAPTION_STYLES;

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
/** The 100 transitions (transitions.ts): an id → its name and icon. */
export const TRANSITIONS: Record<string, { label: string; icon: string }> = Object.fromEntries(TR_LIST.map((t) => [t.id, { label: t.label, icon: t.icon }]));
export type TransitionKind = string;
export interface Transition {
  kind: TransitionKind;
  ms: number;
}
export const TRANSITION_MS = { min: 100, max: 4000, default: 600 } as const;

/**
 * The person kept, the background around them changed (MediaPipe in the browser): removed (what is under the clip
 * shows through), blurred, or one colour.
 */
export interface Backdrop {
  mode: "remove" | "blur" | "color";
  color: string;
  /** blur strength 1–100 */
  blur: number;
}
export const DEFAULT_BACKDROP: Backdrop = { mode: "blur", color: "#16a34a", blur: 40 };

/** A sound effect on a clip (Web Audio nodes, the same in the preview and the export). */
export const SOUND_EFFECTS = {
  echo: { label: "صدى", icon: "🔁" },
  reverb: { label: "قاعة", icon: "🏛️" },
  stadium: { label: "ملعب", icon: "🏟️" },
  cave: { label: "كهف", icon: "🕳️" },
  radio: { label: "راديو", icon: "📻" },
  phone: { label: "تلفون", icon: "📞" },
  megaphone: { label: "مكبّر", icon: "📢" },
  underwater: { label: "تحت الماء", icon: "🌊" },
  robot: { label: "روبوت", icon: "🤖" },
} as const;
export type SoundEffect = keyof typeof SOUND_EFFECTS;

/** A clip's sound work: noise taken out, the voice polished, an effect, the voice's pitch. */
export interface SoundFx {
  /** noise reduction 0–1 (0 = off) */
  clean: number;
  /** voice enhancer: rumble cut, less mud, more presence, evened out */
  enhance: boolean;
  effect: SoundEffect | null;
  /** how much of the effect is heard 0–1 */
  mix: number;
  /** semitones −12…12, the length unchanged (− deeper, + thinner) */
  pitch: number;
}
export const NO_SOUND_FX: SoundFx = { clean: 0, enhance: false, effect: null, mix: 0.5, pitch: 0 };
export const hasSoundFx = (c: { sound: SoundFx | null }) => !!c.sound && (c.sound.clean > 0 || c.sound.enhance || !!c.sound.effect || c.sound.pitch !== 0);

/**
 * Entrances and exits («دخول» / «خروج») for texts and pictures. Nothing animates letter by letter (that breaks the
 * joined Arabic letters): «كتابة» reveals from the right, «كلمة كلمة» pops whole words, «مطّ» uses the kashida.
 */
export const ANIMS = {
  fade: { label: "ظهور", icon: "◐", ms: 400 },
  pop: { label: "نبضة", icon: "💥", ms: 380 },
  punch: { label: "زووم قوي", icon: "⚡", ms: 280 },
  blur: { label: "ضباب", icon: "🌫️", ms: 500 },
  rise: { label: "صعود", icon: "⬆️", ms: 450 },
  fromRight: { label: "من اليمين", icon: "⬅️", ms: 450 },
  fromLeft: { label: "من اليسار", icon: "➡️", ms: 450 },
  drop: { label: "سقوط", icon: "⬇️", ms: 600 },
  spin: { label: "دوران", icon: "🌀", ms: 520 },
  flip: { label: "قلب ثلاثي", icon: "🔄", ms: 450 },
  glitch: { label: "قلتش", icon: "📺", ms: 320 },
  shake: { label: "اهتزاز", icon: "🫨", ms: 420 },
  wipe: { label: "كتابة", icon: "✍️", ms: 700 },
  whip: { label: "سحبة", icon: "💨", ms: 280 },
  flash: { label: "فلاش", icon: "✨", ms: 220 },
  words: { label: "كلمة كلمة", icon: "🔤", ms: 900, only: "text" },
  kashida: { label: "مطّ", icon: "〰️", ms: 650, only: "text" },
  kenburns: { label: "كين بيرنز", icon: "🎞️", ms: 0, only: "media" },
} as const satisfies Record<string, { label: string; icon: string; ms: number; only?: "text" | "media" }>;
export type AnimKind = keyof typeof ANIMS;
export interface Anim {
  in: AnimKind | null;
  out: AnimKind | null;
  inMs: number;
  outMs: number;
}
export const ANIM_MS = { min: 100, max: 3000 } as const;

/** What an entrance or exit does to a clip at one moment (on top of its own look). */
export interface AnimLook {
  alpha: number;
  /** shift, fractions of the frame */
  dx: number;
  dy: number;
  scale: number;
  rotate: number;
  /** vertical squash (the 3D flip) */
  squash: number;
  /** blur, a fraction of the frame's height */
  blur: number;
  /** the share of the clip shown, from its right side («كتابة»); null = all */
  show: number | null;
  /** white over the clip 0–1 */
  flash: number;
  /** motion trail 0–1 («سحبة») */
  smear: number;
  /** torn slices 0–1 («قلتش»), with a seed per frame */
  tear: number;
  seed: number;
  /** words appearing one by one 0–1 (null = all there) */
  words: number | null;
  /** kashida stretch 0–1 */
  kashida: number;
}
export const STILL: AnimLook = { alpha: 1, dx: 0, dy: 0, scale: 1, rotate: 0, squash: 1, blur: 0, show: null, flash: 0, smear: 0, tear: 0, seed: 0, words: null, kashida: 0 };

const outCubic = (p: number) => 1 - (1 - p) ** 3;
const outExpo = (p: number) => (p >= 1 ? 1 : 1 - 2 ** (-10 * p));
const outBack = (p: number) => 1 + 2.70158 * (p - 1) ** 3 + 1.70158 * (p - 1) ** 2;
const spring = (p: number) => 1 - Math.exp(-6 * p) * Math.cos(12 * p);

/** `p` runs from 0 (out of sight) to 1 (in place): an entrance plays it forwards, an exit backwards. */
function animStep(k: AnimKind, p: number, l: AnimLook, ms: number, entering: boolean) {
  const q = Math.min(1, Math.max(0, p));
  switch (k) {
    case "fade":
      l.alpha *= outCubic(q);
      break;
    case "pop":
      l.scale *= Math.max(0.001, outBack(q));
      l.alpha *= Math.min(1, q * 3);
      break;
    case "punch":
      l.scale *= 1 + 0.6 * (1 - outExpo(q));
      l.alpha *= Math.min(1, q * 4);
      if (entering) l.flash = Math.max(l.flash, Math.max(0, 1 - q * 3) * 0.8);
      break;
    case "blur": {
      const e = outCubic(q);
      l.blur += 0.02 * (1 - e);
      l.scale *= 1 + 0.1 * (1 - e);
      l.alpha *= e;
      break;
    }
    case "rise":
      l.dy += (entering ? 0.12 : -0.12) * (1 - outExpo(q));
      l.alpha *= Math.min(1, q * 2);
      break;
    case "fromRight":
      l.dx += (entering ? 0.6 : -0.6) * (1 - outExpo(q));
      l.alpha *= Math.min(1, q * 2);
      break;
    case "fromLeft":
      l.dx -= (entering ? 0.6 : -0.6) * (1 - outExpo(q));
      l.alpha *= Math.min(1, q * 2);
      break;
    case "drop": {
      const s = spring(q);
      l.dy -= 0.12 * (1 - s);
      l.rotate += -8 * (1 - s);
      l.alpha *= Math.min(1, q * 3);
      break;
    }
    case "spin":
      l.rotate += -180 * (1 - outBack(q));
      l.scale *= Math.max(0.001, outBack(q));
      l.alpha *= Math.min(1, q * 2);
      break;
    case "flip":
      l.squash *= Math.max(0.001, Math.sin((q * Math.PI) / 2));
      break;
    case "glitch": {
      const frame = Math.floor(ms / 33);
      l.tear = Math.max(l.tear, 1 - q);
      l.seed = frame;
      l.dx += (((frame * 9301 + 49297) % 233280) / 233280 - 0.5) * 0.05 * (1 - q);
      if (q < 1 && frame % 3 === 0) l.alpha *= 0.45;
      break;
    }
    case "shake": {
      const amp = 0.018 * (1 - q);
      l.dx += amp * Math.sin((ms / 1000) * 2 * Math.PI * 31);
      l.dy += amp * Math.cos((ms / 1000) * 2 * Math.PI * 27);
      l.rotate += 2 * (1 - q) * Math.sin((ms / 1000) * 2 * Math.PI * 23);
      break;
    }
    case "wipe":
      l.show = Math.min(l.show ?? 1, outCubic(q));
      break;
    case "whip":
      l.dx += (entering ? 0.8 : -0.8) * (1 - outExpo(q));
      l.smear = Math.max(l.smear, 1 - q);
      break;
    case "flash":
      l.flash = Math.max(l.flash, 1 - q);
      break;
    case "words":
      l.words = Math.min(l.words ?? 1, q);
      break;
    case "kashida":
      l.kashida = Math.max(l.kashida, 1 - outCubic(q));
      break;
    case "kenburns":
      break;
  }
}

/** A clip's entrance, exit and slow move («كين بيرنز») at timeline time `ms`. */
export function animAt(c: Pick<Clip, "anim" | "start" | "in" | "out" | "speed">, ms: number): AnimLook {
  const a = c.anim;
  if (!a) return STILL;
  const l = { ...STILL };
  const len = clipLength(c);
  const t = Math.min(len, Math.max(0, ms - c.start));
  if (a.in === "kenburns") {
    // the whole clip: a slow push in with a little drift
    const p = len ? t / len : 0;
    const e = 0.5 - 0.5 * Math.cos(Math.PI * p);
    l.scale *= 1 + 0.15 * e;
    l.dx += 0.025 * (e - 0.5);
  } else if (a.in) {
    const d = Math.min(a.inMs, len / 2);
    if (t < d) animStep(a.in, t / d, l, t, true);
  }
  if (a.out && a.out !== "kenburns") {
    const d = Math.min(a.outMs, len / 2);
    if (t > len - d) animStep(a.out, (len - t) / d, l, t, false);
  }
  return l;
}

/** Arabic stretched with the kashida (ـ) between joined letters, `n` per joint. */
export function kashida(body: string, n: number) {
  if (n <= 0) return body;
  // letters that join the next one (not ا د ذ ر ز و ة ى ء and the alif forms)
  const joins = /[\u0628\u062A\u062B\u062C\u062D\u062E\u0633-\u063A\u0641-\u0647\u064A\u0626\u06A9\u06AF\u06CC\u067E\u0686]/;
  const letter = /[\u0621-\u064A\u0671-\u06D3]/;
  const fill = "\u0640".repeat(n);
  let out = "";
  const chars = [...body];
  chars.forEach((ch, i) => {
    out += ch;
    const next = chars.slice(i + 1).find((x) => !/[\u064B-\u065F\u0670]/.test(x));
    if (joins.test(ch) && next && letter.test(next)) out += fill;
  });
  return out;
}

/** A moment of a moving clip («نقطة حركة»): where it is at source time `t` (ms); between two points it glides. */
export interface Key extends Transform {
  t: number;
}

export interface Clip {
  id: string;
  /** the media file (null for a text clip and a nested timeline) */
  assetId: string | null;
  /** «Nest»: another of the project's timelines used here as one clip (its in/out are that timeline's own time) */
  seq: string | null;
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
  /** «التلوين»: grading layers (grade.ts), run in order on the GPU; [] = none */
  grades: Grade[];
  /** into the next clip on the same track, when it starts right where this one ends */
  transition: Transition | null;
  /** sound fading in at the start and out at the end (ms) */
  fadeIn: number;
  fadeOut: number;
  /** the picture's outline: picture-in-picture looks better rounded or round */
  shape: "rect" | "rounded" | "circle";
  /** «القص» (crop): the share of each side hidden (the picture keeps its size and place) */
  crop: Crop | null;
  /** «الشفافية»: how the clip mixes with what is under it (Premiere's blend modes; "normal" = over it) */
  blend: BlendMode;
  /** «الكي» (keying): a colour (green screen) or the dark/bright parts made see-through */
  key: Keyer | null;
  /** captions: when each word is said (text clips only) */
  words: Word[];
  /** pictures only: the person cut out from their background */
  bg: Backdrop | null;
  /** media with sound: noise reduction, voice enhancer, effect, pitch (null = as recorded) */
  sound: SoundFx | null;
  /** texts and pictures: how it comes in and goes out (null = it just appears) */
  anim: Anim | null;
  /** pictures: effects on the clip itself (effects.ts), up to three, each with a strength 0–1 */
  fx: ClipFx[];
  /**
   * text only: this caption keeps its own look («منفصل»). The track's group changes skip it; when it joins again it
   * keeps what it has and later group changes reach it field by field.
   */
  own: boolean;
  /** «التعديل الذكي»: a piece lifted onto the red track, with what to fix in it (null elsewhere) */
  fix: Fix | null;
}

/** What to do with a piece on the red track: the note for Claude and how much of the video is made again. */
export interface Fix {
  note: string;
  /** parts = only this piece (cut back in on its first/last frames); whole = the whole video made again */
  mode: "parts" | "whole";
  /** the JAWAD AI job making it (once sent) */
  job: string | null;
  /** where in the original video the made clip starts (ms): the green clip lines up from it */
  from: number | null;
  state: "draft" | "sending" | "making" | "done" | "failed";
  /** why it failed (shown on the piece) */
  error?: string | null;
}

export const FIX_NOTE_MAX = 300;
/** The two tracks of «التعديل الذكي»: red = pieces to fix, green = what was made in their place. */
export const FIX_TRACK = { fix: { name: "للتعديل", color: "#ef4444" }, fixed: { name: "المعدّل", color: "#22c55e" } } as const;
export type TrackRole = keyof typeof FIX_TRACK;

export function readFix(v: unknown): Fix | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  return {
    note: typeof o.note === "string" ? o.note.slice(0, FIX_NOTE_MAX) : "",
    mode: o.mode === "whole" ? "whole" : "parts",
    job: typeof o.job === "string" && /^[0-9a-f-]{36}$/i.test(o.job) ? o.job : null,
    from: typeof o.from === "number" && Number.isFinite(o.from) && o.from >= 0 ? Math.round(Math.min(o.from, LIMITS.maxMs)) : null,
    state: (["draft", "sending", "making", "done", "failed"] as const).find((x) => x === o.state) ?? "draft",
    error: typeof o.error === "string" && o.error ? o.error.slice(0, 300) : null,
  };
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
  /** the colour the person gave the track (its clips wear it); none = the usual colour of its kind */
  color?: string | null;
  /** «التعديل الذكي»: the red track of pieces to fix, or the green one of what was made */
  role?: TrackRole | null;
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
  /**
   * The project's timelines («تسلسلات»), in their order. The one being edited has `tl: null` (it is this object);
   * absent or empty = a project with one timeline.
   */
  seqs?: Sequence[];
}

/** One of a project's timelines; `tl` is null for the one open now (its content is the Timeline itself). */
export interface Sequence {
  id: string;
  name: string;
  tl: Timeline | null;
}
export const MAX_SEQS = 20;
/** the id a one-timeline project's timeline goes by */
export const FIRST_SEQ = "s1";

/** Every track of every timeline of the project (for «is this file used anywhere»). */
export const allTracks = (tl: Timeline): Track[] => [...tl.tracks, ...(tl.seqs ?? []).flatMap((s) => s.tl?.tracks ?? [])];

/** How long a timeline runs: its last clip's end. */
const runOf = (t: Timeline) => t.tracks.reduce((m, tr) => tr.clips.reduce((n, c) => Math.max(n, c.start + (c.out - c.in) / (c.speed || 1)), m), 0);

/** A timeline's content by id (the open one is `tl` itself, its list taken off). */
function contents(tl: Timeline) {
  const map = new Map<string, Timeline>();
  for (const x of tl.seqs ?? []) map.set(x.id, x.tl ?? { ...tl, seqs: undefined });
  return map;
}

/** How long one of the project's timelines runs (0 when it isn't there). */
export function seqLength(tl: Timeline, id: string) {
  const c = contents(tl).get(id);
  return c ? runOf(c) : 0;
}

/**
 * The timeline as it plays: every nested timeline («Nest») opened into the clips it holds, at their place in time,
 * cut to the nest's in/out; its pictures stacked right above the nest's track, its sound added. The nest's volume
 * multiplies theirs and its grading goes over each of their pictures. Up to 3 levels deep; a loop is ignored. The
 * player and the export use this, so a nest plays and exports like any clips.
 */
export function flatten(tl: Timeline): Timeline {
  if (!tl.tracks.some((t) => t.clips.some((c) => c.seq))) return tl;
  const map = contents(tl);
  const open = (t: Timeline, depth: number, stack: string[]): Timeline => {
    const pictures: Track[] = [];
    const sounds: Track[] = [];
    for (const tr of t.tracks) {
      (tr.kind === "audio" ? sounds : pictures).push({ ...tr, clips: tr.clips.filter((c) => !c.seq) });
      for (const n of tr.clips) {
        if (!n.seq || depth >= 3 || stack.includes(n.seq)) continue;
        const inner0 = map.get(n.seq);
        if (!inner0) continue;
        const inner = open(inner0, depth + 1, [...stack, n.seq]);
        const shift = n.start - n.in;
        for (const it of inner.tracks) {
          const clips: Clip[] = [];
          for (const c of it.clips) {
            const sp = c.speed || 1;
            const s0 = c.start;
            const e0 = c.start + (c.out - c.in) / sp;
            const a = Math.max(s0, n.in);
            const b = Math.min(e0, n.out);
            if (b - a < 1) continue;
            clips.push({
              ...c,
              id: `${n.id}~${c.id}`,
              start: Math.round(a + shift),
              in: Math.round(c.in + (a - s0) * sp),
              out: Math.round(c.in + (b - s0) * sp),
              volume: Math.min(2, c.volume * n.volume),
              grades: [...c.grades, ...n.grades],
              fadeIn: a > s0 ? 0 : c.fadeIn,
              fadeOut: b < e0 ? 0 : c.fadeOut,
              transition: b < e0 ? null : c.transition,
            });
          }
          if (!clips.length) continue;
          const made: Track = { ...it, id: `${tr.id}~${n.id}~${it.id}`, role: null, muted: it.muted || tr.muted, hidden: it.hidden || tr.hidden, clips };
          (it.kind === "audio" ? sounds : pictures).push(made);
        }
      }
    }
    return { ...t, tracks: [...pictures, ...sounds] };
  };
  const out = open({ ...tl, seqs: undefined }, 0, [tl.seqs?.find((x) => !x.tl)?.id ?? FIRST_SEQ]);
  return { ...out, seqs: tl.seqs };
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
export const LIMITS = { tracks: 40, clips: 3000, text: 500, minClipMs: 100, maxMs: 24 * 3600_000, keys: 200, markers: 5000, words: 120 } as const;

export const DEFAULT_TRANSFORM: Transform = { x: 0.5, y: 0.5, scale: 1, rotate: 0, opacity: 1 };
export const DEFAULT_TEXT: TextStyle = { body: "اكتب هنا", size: 0.06, color: "#ffffff", box: null, weight: 700, align: "center", font: "readex", highlight: null };
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

/** The 15 colours a track can wear (on the timeline only; nothing changes in the video). */
export const TRACK_COLORS = ["#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#d946ef", "#ec4899", "#78716c"];

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

/** Which caption word is being said `ms` into a text clip (−1: none). */
export function wordAt(c: Clip, ms: number) {
  const rel = ms - c.start;
  let i = -1;
  for (let k = 0; k < c.words.length && c.words[k].s <= rel; k++) i = k;
  if (i < 0) return -1;
  // between two words the last one said stays lit until the next begins (or a short moment after it ends)
  const next = c.words[i + 1];
  return rel < (next ? next.s : c.words[i].e + 400) ? i : -1;
}

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
    font: isFont(o.font) ? o.font : "readex",
    highlight: o.highlight == null ? null : color(o.highlight, "#facc15"),
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

/** Premiere's blend modes (the ones a browser canvas draws), by family. */
export const BLEND_MODES = {
  normal: "عادي",
  // darken
  darken: "تغميق",
  multiply: "ضرب (Multiply)",
  "color-burn": "حرق اللون",
  // lighten
  lighten: "تفتيح",
  screen: "شاشة (Screen)",
  "color-dodge": "مراوغة اللون",
  add: "إضافة (Linear Dodge)",
  // contrast
  overlay: "تراكب (Overlay)",
  "soft-light": "ضوء ناعم",
  "hard-light": "ضوء قوي",
  // inversion
  difference: "فرق",
  exclusion: "استبعاد",
  // component
  hue: "تدرّج اللون",
  saturation: "التشبع",
  color: "اللون",
  luminosity: "الإضاءة",
} as const;
export type BlendMode = keyof typeof BLEND_MODES;

/**
 * A key: «كروما» takes out a colour (green or blue screen, any colour picked): `tolerance` how far from it still goes,
 * `soft` the soft edge, `spill` the colour's glow taken off the edges, `choke` shrinks the matte. «لوما» takes out the
 * dark parts (or the bright ones, `invert`): below `low` gone, above `high` kept, `soft` between. `show` = the matte.
 */
export interface Keyer {
  kind: "chroma" | "luma";
  color: string;
  tolerance: number;
  soft: number;
  spill: number;
  choke: number;
  low: number;
  high: number;
  invert: boolean;
  show: boolean;
}
export const NEW_KEY: Keyer = { kind: "chroma", color: "#00ff00", tolerance: 0.3, soft: 0.15, spill: 0.6, choke: 0, low: 0.1, high: 0.35, invert: false, show: false };
export function readKey(v: unknown): Keyer | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  return {
    kind: o.kind === "luma" ? "luma" : "chroma",
    color: typeof o.color === "string" && /^#[0-9a-f]{6}$/i.test(o.color) ? o.color.toLowerCase() : NEW_KEY.color,
    tolerance: num(o.tolerance, 0, 1, NEW_KEY.tolerance),
    soft: num(o.soft, 0, 1, NEW_KEY.soft),
    spill: num(o.spill, 0, 1, NEW_KEY.spill),
    choke: num(o.choke, 0, 1, 0),
    low: num(o.low, 0, 1, NEW_KEY.low),
    high: num(o.high, 0, 1, NEW_KEY.high),
    invert: o.invert === true,
    show: o.show === true,
  };
}

export interface Crop {
  l: number;
  t: number;
  r: number;
  b: number;
}
export const NO_CROP: Crop = { l: 0, t: 0, r: 0, b: 0 };
function readCrop(v: unknown): Crop | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const c = { l: num(o.l, 0, 0.45, 0), t: num(o.t, 0, 0.45, 0), r: num(o.r, 0, 0.45, 0), b: num(o.b, 0, 0.45, 0) };
  return c.l || c.t || c.r || c.b ? c : null;
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

export interface ClipFx {
  id: string;
  amount: number;
}
export function readFx(v: unknown): ClipFx[] {
  if (!Array.isArray(v)) return [];
  const out: ClipFx[] = [];
  for (const x of v) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    if (typeof o.id !== "string" || !FX_BY_ID.has(o.id) || out.some((f) => f.id === o.id)) continue;
    out.push({ id: o.id, amount: num(o.amount, 0, 1, 0.8) });
    if (out.length >= FX_MAX) break;
  }
  return out;
}

export function readAnim(v: unknown, text: boolean): Anim | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const ok = (k: unknown): AnimKind | null => {
    if (typeof k !== "string" || !(k in ANIMS)) return null;
    const only = (ANIMS[k as AnimKind] as { only?: string }).only;
    return !only || only === (text ? "text" : "media") ? (k as AnimKind) : null;
  };
  const a: Anim = {
    in: ok(o.in),
    out: o.out === "kenburns" ? null : ok(o.out),
    inMs: int(o.inMs, ANIM_MS.min, ANIM_MS.max, a0(o.in)),
    outMs: int(o.outMs, ANIM_MS.min, ANIM_MS.max, a0(o.out)),
  };
  return a.in || a.out ? a : null;
}
const a0 = (k: unknown) => (typeof k === "string" && k in ANIMS ? ANIMS[k as AnimKind].ms || 400 : 400);

export function readSound(v: unknown): SoundFx | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const fx: SoundFx = {
    clean: num(o.clean, 0, 1, 0),
    enhance: o.enhance === true,
    effect: typeof o.effect === "string" && o.effect in SOUND_EFFECTS ? (o.effect as SoundEffect) : null,
    mix: num(o.mix, 0, 1, NO_SOUND_FX.mix),
    pitch: Math.round(num(o.pitch, -12, 12, 0)),
  };
  return hasSoundFx({ sound: fx }) ? fx : null;
}

function readClip(v: unknown, kind: TrackKind, assets: Set<string> | null): Clip | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const text = kind === "text" ? readText(o.text) : null;
  const seq = kind === "text" ? null : str(o.seq, 40, "") || null;
  const assetId = kind === "text" || seq ? null : str(o.assetId, 64) || null;
  if (kind === "text" ? !text : !seq && (!assetId || (assets && !assets.has(assetId)))) return null;
  const tr = (o.transform ?? {}) as Record<string, unknown>;
  const inMs = int(o.in, 0, LIMITS.maxMs, 0);
  const out = int(o.out, inMs + LIMITS.minClipMs, LIMITS.maxMs, inMs + STILL_MS);
  return {
    id: id(o.id, "c"),
    assetId,
    seq,
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
    grades: kind === "audio" ? [] : readGrades(o.grades, o.grade),
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
    crop: kind === "audio" || kind === "text" ? null : readCrop(o.crop),
    blend: kind === "audio" ? "normal" : pick(o.blend, Object.keys(BLEND_MODES) as BlendMode[], "normal"),
    key: kind === "audio" || kind === "text" ? null : readKey(o.key),
    words: kind !== "text" || !Array.isArray(o.words)
      ? []
      : o.words
          .slice(0, LIMITS.words)
          .filter((w): w is Record<string, unknown> => !!w && typeof w === "object")
          .map((w) => {
            const s0 = int(w.s, 0, LIMITS.maxMs, 0);
            return { s: s0, e: int(w.e, s0, LIMITS.maxMs, s0), w: str(w.w, 60, "") };
          })
          .filter((w) => w.w),
    own: kind === "text" && o.own === true,
    fix: kind === "video" ? readFix(o.fix) : null,
    sound: kind === "text" ? null : readSound(o.sound),
    anim: kind === "audio" ? null : readAnim(o.anim, kind === "text"),
    fx: kind === "video" ? readFx(o.fx) : [],
    bg:
      kind === "video" && o.bg && typeof o.bg === "object"
        ? {
            mode: pick((o.bg as Record<string, unknown>).mode, ["remove", "blur", "color"] as const, "blur"),
            color: color((o.bg as Record<string, unknown>).color, DEFAULT_BACKDROP.color),
            blur: int((o.bg as Record<string, unknown>).blur, 1, 100, DEFAULT_BACKDROP.blur),
          }
        : null,
  };
}

/**
 * A stored or received document made safe: unknown fields dropped, numbers clamped, clips on media that isn't in the
 * project (when `assets` is given) removed, overlaps resolved. Never throws.
 */
export function readTimeline(raw: unknown, assets: Set<string> | null = null, nested = 0): Timeline {
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
    tracks.push({ id: tid, kind, name: str(t.name, 40, ""), muted: t.muted === true, hidden: t.hidden === true, locked: t.locked === true, duck: kind === "audio" && t.duck === true, color: TRACK_COLORS.includes(String(t.color)) ? String(t.color) : null, role: kind === "video" && (t.role === "fix" || t.role === "fixed") ? t.role : null, clips: settle(list) });
  }
  if (!tracks.some((t) => t.kind === "video")) tracks.unshift({ id: "main", kind: "video", name: "الرئيسي", muted: false, hidden: false, locked: false, duck: false, clips: [] });
  const width = int(o.width, 144, 4096, 1080);
  const height = int(o.height, 144, 4096, 1920);
  const out: Timeline = { v: EDITOR_VERSION, width: width - (width % 2), height: height - (height % 2), fps: pick<number>(Number(o.fps), [24, 25, 30, 60], 30), background: color(o.background, "#000000"), magnetic: o.magnetic !== false, markers: readMarkers(o.markers), tracks };
  const main = mainTrack(out);
  if (main && out.magnetic) main.clips = pack(main.clips);
  // the other timelines (one level: theirs are dropped), exactly one of them the open one
  if (nested === 0 && Array.isArray(o.seqs) && o.seqs.length) {
    const seqs: Sequence[] = [];
    const ids = new Set<string>();
    let open = false;
    for (const raw of o.seqs.slice(0, MAX_SEQS)) {
      const q = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      let id = str(q.id, 40, "") || newId("s");
      while (ids.has(id)) id = newId("s");
      ids.add(id);
      const name = str(q.name, 40, "") || `تسلسل ${seqs.length + 1}`;
      if (q.tl == null && !open) {
        open = true;
        seqs.push({ id, name, tl: null });
      } else if (q.tl && typeof q.tl === "object") seqs.push({ id, name, tl: readTimeline(q.tl, assets, 1) });
    }
    if (!open) seqs.unshift({ id: newId("s"), name: "تسلسل 1", tl: null });
    if (seqs.length > 1) out.seqs = seqs;
  }
  // a nested timeline must be one of the project's, and not the timeline it sits in
  if (nested === 0) {
    const ids = new Set((out.seqs ?? []).map((x) => x.id));
    const keep = (t: Timeline, self: string | undefined) => {
      for (const tr of t.tracks) tr.clips = tr.clips.filter((c) => !c.seq || (ids.has(c.seq) && c.seq !== self));
    };
    keep(out, out.seqs?.find((x) => !x.tl)?.id ?? FIRST_SEQ);
    for (const x of out.seqs ?? []) if (x.tl) keep(x.tl, x.id);
  }
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
