// «العداد» — the numbers alone (no database, no server): shared by the stage in the browser and lib/film/progress.ts.

import type { FilmStage } from "@config/film";

/** How long each kind of work usually takes (ms): the bar moves against it and never quite reaches the end before it is done. */
export const TYPICAL_MS = {
  reply: 95_000,
  image: 80_000,
  voice: 20_000,
  video: 300_000,
  impact: 40_000,
} as const;
export type WorkKind = keyof typeof TYPICAL_MS;

export interface Running {
  key: string;
  kind: WorkKind;
  /** who is working: السيناريست، صانع الشيت، المخرج، سجاد… or what is made: صورة CH-01، فيديو GEN-02 */
  label: string;
  startedAt: string;
  /** 1–99 while it runs */
  percent: number;
  /** seconds left, by the typical time (0 when it is past it) */
  etaSec: number;
}

export interface Progress {
  /** 0–100: the scene as a whole */
  percent: number;
  /** the steps waiting for the person right now (something to approve or answer) */
  asking: string[];
  stage: FilmStage;
  /** each step's own share: done of needed */
  steps: Record<string, { done: number; of: number; percent: number }>;
  running: Running[];
  at: string;
}

/** A running piece of work as a moving number: elapsed over the typical time, 1–99. */
export function runningPercent(startedAt: string, kind: WorkKind, now = Date.now()) {
  const elapsed = Math.max(0, now - new Date(startedAt).getTime());
  const typical = TYPICAL_MS[kind];
  // fast at first, slower near the end (it is an estimate: the real finish arrives on its own)
  const raw = 1 - Math.exp(-(elapsed / typical) * 2.2);
  return { percent: Math.max(1, Math.min(99, Math.round(raw * 100))), etaSec: Math.max(0, Math.round((typical - elapsed) / 1000)) };
}

/** The whole scene's percent from each step's share (weights: what each step is worth of the journey). */
export function overallPercent(steps: Progress["steps"]) {
  const W: Record<string, number> = { story: 5, script: 15, sheets: 25, director: 15, videos: 30, voices: 5, edit: 5 };
  let total = 0;
  let got = 0;
  for (const [k, w] of Object.entries(W)) {
    total += w;
    got += (w * (steps[k]?.percent ?? 0)) / 100;
  }
  return Math.round((got / total) * 100);
}

