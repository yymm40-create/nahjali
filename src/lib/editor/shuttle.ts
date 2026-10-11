// «J K L» — the shuttle of every editing program (Premiere, Resolve, Final Cut, Avid): L plays forward, J plays
// backward, K stops; pressing L or J again while it already runs that way doubles the speed (×2, ×4, ×8), and
// pressing the other key turns around at normal speed. Pure: the player applies the rate it gets.

export const SHUTTLE_MAX = 8;

/**
 * The rate after a shuttle key: `rate` is the current one (its sign the direction), `playing` whether the preview
 * runs now, `dir` the key's direction (+1 = L, −1 = J).
 */
export function nextRate(rate: number, playing: boolean, dir: 1 | -1): number {
  if (!playing) return dir;
  const same = Math.sign(rate) === dir;
  if (!same) return dir;
  return Math.min(SHUTTLE_MAX, Math.max(1, Math.abs(rate)) * 2) * dir;
}

/** The speed badge shown while shuttling: «×2» / «◀ ×4» / nothing at normal forward speed. */
export function rateLabel(rate: number): string {
  if (rate === 1) return "";
  const n = Math.abs(rate);
  const num = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return rate < 0 ? `◀ ×${num}` : `×${num}`;
}
