// «الرضا فويس» — a whole recording (music included) higher or lower without changing its length, and faster or
// slower without changing its note. Built on the site's own stretcher (WSOLA, the same one «حيدرة كت» uses).

import { stretch } from "@/components/jawad/editor/stretch";

/** Faster (speed > 1) or slower, the same notes. */
export function changeSpeed(channels: Float32Array[], speed: number, sr: number): Float32Array[] {
  if (speed === 1) return channels.map((c) => c.slice());
  const outLen = Math.max(1, Math.round(channels[0].length / speed));
  return stretch(channels, 0, speed, outLen, sr);
}

/** Up or down by `semis` semitones (fractions welcome: 0.5 is a quarter tone), the same length. */
export function shiftAll(channels: Float32Array[], semis: number, sr: number): Float32Array[] {
  if (!semis) return channels.map((c) => c.slice());
  const r = 2 ** (semis / 12);
  const len = channels[0].length;
  // stretched to r × the length at the same note, then read r × faster: the length returns and the note moves
  const longer = stretch(channels, 0, 1 / r, Math.round(len * r) + 2, sr);
  return longer.map((ch) => {
    const out = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const p = i * r;
      const k = Math.floor(p);
      const f = p - k;
      out[i] = (ch[k] ?? 0) * (1 - f) + (ch[k + 1] ?? 0) * f;
    }
    return out;
  });
}
