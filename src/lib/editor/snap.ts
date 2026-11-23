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

/**
 * The magnet for everything being dragged: `edges` are the starts and ends of every moving clip as they were before
 * the drag (the held clip's first), `dt` how far the drag has gone, `points` what they can stick to (the clips that
 * stay, the playhead, the beats). The edge that comes nearest to a point within `tol` wins — whichever clip it belongs
 * to, so a selection sticks by its far end as well as by the clip under the pointer. Returns the move that makes it
 * touch and the point, or null. An edge never sticks to the spot it started from.
 */
export function groupSnap(points: number[], edges: number[], dt: number, tol: number): { dt: number; at: number } | null {
  let best: { dt: number; at: number } | null = null;
  let gap = tol;
  for (const e of edges) {
    const p = nearestPoint(points, e + dt, gap, [e]);
    if (p == null) continue;
    gap = Math.abs(p - (e + dt));
    best = { dt: p - e, at: p };
  }
  return best;
}

/**
 * A selection dragged to another track: every clip moves by the same number of tracks among the `lanes` tracks of its
 * kind. `from` / `to`: the lane the held clip was on and the one under the pointer; `members`: the lanes of all the
 * moving clips of that kind. The shift is pulled back toward 0 until every one of them still has a lane to land on.
 */
export function trackShift(lanes: number, from: number, to: number, members: number[]): number {
  const lo = Math.min(from, ...members);
  const hi = Math.max(from, ...members);
  return Math.max(-lo, Math.min(lanes - 1 - hi, to - from));
}

/** «+2.4 ث» / «−0.8 ث» / «٠ ث» for a move or trim of `ms` milliseconds (digits as written elsewhere in the editor). */
export function movedLabel(ms: number): string {
  const s = Math.abs(ms) / 1000;
  if (Math.round(s * 10) === 0) return "0 ث";
  const n = s < 10 ? s.toFixed(1) : s.toFixed(s < 100 ? 1 : 0);
  return `${ms < 0 ? "−" : "+"}${n} ث`;
}
