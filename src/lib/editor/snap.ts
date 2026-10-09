// Dragging clips on the timeline (pure, so it can be tested): where a clip lands when its wanted spot is taken, the
// nearest magnet point, and the «+2.4 ث» the person reads while dragging.

export interface Span {
  start: number;
  end: number;
}

/**
 * Where a clip of length `len` wanted at `want` can sit on a track holding `others`: there when free, else the nearest
 * free spot — right after the clip in the way, or right before it (never before 0). Nothing is pushed or covered, so
 * bringing a clip near another makes it stick to it.
 */
export function freeSlot(others: Span[], want: number, len: number): number {
  const s0 = Math.max(0, Math.round(want));
  const free = (s: number) => s >= 0 && others.every((o) => s + len <= o.start || s >= o.end);
  if (free(s0)) return s0;
  let best = Infinity;
  for (const o of others) for (const c of [o.end, o.start - len]) if (free(c) && Math.abs(c - s0) < Math.abs(best - s0)) best = c;
  return best === Infinity ? s0 : best;
}

/** The magnet point nearest to `ms` within `tol`, or null; `skip` points are ignored (the dragged clip's own edges). */
export function nearestPoint(points: number[], ms: number, tol: number, skip: number[] = []): number | null {
  let best: number | null = null;
  let gap = tol;
  for (const p of points) {
    if (skip.includes(p)) continue;
    const d = Math.abs(p - ms);
    if (d < gap) {
      gap = d;
      best = p;
    }
  }
  return best;
}

/** «+2.4 ث» / «−0.8 ث» / «٠ ث» for a move or trim of `ms` milliseconds (digits as written elsewhere in the editor). */
export function movedLabel(ms: number): string {
  const s = Math.abs(ms) / 1000;
  if (Math.round(s * 10) === 0) return "0 ث";
  const n = s < 10 ? s.toFixed(1) : s.toFixed(s < 100 ? 1 : 0);
  return `${ms < 0 ? "−" : "+"}${n} ث`;
}
