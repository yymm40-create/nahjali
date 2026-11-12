// «حيدرة كت» — «بدّل الكاميرات تلقائياً» (like DaVinci's Multicam SmartSwitch). Pure maths (browser and tests); the
// browser side (components/jawad/editor/multicam-run.ts) reads the sound and the faces.
//
// After «🎯 زامن الصوت» has lined up two or more cameras of the same moment, the picture follows who is speaking:
// 1) every camera's own sound is measured every 100 ms on the timeline (its file time found through the clip's speed
//    and speed curve: model.ts sourceTime) — the camera whose microphone is nearest the speaker hears them loudest above
//    its own quiet level, so it wins;
// 2) optionally the face: a camera that shows no face at that moment counts a little less;
// 3) the rules: several speaking at once, or nobody for a long while → the camera marked «واسعة» (when there is one);
//    then no shot shorter than the minimum (a short one joins the shot before it, or after it at the start), so the
//    picture never flickers; a camera is only used where it really filmed.
// The result is a list of shots (camera, from, to on the timeline) that the «multicam» command turns into clips.

import { clipEnd, sourceTime, timelineTime, type Clip, type Timeline } from "./model";
import type { Timed } from "./ramp";

export const MULTICAM = {
  /** one measurement every this many ms of the timeline */
  stepMs: 100,
  /** the shortest shot (the person can change it) */
  minShotMs: 2000,
  minShotRange: [800, 8000] as const,
  /** nobody speaking this long → the wide camera (when one is marked) */
  quietMs: 3000,
  /** a camera hears someone when its sound is this many dB above its own quiet level (the room between words) */
  speakDb: 9,
  /** two speakers this close (dB) → both are speaking (the wide camera) */
  bothDb: 3,
  /** a camera with no face in sight at that moment counts this much less */
  faceMissDb: 6,
  /** cameras at most */
  maxCams: 6,
} as const;

export interface CamInput {
  /** where the camera's clip is on the timeline */
  start: number;
  end: number;
  /** its sound in dB at every step (null: not heard there — no sound, or outside the clip) */
  levels: (number | null)[];
  /** a face in sight at every step (null: not looked at) */
  faces?: (boolean | null)[];
}

export interface Shot {
  /** index in the cameras */
  cam: number;
  from: number;
  to: number;
}

export interface SwitchOptions {
  stepMs?: number;
  minShotMs?: number;
  /** the camera marked «واسعة» (index), or none */
  wide?: number | null;
  quietMs?: number;
  speakDb?: number;
  bothDb?: number;
  faceMissDb?: number;
}

/**
 * The loudness (dB) of a camera's sound at `steps` moments of `stepMs` from timeline time `from`: for each step its
 * piece of the file, found through the clip's own time (speed and speed curve), as the root mean square of the samples.
 * Null where the clip doesn't cover the step or the sound has ended.
 */
export function levelsOf(mono: Float32Array, rate: number, clip: Timed, from: number, steps: number, stepMs = MULTICAM.stepMs): (number | null)[] {
  const out: (number | null)[] = new Array(steps).fill(null);
  const end = clip.start + (clip.out - clip.in) / (clip.speed || 1);
  for (let i = 0; i < steps; i++) {
    const t0 = from + i * stepMs;
    const t1 = t0 + stepMs;
    const mid = (t0 + t1) / 2;
    if (mid < clip.start || mid >= end) continue;
    const s0 = sourceTime(clip, Math.max(t0, clip.start));
    const s1 = sourceTime(clip, Math.min(t1, end));
    const a = Math.max(0, Math.floor((Math.min(s0, s1) / 1000) * rate));
    const b = Math.min(mono.length, Math.ceil((Math.max(s0, s1) / 1000) * rate));
    if (b - a < 2) continue;
    let sq = 0;
    for (let k = a; k < b; k++) sq += mono[k] * mono[k];
    out[i] = 20 * Math.log10(Math.sqrt(sq / (b - a)) + 1e-5);
  }
  return out;
}

/** The faces seen at moments of the file (source ms) as a yes/no per timeline step (the nearest look within ¾ s). */
export function facesOf(looks: { ms: number; face: boolean }[], clip: Timed, from: number, steps: number, stepMs = MULTICAM.stepMs): (boolean | null)[] {
  const at = looks.map((l) => ({ t: timelineTime(clip, l.ms), face: l.face })).sort((x, y) => x.t - y.t);
  const out: (boolean | null)[] = new Array(steps).fill(null);
  let j = 0;
  for (let i = 0; i < steps; i++) {
    const mid = from + (i + 0.5) * stepMs;
    while (j + 1 < at.length && Math.abs(at[j + 1].t - mid) <= Math.abs(at[j].t - mid)) j++;
    if (at[j] && Math.abs(at[j].t - mid) <= 750) out[i] = at[j].face;
  }
  return out;
}

const percentile = (v: number[], q: number) => {
  if (!v.length) return 0;
  const s = [...v].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))];
};

/** A short moving average (3 steps) of the levels, the gaps left as gaps. */
function smooth(levels: (number | null)[]) {
  return levels.map((v, i) => {
    if (v == null) return null;
    let s = 0;
    let n = 0;
    for (let k = i - 1; k <= i + 1; k++) {
      const x = levels[k];
      if (x != null) {
        s += x;
        n++;
      }
    }
    return s / n;
  });
}

interface Run {
  cam: number;
  /** steps [a, b) */
  a: number;
  b: number;
}

/**
 * The shots, from timeline time `from` to `to`, for these cameras (see the top of the file). Every shot lies where its
 * camera filmed; each is at least `minShotMs` long unless the cameras' own ends force a shorter one.
 */
export function chooseShots(cams: CamInput[], from: number, to: number, o: SwitchOptions = {}): Shot[] {
  const step = o.stepMs ?? MULTICAM.stepMs;
  const minShot = o.minShotMs ?? MULTICAM.minShotMs;
  const quiet = o.quietMs ?? MULTICAM.quietMs;
  const speakDb = o.speakDb ?? MULTICAM.speakDb;
  const bothDb = o.bothDb ?? MULTICAM.bothDb;
  const faceMiss = o.faceMissDb ?? MULTICAM.faceMissDb;
  const wide = o.wide != null && o.wide >= 0 && o.wide < cams.length ? o.wide : null;
  const n = Math.max(0, Math.ceil((to - from) / step));
  if (!n || !cams.length) return [];

  // a camera can be shown at a step only when its clip covers the whole step
  const avail = cams.map((c) => Array.from({ length: n }, (_, i) => c.start <= from + i * step + 0.5 && c.end >= Math.min(to, from + (i + 1) * step) - 0.5));
  // how far above its own quiet level (the room's noise between words, as that microphone hears it: a hotter
  // microphone is louder in both) each camera hears, minus a little where it shows no face
  const score = cams.map((c, k) => {
    const raw = c.levels.slice(0, n);
    const lv = smooth(raw);
    const floor = percentile(raw.filter((x): x is number => x != null), 0.05);
    return Array.from({ length: n }, (_, i) => {
      const v = lv[i];
      if (!avail[k][i] || v == null) return -Infinity;
      return v - floor - (c.faces?.[i] === false ? faceMiss : 0);
    });
  });

  // what each step wants: a camera, or nobody speaking (null)
  const want: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    const speaking = cams.map((_, k) => k).filter((k) => k !== wide && score[k][i] >= speakDb);
    if (!speaking.length) continue;
    speaking.sort((x, y) => score[y][i] - score[x][i]);
    const top = speaking[0];
    const second = speaking[1];
    want[i] = wide != null && avail[wide][i] && second != null && score[top][i] - score[second][i] <= bothDb ? wide : top;
  }
  // a long silence goes wide (after holding the last speaker half a second); shorter ones hold what was there
  const quietSteps = Math.ceil(quiet / step);
  const hold = Math.ceil(500 / step);
  for (let i = 0; i < n; ) {
    if (want[i] != null) {
      i++;
      continue;
    }
    let j = i;
    while (j < n && want[j] == null) j++;
    if (wide != null && j - i >= quietSteps) for (let k = i + (i === 0 ? 0 : hold); k < j; k++) if (avail[wide][k]) want[k] = wide;
    i = j;
  }
  // the gaps that are left: the camera before (or the first wanted one at the very start)
  const first = want.find((x) => x != null) ?? wide ?? 0;
  let last: number = first;
  const pick: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    let c: number = want[i] ?? last;
    if (!avail[c]?.[i]) {
      // that camera didn't film here: the wide one, the one before, the best heard, any
      const order = [wide, last, ...cams.map((_, k) => k).sort((x, y) => score[y][i] - score[x][i])];
      c = order.find((k): k is number => k != null && !!avail[k]?.[i]) ?? -1;
    }
    pick[i] = c;
    if (c >= 0) last = c;
  }

  // steps → runs
  let runs: Run[] = [];
  for (let i = 0; i < n; i++) {
    const r = runs[runs.length - 1];
    if (r && r.cam === pick[i]) r.b = i + 1;
    else runs.push({ cam: pick[i], a: i, b: i + 1 });
  }
  // no flicker: the shortest shot under the minimum joins a neighbour that filmed all of it (the one before first)
  const minSteps = Math.ceil(minShot / step);
  const covers = (cam: number, r: Run) => cam >= 0 && avail[cam].slice(r.a, r.b).every(Boolean);
  const stuck = new Set<Run>();
  for (;;) {
    let i = -1;
    for (let k = 0; k < runs.length; k++) {
      const r = runs[k];
      if (r.cam < 0 || stuck.has(r) || r.b - r.a >= minSteps) continue;
      if (i < 0 || r.b - r.a < runs[i].b - runs[i].a) i = k;
    }
    if (i < 0) break;
    const r = runs[i];
    const prev = runs[i - 1];
    const next = runs[i + 1];
    const into = prev && prev.cam >= 0 && covers(prev.cam, r) ? prev : next && next.cam >= 0 && covers(next.cam, r) ? next : null;
    if (!into) {
      stuck.add(r);
      continue;
    }
    if (into === prev) prev.b = r.b;
    else next.a = r.a;
    runs.splice(i, 1);
    // neighbours of one camera become one shot
    runs = runs.reduce<Run[]>((m, x) => {
      const p = m[m.length - 1];
      if (p && p.cam === x.cam && p.b === x.a) {
        p.b = x.b;
        if (stuck.has(x)) stuck.add(p);
      } else m.push(x);
      return m;
    }, []);
  }

  // steps → milliseconds, inside each camera's own clip, edge to edge where they can be
  const shots: Shot[] = runs
    .filter((r) => r.cam >= 0)
    .map((r) => ({ cam: r.cam, from: Math.round(Math.max(from + r.a * step, cams[r.cam].start)), to: Math.round(Math.min(to, from + r.b * step, cams[r.cam].end)) }))
    .filter((s) => s.to > s.from);
  for (let k = 0; k + 1 < shots.length; k++) {
    const a = shots[k];
    const b = shots[k + 1];
    const gap = b.from - a.to;
    if (gap <= 0 || gap > step) continue;
    if (cams[a.cam].end >= b.from) a.to = b.from;
    else if (cams[b.cam].start <= a.to) b.from = a.to;
  }
  return shots;
}

/** How much of the time each camera got (0–1 each), for the person to see the result in one line. */
export function shareOf(shots: Shot[], cams: number): number[] {
  const total = shots.reduce((m, s) => m + (s.to - s.from), 0) || 1;
  const out = new Array(cams).fill(0);
  for (const s of shots) out[s.cam] += (s.to - s.from) / total;
  return out;
}

/** A clip cut from one of the cameras («بدّل الزاوية» works on it). */
export const isAngleCut = (c: Pick<Clip, "angle">) => typeof c.angle === "string" && !!c.angle;

/**
 * The cameras that can show the moment a cut shows now: the original clips on the «angles» tracks that filmed all of
 * it, in their tracks' order (the current one included, `on`).
 */
export function angleOptions(tl: Timeline, cutId: string): { clipId: string; trackId: string; name: string; on: boolean }[] {
  let cut: Clip | null = null;
  for (const t of tl.tracks) cut = cut ?? t.clips.find((c) => c.id === cutId) ?? null;
  if (!cut?.angle) return [];
  const span = angleSpan(tl, cut);
  if (!span) return [];
  const out: { clipId: string; trackId: string; name: string; on: boolean }[] = [];
  for (const t of tl.tracks) {
    if (!t.angles) continue;
    for (const c of t.clips) if (c.start <= span[0] + 2 && clipEnd(c) >= span[1] - 2) out.push({ clipId: c.id, trackId: t.id, name: t.name, on: c.id === cut.angle });
  }
  return out;
}

/** The moment a cut shows, on its camera's clock (the synced originals' timeline span), or null when its camera is gone. */
export function angleSpan(tl: Timeline, cut: Clip): [number, number] | null {
  let orig: Clip | null = null;
  for (const t of tl.tracks) orig = orig ?? t.clips.find((c) => c.id === cut.angle) ?? null;
  if (!orig) return null;
  const a = timelineTime(orig, cut.in);
  const len = (cut.out - cut.in) / (cut.speed || 1);
  return [a, a + len];
}
