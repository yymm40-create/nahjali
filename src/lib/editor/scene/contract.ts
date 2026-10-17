// «مختبر الموشن» — what the lab accepts: the plan حيدرة writes (read and bounded), the scene program (checked before it
// ever reaches the scene page), and the cues and scores that come back. Pure.

import { FONT_BY_ID, FONT_LIST } from "@/lib/editor/fonts";
import { CUE_SFX, PASS, RUBRIC, type RubricId } from "./skill";

export const CODE_MAX = 140_000;
export const SECONDS = { min: 3, max: 60 } as const;

/** Things a scene program must never contain (the page blocks them anyway; this tells حيدرة before it runs). */
const FORBIDDEN: [RegExp, string][] = [
  [/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon/, "network access"],
  [/\bimport\s*\(|\brequire\s*\(|\bimportScripts\b/, "loading code (use K.THREE / K.addon)"],
  [/\beval\s*\(|new\s+Function\b|\bFunction\s*\(/, "evaluating strings"],
  [/\bdocument\.(cookie|domain|write|body|querySelector|getElement)|\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b/, "the page or its storage"],
  [/\b(parent|top|opener)\s*\.|\bpostMessage\s*\(/, "other windows"],
  [/\bWorker\s*\(|SharedArrayBuffer|\bnavigator\./, "workers or the device"],
  [/Math\.random\s*\(|Date\.now|new\s+Date\s*\(|performance\.now|setTimeout|setInterval|requestAnimationFrame/, "clocks or unseeded randomness (a frame depends only on t: use K.rng / K.hash)"],
];

export function checkScene(code: unknown): { ok: boolean; problems: string[]; code: string } {
  const s = typeof code === "string" ? code.replace(/^```[a-z]*\n?|```\s*$/g, "").trim() : "";
  const problems: string[] = [];
  if (!s) problems.push("the program is empty");
  if (s.length > CODE_MAX) problems.push(`the program is longer than ${CODE_MAX} characters`);
  if (!/\bscene\s*\(\s*\{/.test(s)) problems.push("the program never calls scene({ … })");
  if (!/\bdraw\s*[:(]/.test(s)) problems.push("the scene has no draw(K, t, ctx)");
  for (const [re, why] of FORBIDDEN) if (re.test(s)) problems.push(`it uses ${why}`);
  if (/<\/?script/i.test(s)) problems.push("it contains a script tag");
  return { ok: !problems.length, problems, code: s };
}

export interface Cue {
  t: number;
  sfx: string;
  vol: number;
}
/** The cues the scene declared, made safe: known sounds only, inside the piece, at most one per 0.12 s, ≤ 40. */
export function readCues(raw: unknown, duration: number): Cue[] {
  const out: Cue[] = [];
  for (const c of Array.isArray(raw) ? raw : []) {
    const o = (c ?? {}) as Record<string, unknown>;
    const t = Number(o.t), sfx = String(o.sfx ?? "");
    if (!Number.isFinite(t) || t < 0 || t > duration || !CUE_SFX.includes(sfx)) continue;
    const vol = Number.isFinite(Number(o.vol)) ? Math.min(1, Math.max(0.05, Number(o.vol))) : 0.8;
    out.push({ t: Math.round(t * 1000) / 1000, sfx, vol });
  }
  out.sort((a, b) => a.t - b.t);
  return out.filter((c, i) => i === 0 || c.t - out[i - 1].t >= 0.12).slice(0, 40);
}

const hex = (v: unknown, d: string) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim().toLowerCase() : d);
const str = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const num = (v: unknown, lo: number, hi: number, d: number) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Number(v))) : d);

export interface Shot {
  from: number;
  to: number;
  what: string;
  motion: string;
  camera: string;
  text: string;
  transition: string;
  sound: string;
}
export interface LabPlan {
  title: string;
  idea: string;
  hook: string;
  format: string;
  wow: string;
  intensity: number;
  seconds: number;
  bpm: number;
  palette: { bg: string; ink: string; accent: string; second: string; muted: string };
  fonts: { head: string; body: string };
  shots: Shot[];
  assets: { id: string; use: string }[];
  music: string;
  /** the files of the owner's Higgsfield skills حيدرة asked to have open while writing and reviewing (catalogue ids) */
  skillRefs: string[];
}

/** The fonts the lab can load (the catalogue's Arabic families; display first). */
export const LAB_FONTS = FONT_LIST.filter((f) => ["sans", "display", "kufi", "naskh"].includes(f.kind)).map((f) => f.id);
const font = (v: unknown, d: string) => (typeof v === "string" && FONT_BY_ID.has(v) ? v : d);

/** حيدرة's plan made safe (every field bounded; unknown fonts fall back to good ones). */
export function readPlan(raw: unknown, seconds: number, assetIds: string[] = []): LabPlan {
  const o = (raw ?? {}) as Record<string, unknown>;
  const pal = (o.palette ?? {}) as Record<string, unknown>;
  const fo = (o.fonts ?? {}) as Record<string, unknown>;
  const secs = num(o.seconds, SECONDS.min, SECONDS.max, seconds);
  const shots = (Array.isArray(o.shots) ? o.shots : []).slice(0, 40).map((x) => {
    const s = (x ?? {}) as Record<string, unknown>;
    return { from: num(s.from, 0, secs, 0), to: num(s.to, 0, secs, secs), what: str(s.what, 400), motion: str(s.motion, 300), camera: str(s.camera, 200), text: str(s.text, 160), transition: str(s.transition, 200), sound: str(s.sound, 160) };
  }).filter((s) => s.to > s.from);
  return {
    title: str(o.title, 80) || "موشن",
    idea: str(o.idea, 400),
    hook: str(o.hook, 300),
    format: str(o.format, 80),
    wow: str(o.wow, 300),
    intensity: Math.round(num(o.intensity, 1, 5, 4)),
    seconds: secs,
    bpm: Math.round(num(o.bpm, 60, 180, 120)),
    palette: { bg: hex(pal.bg, "#0b0b10"), ink: hex(pal.ink, "#f2f0eb"), accent: hex(pal.accent, "#d78d45"), second: hex(pal.second, "#493cca"), muted: hex(pal.muted, "#726d68") },
    fonts: { head: font(fo.head, "alexandria"), body: font(fo.body, "ibm-plex-sans-arabic") },
    shots,
    assets: (Array.isArray(o.assets) ? o.assets : []).map((a) => ({ id: str((a as Record<string, unknown>)?.id, 80), use: str((a as Record<string, unknown>)?.use, 200) })).filter((a) => assetIds.includes(a.id)).slice(0, 12),
    music: str(o.music, 400),
    skillRefs: (Array.isArray(o.skillRefs) ? o.skillRefs : []).map((v) => String(v ?? "").trim()).filter((v) => /^higgsfield-motion(-saas)?\/[\w./#-]+$/.test(v)).slice(0, 12),
  };
}

export interface Review {
  scores: Record<RubricId, number>;
  worst: { t: number; problem: string; fix: string }[];
  verdict: string;
  pass: boolean;
  low: number;
}
/** The director's scores, bounded; it passes only when every criterion is ≥ PASS. */
export function readReview(raw: unknown): Review {
  const o = (raw ?? {}) as Record<string, unknown>;
  const sc = (o.scores ?? {}) as Record<string, unknown>;
  const scores = Object.fromEntries(RUBRIC.map((r) => [r.id, Math.round(num(sc[r.id], 1, 10, 1))])) as Record<RubricId, number>;
  const low = Math.min(...Object.values(scores));
  const worst = (Array.isArray(o.worst) ? o.worst : []).slice(0, 5).map((w) => {
    const x = (w ?? {}) as Record<string, unknown>;
    return { t: num(x.t, 0, SECONDS.max, 0), problem: str(x.problem, 300), fix: str(x.fix, 300) };
  });
  return { scores, worst, verdict: str(o.verdict, 600), pass: low >= PASS, low };
}
