// «الرضا فويس» — what a project IS: tracks, the clips on them, each track's chain of effects, the two shared effect
// buses, the master. Pure data (it is what gets saved, undone and redone); the sound itself lives beside it as
// «assets» — recordings that are never changed, only replaced by a processed copy.

export const SR = 48000;

export type FxKind = "eq" | "comp" | "gate" | "deess" | "dist" | "chorus" | "phaser" | "tremolo" | "delay" | "reverb" | "width" | "limiter";

export interface EqBand {
  type: "highpass" | "lowshelf" | "peaking" | "highshelf" | "lowpass";
  freq: number;
  gain: number;
  q: number;
  on: boolean;
}

export interface Fx {
  id: string;
  kind: FxKind;
  on: boolean;
  /** the effect's knobs, by key (see FX_SPECS) */
  p: Record<string, number>;
  /** the equalizer's bands */
  bands?: EqBand[];
}

export interface Space3D {
  on: boolean;
  /** degrees around the listener: 0 in front, 90 to the right, 180 behind, −90 to the left */
  az: number;
  /** degrees above (+) or below (−) the ears */
  el: number;
  /** metres from the listener */
  dist: number;
}

export interface Track {
  id: string;
  name: string;
  color: string;
  /** fader, dB */
  gain: number;
  /** −1 left … +1 right (when the 3D placement is off) */
  pan: number;
  mute: boolean;
  solo: boolean;
  /** armed: the next recording lands here */
  arm: boolean;
  space: Space3D;
  /** how much of the track goes to the shared reverb and the shared echo, 0–1 */
  sendReverb: number;
  sendDelay: number;
  fx: Fx[];
  /**
   * the track's channels, as on any desk: a MONO track sums whatever is on it to one channel before its effects (a
   * voice, placed by its pan); a STEREO track keeps left and right (music, a stereo recording). Absent = stereo.
   */
  stereo?: boolean;
  /** a group track: it holds no clips; the tracks under it play THROUGH it, so its effects and fader shape them all together */
  kind?: "group";
  /** the group this track plays through (a group's id); none = straight to the master */
  group?: string;
}

export interface Clip {
  id: string;
  trackId: string;
  assetId: string;
  name: string;
  /** where it starts on the timeline, seconds */
  start: number;
  /** where in its recording it starts, seconds */
  offset: number;
  dur: number;
  /** dB */
  gain: number;
  fadeIn: number;
  fadeOut: number;
  muted: boolean;
  /** takes of the same passage share this: one of them plays, the others wait */
  take?: string;
}

export interface Marker {
  id: string;
  time: number;
  name: string;
}

export interface Project {
  v: 1;
  id: string;
  name: string;
  bpm: number;
  /** beats in a bar */
  beats: number;
  tracks: Track[];
  clips: Clip[];
  markers: Marker[];
  loop: { on: boolean; start: number; end: number };
  /** the shared reverb and echo every track can send to */
  reverb: Record<string, number>;
  delay: Record<string, number>;
  master: { gain: number; fx: Fx[] };
  snap: boolean;
  metronome: boolean;
  countIn: boolean;
  /** the project's key once found or chosen: the tonic in semitones from C (a half = a quarter tone) and the scale's id */
  key?: { tonic: number; scale: string };
  /** the quick arrangement's editable recipe: the rhythm and the floor, each with the clip it was rendered into */
  arr?: {
    rhythm?: { spec: import("./dsp/rhythm").RhythmSpec; bars: number; clipId: string };
    pad?: { spec: import("./dsp/rhythm").PadSpec; clipId: string };
  };
  createdAt: number;
  updatedAt: number;
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/** The lanes' colours: turquoise tile and dome gold first, the rest chosen to sit apart on a dark desk. */
export const TRACK_COLORS = ["#2fd6c3", "#e9b949", "#8f8cff", "#ff8a6b", "#5db8ff", "#b6e35a", "#f27fc4", "#c9a37a"];

export interface ParamSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  def: number;
  unit?: string;
  /** the slider moves in octaves (frequencies, times) */
  log?: boolean;
  /** a choice among named values instead of a slider */
  options?: string[];
}

export const FX_SPECS: Record<FxKind, { name: string; icon: string; hint: string; params: ParamSpec[] }> = {
  eq: { name: "إكولايزر", icon: "〰️", hint: "يشكّل نبرة الصوت: يقص ويرفع ترددات بعينها", params: [] },
  comp: {
    name: "كمبريسور", icon: "🗜️", hint: "يقرّب العالي من الواطي فيثبت الصوت قدّام",
    params: [
      { key: "threshold", label: "العتبة", min: -60, max: 0, step: 0.5, def: -22, unit: "dB" },
      { key: "ratio", label: "النسبة", min: 1, max: 20, step: 0.1, def: 3.5, unit: ":1" },
      { key: "attack", label: "الهجوم", min: 0.1, max: 200, step: 0.1, def: 8, unit: "ms", log: true },
      { key: "release", label: "التحرير", min: 10, max: 1000, step: 1, def: 140, unit: "ms", log: true },
      { key: "knee", label: "النعومة", min: 0, max: 40, step: 1, def: 12, unit: "dB" },
      { key: "makeup", label: "تعويض", min: 0, max: 24, step: 0.1, def: 4, unit: "dB" },
    ],
  },
  gate: {
    name: "بوابة ضجيج", icon: "🚪", hint: "تسكّت الفراغات بين الجمل",
    params: [
      { key: "threshold", label: "العتبة", min: -80, max: -10, step: 0.5, def: -48, unit: "dB" },
      { key: "range", label: "مقدار الخفض", min: -80, max: 0, step: 1, def: -30, unit: "dB" },
      { key: "hold", label: "الانتظار", min: 0, max: 500, step: 5, def: 120, unit: "ms" },
      { key: "release", label: "التحرير", min: 10, max: 1000, step: 5, def: 180, unit: "ms", log: true },
    ],
  },
  deess: {
    name: "دي-إسر", icon: "🐍", hint: "ينعّم السين والشين الحادة",
    params: [
      { key: "freq", label: "من تردد", min: 3000, max: 10000, step: 50, def: 6000, unit: "Hz", log: true },
      { key: "threshold", label: "العتبة", min: -60, max: 0, step: 0.5, def: -30, unit: "dB" },
      { key: "amount", label: "القوة", min: 0, max: 1, step: 0.01, def: 0.6 },
    ],
  },
  dist: {
    name: "دستورشن", icon: "🔥", hint: "من دفء الشريط إلى الخشونة الكاملة",
    params: [
      { key: "type", label: "النوع", min: 0, max: 4, step: 1, def: 0, options: ["شريط دافئ", "صمّام", "خشن", "فَز", "تكسير رقمي"] },
      { key: "drive", label: "الدفع", min: 0, max: 1, step: 0.01, def: 0.3 },
      { key: "tone", label: "اللمعة", min: 500, max: 16000, step: 50, def: 9000, unit: "Hz", log: true },
      { key: "mix", label: "المزج", min: 0, max: 1, step: 0.01, def: 1 },
      { key: "out", label: "الخرج", min: -24, max: 12, step: 0.1, def: 0, unit: "dB" },
    ],
  },
  chorus: {
    name: "كورس / فلانجر", icon: "🌊", hint: "يثخّن الصوت كأنه أكثر من واحد",
    params: [
      { key: "rate", label: "السرعة", min: 0.05, max: 8, step: 0.01, def: 0.8, unit: "Hz", log: true },
      { key: "depth", label: "العمق", min: 0, max: 1, step: 0.01, def: 0.4 },
      { key: "delay", label: "التأخير", min: 1, max: 40, step: 0.1, def: 18, unit: "ms" },
      { key: "feedback", label: "الارتداد", min: 0, max: 0.9, step: 0.01, def: 0 },
      { key: "mix", label: "المزج", min: 0, max: 1, step: 0.01, def: 0.4 },
    ],
  },
  phaser: {
    name: "فيزر", icon: "🌀", hint: "دوران متموج في النبرة",
    params: [
      { key: "rate", label: "السرعة", min: 0.05, max: 6, step: 0.01, def: 0.5, unit: "Hz", log: true },
      { key: "depth", label: "العمق", min: 0, max: 1, step: 0.01, def: 0.6 },
      { key: "feedback", label: "الارتداد", min: 0, max: 0.9, step: 0.01, def: 0.3 },
      { key: "mix", label: "المزج", min: 0, max: 1, step: 0.01, def: 0.5 },
    ],
  },
  tremolo: {
    name: "تريمولو", icon: "〽️", hint: "رعشة منتظمة في مستوى الصوت",
    params: [
      { key: "rate", label: "السرعة", min: 0.5, max: 16, step: 0.1, def: 5, unit: "Hz" },
      { key: "depth", label: "العمق", min: 0, max: 1, step: 0.01, def: 0.5 },
    ],
  },
  delay: {
    name: "صدى (إيكو)", icon: "🔁", hint: "ترديد الصوت بعد زمن",
    params: [
      { key: "time", label: "الزمن", min: 20, max: 1500, step: 1, def: 320, unit: "ms", log: true },
      { key: "feedback", label: "التكرار", min: 0, max: 0.92, step: 0.01, def: 0.35 },
      { key: "damp", label: "تعتيم الترديد", min: 500, max: 16000, step: 50, def: 5000, unit: "Hz", log: true },
      { key: "ping", label: "يتنقل يمين ويسار", min: 0, max: 1, step: 1, def: 0, options: ["لا", "نعم"] },
      { key: "mix", label: "المزج", min: 0, max: 1, step: 0.01, def: 0.25 },
    ],
  },
  reverb: {
    name: "ريفيرب (صدى المكان)", icon: "🕌", hint: "يحط الصوت في غرفة أو قاعة أو حسينية",
    params: [
      { key: "decay", label: "طول الذيل", min: 0.2, max: 9, step: 0.05, def: 2.2, unit: "s", log: true },
      { key: "predelay", label: "قبل الصدى", min: 0, max: 150, step: 1, def: 20, unit: "ms" },
      { key: "damp", label: "دفء الذيل", min: 800, max: 16000, step: 50, def: 6500, unit: "Hz", log: true },
      { key: "lowcut", label: "قص الواطي", min: 20, max: 800, step: 5, def: 180, unit: "Hz", log: true },
      { key: "mix", label: "المزج", min: 0, max: 1, step: 0.01, def: 0.22 },
    ],
  },
  width: {
    name: "توسيع ستيريو", icon: "↔️", hint: "يفرش الصوت يمين ويسار (نسخة متأخرة شعرة)",
    params: [
      { key: "amount", label: "الاتساع", min: 0, max: 1, step: 0.01, def: 0.5 },
      { key: "time", label: "الفرق", min: 5, max: 35, step: 0.5, def: 14, unit: "ms" },
    ],
  },
  limiter: {
    name: "ليمتر", icon: "🧱", hint: "سقف ما يتعداه الصوت",
    params: [
      { key: "threshold", label: "العتبة", min: -24, max: 0, step: 0.1, def: -6, unit: "dB" },
      { key: "ceiling", label: "السقف", min: -6, max: 0, step: 0.1, def: -1, unit: "dB" },
      { key: "release", label: "التحرير", min: 10, max: 500, step: 1, def: 80, unit: "ms", log: true },
    ],
  },
};

export const FX_ORDER: FxKind[] = ["eq", "comp", "gate", "deess", "dist", "chorus", "phaser", "tremolo", "delay", "reverb", "width", "limiter"];

/** A fresh equalizer: a low cut (off), a low shelf, four bells, a high shelf, a high cut (off). */
export const defaultBands = (): EqBand[] => [
  { type: "highpass", freq: 80, gain: 0, q: 0.7, on: false },
  { type: "lowshelf", freq: 120, gain: 0, q: 0.7, on: true },
  { type: "peaking", freq: 300, gain: 0, q: 1.2, on: true },
  { type: "peaking", freq: 1000, gain: 0, q: 1.2, on: true },
  { type: "peaking", freq: 3200, gain: 0, q: 1.2, on: true },
  { type: "peaking", freq: 6500, gain: 0, q: 1.4, on: true },
  { type: "highshelf", freq: 10000, gain: 0, q: 0.7, on: true },
  { type: "lowpass", freq: 18000, gain: 0, q: 0.7, on: false },
];

export function makeFx(kind: FxKind, p: Record<string, number> = {}, bands?: Partial<EqBand>[]): Fx {
  const base: Record<string, number> = {};
  for (const s of FX_SPECS[kind].params) base[s.key] = s.def;
  const fx: Fx = { id: uid(), kind, on: true, p: { ...base, ...p } };
  if (kind === "eq") {
    const d = defaultBands();
    fx.bands = d.map((b, i) => ({ ...b, ...(bands?.[i] ?? {}) }));
  }
  return fx;
}

export const DEFAULT_REVERB = { decay: 2.4, predelay: 25, damp: 6000, lowcut: 200, level: 0.8 };
export const DEFAULT_DELAY = { time: 340, feedback: 0.32, damp: 4500, ping: 1, level: 0.7 };

export function makeTrack(name: string, index: number, over: Partial<Track> = {}): Track {
  return {
    id: uid(), name, color: TRACK_COLORS[index % TRACK_COLORS.length], gain: 0, pan: 0, mute: false, solo: false, arm: false,
    space: { on: false, az: 0, el: 0, dist: 1.5 }, sendReverb: 0, sendDelay: 0, fx: [], ...over,
  };
}

export function makeProject(name: string): Project {
  const now = Date.now();
  return {
    v: 1, id: uid(), name, bpm: 90, beats: 4, tracks: [makeTrack("صوت 1", 0, { arm: true, stereo: false })], clips: [], markers: [],
    loop: { on: false, start: 0, end: 8 }, reverb: { ...DEFAULT_REVERB }, delay: { ...DEFAULT_DELAY },
    // a safety limiter on the master from the first minute: a loud take never clips the mix
    master: { gain: 0, fx: [makeFx("limiter", { threshold: -1, ceiling: -1, release: 80 })] },
    snap: true, metronome: false, countIn: true, createdAt: now, updatedAt: now,
  };
}

/** Where the project's sound ends, seconds. */
export const projectEnd = (p: Project) => p.clips.reduce((m, c) => Math.max(m, c.start + c.dur), 0);

/** Seconds per beat and per bar. */
export const beatSec = (p: Pick<Project, "bpm">) => 60 / p.bpm;
export const barSec = (p: Pick<Project, "bpm" | "beats">) => (60 / p.bpm) * p.beats;

/** A time pulled to the nearest grid line (a beat; a quarter beat when zoomed in) when snapping is on. */
export function snapTime(p: Project, t: number, pxPerSec: number): number {
  if (!p.snap) return Math.max(0, t);
  const beat = beatSec(p);
  const grid = pxPerSec * beat > 160 ? beat / 4 : pxPerSec * beat > 60 ? beat / 2 : pxPerSec * beat > 24 ? beat : beat * p.beats;
  return Math.max(0, Math.round(t / grid) * grid);
}

/**
 * Which tracks sound: a soloed track silences the rest. A soloed group lets its members through, and a soloed
 * member keeps its group open (it plays through it).
 */
export function audible(p: Project, t: Track): boolean {
  if (!p.tracks.some((x) => x.solo)) return !t.mute;
  if (t.solo) return true;
  if (t.kind === "group") return p.tracks.some((x) => x.group === t.id && x.solo);
  return !!t.group && !t.mute && !!p.tracks.find((x) => x.id === t.group)?.solo && !p.tracks.some((x) => x.group === t.group && x.solo);
}

/** The group a track plays through, if it has one that still exists. */
export const groupOf = (p: Project, t: Track) => (t.group ? p.tracks.find((x) => x.id === t.group && x.kind === "group") ?? null : null);

/** «1.3.2» bars.beats.sixteenths and «0:07.250» for the time display. */
export function barsLabel(p: Project, t: number): string {
  const beat = beatSec(p);
  const total = Math.max(0, t) / beat;
  const bar = Math.floor(total / p.beats);
  const b = Math.floor(total - bar * p.beats);
  const six = Math.floor((total - Math.floor(total)) * 4);
  return `${bar + 1}.${b + 1}.${six + 1}`;
}
export function clockLabel(t: number, ms = true): string {
  const s = Math.max(0, t);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return ms ? `${m}:${r.toFixed(3).padStart(6, "0")}` : `${m}:${Math.floor(r).toString().padStart(2, "0")}`;
}
