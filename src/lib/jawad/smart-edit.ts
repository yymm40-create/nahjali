// «الجواد الذكي!» | JAWAD AI — «التعديل الذكي» of a finished result: shared by the page and the server.

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
