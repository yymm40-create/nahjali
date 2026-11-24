// «حيدرة كت» — «تقطيع ذكي»: a stretch of the timeline cut between the cameras by itself. Two steps, both pure:
//   1) WHERE to cut: at the breaths of the sound (the quietest moment in each stretch a shot may last), so no cut
//      lands in the middle of a word; with no sound to listen to, at even steps;
//   2) WHICH camera: one that filmed the whole shot, never the one just shown, the least used first — so every
//      camera gets its turn and the same face does not come back at once.
// It listens to loudness and counts turns: no language model is asked, nothing is uploaded, and it costs nothing.

export interface CutCam {
  /** the camera's clip */
  id: string;
  start: number;
  end: number;
}

export interface Shot {
  cam: string;
  from: number;
  to: number;
}

/** how long a shot may last (ms), by pace */
export const PACES = {
  calm: { ar: "هادي", min: 4000, max: 8000 },
  medium: { ar: "متوسط", min: 2500, max: 5000 },
  fast: { ar: "سريع", min: 1200, max: 2800 },
} as const;
export type Pace = keyof typeof PACES;

/**
 * The cut moments from `from` to `to` (both included). `loud`: the sound's loudness every `stepMs` from `from`
 * (null: none to listen to). Each shot lasts between `min` and `max`: the cut goes to the quietest moment in that
 * window (the breath between two phrases); a last sliver shorter than `min` is joined to the shot before it.
 */
export function breathCuts(loud: ArrayLike<number> | null, stepMs: number, from: number, to: number, min: number, max: number): number[] {
  const cuts = [from];
  let at = from;
  while (to - at > max) {
    let next = at + (min + max) / 2;
    if (loud && loud.length) {
      const a = Math.max(0, Math.round((at + min - from) / stepMs));
      const b = Math.min(loud.length - 1, Math.round((at + max - from) / stepMs));
      let best = -1;
      let low = Infinity;
      let run = 0;
      for (let i = a; i <= b; i++) {
        // (over five steps, so one silent sample inside a word is not taken for a breath)
        let s = 0;
        let n = 0;
        for (let k = i - 2; k <= i + 2; k++) if (k >= 0 && k < loud.length) {
          s += loud[k];
          n++;
        }
        const v = n ? s / n : Infinity;
        if (v < low - 1e-9) {
          low = v;
          best = i;
          run = 0;
        } else if (best >= 0 && v <= low + 1e-9 && i === best + run + 1) run++;
      }
      // (the middle of the breath, not its first instant)
      if (best >= 0) next = from + (best + run / 2) * stepMs;
    }
    at = Math.round(Math.min(Math.max(next, at + min), at + max));
    cuts.push(at);
  }
  if (to - at < min && cuts.length > 1) cuts.pop();
  cuts.push(to);
  return cuts;
}

/**
 * The camera of every stretch between two cuts. A camera must have filmed the whole stretch; among those, not the
 * one just shown, the least used so far, then the one unseen for longest. A stretch nobody filmed whole goes to the
 * camera that filmed most of it from its start (and the rest is planned again from where that one ends); a moment
 * nobody filmed is left without a shot.
 */
export function planShots(cams: CutCam[], cuts: number[], minMs = 400): Shot[] {
  const shots: Shot[] = [];
  const used = new Map<string, number>();
  const last = new Map<string, number>();
  let prev: string | null = null;
  const queue = cuts.slice(0, -1).map((a, i) => [a, cuts[i + 1]] as [number, number]);
  while (queue.length) {
    const [a, b] = queue.shift()!;
    if (b - a < minMs) continue;
    const there = cams.filter((c) => c.start <= a + 1 && c.end > a + minMs);
    if (!there.length) {
      // nobody films this moment: on to where the next camera begins
      const next = Math.min(...cams.filter((c) => c.start > a && c.start < b).map((c) => c.start));
      if (Number.isFinite(next)) queue.unshift([next, b]);
      continue;
    }
    const whole = there.filter((c) => c.end >= b - 1);
    const pool = whole.length ? whole : there;
    const fresh = pool.filter((c) => c.id !== prev);
    const pick = (fresh.length ? fresh : pool).reduce((m, c) => {
      const d = (used.get(c.id) ?? 0) - (used.get(m.id) ?? 0) || (last.get(c.id) ?? -Infinity) - (last.get(m.id) ?? -Infinity) || (whole.length ? 0 : m.end - c.end);
      return d < 0 ? c : m;
    });
    const to = Math.min(b, pick.end);
    // the same camera again (it is the only one there): one longer shot, not a cut to itself
    const before = shots.at(-1);
    if (before && before.cam === pick.id && before.to === a) before.to = to;
    else shots.push({ cam: pick.id, from: a, to });
    used.set(pick.id, (used.get(pick.id) ?? 0) + 1);
    last.set(pick.id, to);
    prev = pick.id;
    if (to < b) queue.unshift([to, b]);
  }
  return shots;
}

/** «1:23», «1:23.5» or «83» (seconds) as milliseconds; null when it is not a time. */
export function parseTime(text: string): number | null {
  const m = /^\s*(?:(\d+):)?(?:(\d+):)?(\d+(?:[.,]\d+)?)\s*$/.exec(text.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))));
  if (!m) return null;
  const parts = [m[1], m[2], m[3]].filter((x) => x != null).map((x) => Number(String(x).replace(",", ".")));
  const s = parts.reduce((t, x) => t * 60 + x, 0);
  return Number.isFinite(s) ? Math.round(s * 1000) : null;
}
