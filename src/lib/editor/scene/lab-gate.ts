// «مختبر الموشن» — what the page measures on a built scene before حيدرا ماكس reviews it, with no call to Claude: the
// program has a sound() at all, a sound cue near each shot change, an ending held long enough to read, and no stretch
// where nothing moves (the owner's skills: «no dead air», «a held ending or a loop»). The stills and contact sheets he is
// shown cannot show motion or sound, so these go to the review as exact facts next to what he sees. The motion is the
// picture's change between samples drawn small in the page (MotionLab). Pure.

export interface GateInput {
  duration: number;
  /** the program writes sound(K, S) */
  sound: boolean;
  /** the cue times (s) */
  cues: number[];
  /** the plan's shot starts (s) */
  changes: number[];
  /** how much the picture changed since the sample before (0–1: the mean |Δ| of every channel), at these times, in order */
  motion: { t: number; d: number }[];
  /** the piece is built on the person's video (it moves by itself; its ending is theirs) */
  footage?: boolean;
}

/** Below this the picture did not change at all between two samples (a frozen frame). */
export const FROZEN = 0.0015;
/** Below this the picture is settled (a held card may still breathe a little). */
export const SETTLED = 0.006;
/** The shortest held ending that can be read. */
export const HOLD_MIN = 2;
/** The longest stretch with nothing moving that is not dead air. */
export const DEAD_MIN = 1.2;
/** How near a shot change its cue must be (s). */
const CUE_NEAR = 0.25;

const s2 = (t: number) => `${t.toFixed(2)} s`;

/** The stretches (from, to) where every sample is under `limit`, each as long as the samples cover. */
function stretches(m: GateInput["motion"], limit: number): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = [];
  let from = -1;
  m.forEach((x, i) => {
    const prev = i ? m[i - 1].t : x.t;
    if (x.d < limit) {
      if (from < 0) from = prev;
      if (i === m.length - 1) out.push({ from, to: x.t });
    } else if (from >= 0) {
      out.push({ from, to: prev });
      from = -1;
    }
  });
  return out;
}

/** The problems found (English, for the review), or none. */
export function labGate(g: GateInput): string[] {
  const out: string[] = [];
  const d = g.duration;
  if (!(d > 0)) return out;
  if (!g.sound) out.push("The program has no sound(K, S): the piece would come out without its own sound design.");
  // every shot change after the first has a cue on it (a sound in sound() at that time counts too: check it there)
  const changes = [...new Set(g.changes.map((c) => Math.round(c * 100) / 100))].filter((c) => c > 0.05 && c < d - 0.05).sort((a, b) => a - b);
  const bare = changes.filter((c) => !g.cues.some((t) => Math.abs(t - c) <= CUE_NEAR));
  if (bare.length) out.push(`No cue within ${CUE_NEAR} s of the shot change${bare.length > 1 ? "s" : ""} at ${bare.slice(0, 6).map(s2).join(", ")}${bare.length > 6 ? " …" : ""} (unless sound() plays its own effect there).`);
  const m = g.motion.filter((x) => Number.isFinite(x.t) && Number.isFinite(x.d));
  if (m.length < 4) return out;
  // the ending: how long the picture has been settled at the end
  const tail = stretches(m, SETTLED).find((s) => s.to >= m[m.length - 1].t - 1e-6);
  const held = tail ? d - tail.from : 0;
  if (!g.footage && held < HOLD_MIN) out.push(`The ending is held only ${held.toFixed(1)} s (the picture still changes at ${s2(Math.max(0, d - held))}): a held end card needs ≥ ${HOLD_MIN} s to read — unless the piece is a seamless loop.`);
  // dead air: nothing moves at all for a while (the held ending excepted)
  const dead = stretches(m, FROZEN).filter((s) => s.to - s.from >= DEAD_MIN && !(tail && s.from >= tail.from - 1e-6));
  if (dead.length) out.push(`Nothing moves at all from ${dead.slice(0, 4).map((s) => `${s2(s.from)} to ${s2(s.to)}`).join(", ")} (dead air: something should keep moving).`);
  return out;
}
