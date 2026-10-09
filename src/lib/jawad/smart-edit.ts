// «الجواد الذكي!» | JAWAD AI — «التعديل الذكي» of a finished result: shared by the page and the server.

import type { GeneratorDef, Settings } from "@config/jawad/types";

/** Video: the whole clip again, or only the part that failed (cut back in cleanly). Image: the same image edited, or a new one. */
export type EditMode = "whole" | "parts" | "same" | "full";
export const VIDEO_EDIT_MODES: EditMode[] = ["whole", "parts"];
export const IMAGE_EDIT_MODES: EditMode[] = ["same", "full"];

export interface EditRange {
  /** Seconds in the original video. */
  from: number;
  to: number;
  note: string;
}

export const EDIT_LIMITS = {
  notesMax: 4000,
  noteMax: 300,
  /** Time ranges the user can point at in a whole-clip edit. */
  rangesMax: 6,
  /** Frames of the original video Claude looks at. */
  framesMax: 16,
  /** Width of those frames (enough to see what went wrong). */
  frameWidth: 640,
  /** The corrected image prompt is kept under this (its price is charged at this cap). */
  imagePromptBytes: 4000,
} as const;

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * The part of the video that is made again for a clean cut: whole seconds (the generator's durations), at least its
 * shortest clip, inside the video. The new clip starts on the frame at `start` and ends on the frame at `end`.
 */
export function cutRange(from: number, to: number, videoSec: number, minSec: number, maxSec: number): { start: number; end: number; seconds: number } | null {
  if (!(videoSec >= minSec) || !(to > from) || from < 0) return null;
  const seconds = Math.min(maxSec, Math.max(minSec, Math.ceil(to - from - 1e-9)));
  if (seconds > videoSec + 1e-9) return null;
  // Centred on what was marked, then moved back inside the video
  const mid = (from + to) / 2;
  let start = Math.max(0, mid - seconds / 2);
  if (start + seconds > videoSec) start = Math.max(0, videoSec - seconds);
  start = round1(start);
  return { start, end: round1(Math.min(videoSec, start + seconds)), seconds };
}

/** When to take the frames Claude looks at: spread over the clip (or the cut part), plus the marked times. */
export function frameTimes(videoSec: number, ranges: EditRange[], cut?: { start: number; end: number } | null): number[] {
  const end = Math.max(0.1, videoSec - 0.05);
  const span = cut ? { a: Math.max(0, cut.start - 1), b: Math.min(end, cut.end + 1) } : { a: 0, b: end };
  const n = Math.min(cut ? 10 : 12, Math.max(4, Math.ceil(span.b - span.a)));
  const times = Array.from({ length: n }, (_, i) => span.a + ((i + 0.5) * (span.b - span.a)) / n);
  for (const r of ranges) times.push((r.from + r.to) / 2);
  const uniq = [...new Set(times.map((t) => round1(Math.min(end, Math.max(0, t)))))].sort((x, y) => x - y);
  return uniq.slice(0, EDIT_LIMITS.framesMax);
}

/** «التعديل الذكي» of a part: seconds of the video itself next to the cut, sent as video references for continuity. */
export interface ContinuityRange {
  at: "before" | "after";
  from: number;
  to: number;
}
/** Seedance: each reference video 2 s or more. */
export const CONTINUITY = { minSec: 2, sec: 3, max: 3, totalSec: 15 } as const;

/** The default: up to 3 s of the video right before the cut and right after it (each only when 2 s or more fit). */
export function continuityRanges(cut: { start: number; end: number }, videoSec: number): ContinuityRange[] {
  const out: ContinuityRange[] = [];
  const b = { at: "before" as const, from: round1(Math.max(0, cut.start - CONTINUITY.sec)), to: cut.start };
  if (b.to - b.from >= CONTINUITY.minSec - 1e-9) out.push(b);
  const a = { at: "after" as const, from: cut.end, to: round1(Math.min(videoSec, cut.end + CONTINUITY.sec)) };
  if (a.to - a.from >= CONTINUITY.minSec - 1e-9) out.push(a);
  return out;
}

/** Ranges sent by the page (the editor's yellow track), checked; null when none were sent. */
export function readContinuity(v: unknown, videoSec: number): ContinuityRange[] | null {
  if (!Array.isArray(v)) return null;
  const out = v.slice(0, CONTINUITY.max + 1).map((x) => {
    const r = (x ?? {}) as Record<string, unknown>;
    return { at: r.at === "after" ? ("after" as const) : ("before" as const), from: round1(Number(r.from)), to: round1(Number(r.to)) };
  });
  if (out.length > CONTINUITY.max) return null;
  for (const r of out) if (!(r.from >= 0 && r.to <= videoSec + 0.05 && r.to - r.from >= CONTINUITY.minSec - 0.05 && r.to - r.from <= CONTINUITY.totalSec)) return null;
  if (out.reduce((t, r) => t + r.to - r.from, 0) > CONTINUITY.totalSec + 0.05) return null;
  return out;
}

// ───────────────────────────── the edit's own options (the same ones the generation had) ─────────────────────────────

/**
 * The generation options a smart edit lets the person choose again — what the first generation had, so the price is
 * counted the same way from the start: a video's resolution, sound and (for the whole clip) its seconds; an image's
 * resolution and quality. Everything else (the ratio, the references) stays as the original made it.
 */
export const EDIT_OPTION_KEYS: Record<"video" | "image", string[]> = { video: ["resolution", "audio", "duration"], image: ["resolution", "quality"] };

/**
 * The options asked for, checked against the generator that will make the edit: only the keys above, only values that
 * generator really offers (a choice among its values, a whole number in its range, a true/false). The seconds count only
 * for the whole clip: a part's length is the cut's. Anything else is dropped, never guessed.
 */
export function readEditSettings(def: Pick<GeneratorDef, "output" | "options">, raw: unknown, mode: EditMode): Settings {
  const out: Settings = {};
  if (!raw || typeof raw !== "object" || (def.output !== "video" && def.output !== "image")) return out;
  const given = raw as Record<string, unknown>;
  for (const key of EDIT_OPTION_KEYS[def.output]) {
    if (key === "duration" && mode !== "whole") continue;
    const o = def.options.find((x) => x.key === key);
    const v = given[key];
    if (!o || v === undefined || v === null) continue;
    if (o.kind === "choice") {
      const s = String(v);
      if (o.values.some((x) => x.value === s)) out[key] = s;
    } else if (o.kind === "int") {
      const n = Number(v);
      if (Number.isInteger(n) && n >= o.min && n <= o.max) out[key] = n;
    } else if (typeof v === "boolean") out[key] = v;
  }
  return out;
}
