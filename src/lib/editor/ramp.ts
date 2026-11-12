// «منحنى السرعة» (speed ramping) — a clip whose speed changes inside it: slow then fast, a quick burst in the middle…
// The curve is speed points along the clip's place ON THE TIMELINE (u = 0 its start, 1 its end), straight lines between
// them. A clip with a curve keeps `speed` equal to the curve's average, so everything that only knows a constant speed
// (the clip's length, where it ends, the timeline's length) is still right; what plays at a given moment comes from the
// curve's area: source = the speed added up over the time so far. Pure (tests and the server use it).

/** One point of the curve: where along the clip (0–1 of its length on the timeline) and its speed there. */
export interface RampPoint {
  u: number;
  s: number;
}
export type Ramp = RampPoint[];

/** The speeds a curve may take (the model's own range), and the range the curve editor offers. */
export const RAMP_SPEED = { min: 0.1, max: 10, uiMin: 0.2, uiMax: 5 } as const;
export const RAMP_MAX_POINTS = 12;

export type RampPresetId = "slowFast" | "fastSlow" | "burst" | "slowMid" | "velocity" | "easeOut";

/** Ready curves (CapCut's «منحنى» list, in plain words). */
export const RAMP_PRESETS: Record<RampPresetId, { label: string; hint: string; points: Ramp }> = {
  slowFast: { label: "بطيء ثم سريع", hint: "يبدأ هادي ويتسارع للآخر", points: [{ u: 0, s: 0.5 }, { u: 1, s: 2.5 }] },
  fastSlow: { label: "سريع ثم بطيء", hint: "يدخل بسرعة ويهدى في النهاية", points: [{ u: 0, s: 2.5 }, { u: 1, s: 0.5 }] },
  burst: { label: "ضربة سريعة في النص", hint: "عادي، ثم اندفاعة سريعة، ثم عادي", points: [{ u: 0, s: 1 }, { u: 0.38, s: 1 }, { u: 0.5, s: 4 }, { u: 0.62, s: 1 }, { u: 1, s: 1 }] },
  slowMid: { label: "لقطة بطيئة في النص", hint: "عادي، ثم سلو موشن للحظة المهمة، ثم عادي", points: [{ u: 0, s: 1 }, { u: 0.3, s: 1 }, { u: 0.45, s: 0.3 }, { u: 0.6, s: 0.3 }, { u: 0.75, s: 1 }, { u: 1, s: 1 }] },
  velocity: { label: "فيلوسيتي (سريع، بطيء، سريع)", hint: "أسلوب إيدت الفيلوسيتي على الإيقاع", points: [{ u: 0, s: 3 }, { u: 0.3, s: 3 }, { u: 0.42, s: 0.4 }, { u: 0.58, s: 0.4 }, { u: 0.7, s: 3 }, { u: 1, s: 3 }] },
  easeOut: { label: "يوقف بالتدريج", hint: "يمشي عادي ويبطّأ حتى شبه وقفة", points: [{ u: 0, s: 1.5 }, { u: 0.6, s: 1 }, { u: 1, s: 0.2 }] },
};
export const RAMP_PRESET_IDS = Object.keys(RAMP_PRESETS) as RampPresetId[];
export const isRampPreset = (v: unknown): v is RampPresetId => typeof v === "string" && v in RAMP_PRESETS;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (v: number, k = 1000) => Math.round(v * k) / k;

/**
 * A curve read from anything (a saved project, a command, حيدرا ماكس): sorted, inside its ranges, starting at 0 and
 * ending at 1 (the nearest speed carried to an edge that is missing), at most RAMP_MAX_POINTS. A preset id is its curve.
 * null when there is no curve (fewer than 2 points, or bad data); a flat curve stays (the caller turns it into a speed).
 */
export function readRamp(v: unknown): Ramp | null {
  if (isRampPreset(v)) return RAMP_PRESETS[v].points.map((p) => ({ ...p }));
  if (!Array.isArray(v)) return null;
  const pts = v
    .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
    .map((p) => ({ u: Number(p.u), s: Number(p.s) }))
    .filter((p) => Number.isFinite(p.u) && Number.isFinite(p.s))
    .map((p) => ({ u: round(clamp(p.u, 0, 1)), s: round(clamp(p.s, RAMP_SPEED.min, RAMP_SPEED.max), 100) }))
    .sort((a, b) => a.u - b.u)
    // two points at the same place: the later one wins
    .filter((p, i, all) => i === all.length - 1 || all[i + 1].u - p.u > 0.0005);
  if (!pts.length) return null;
  if (pts[0].u > 0) pts.unshift({ u: 0, s: pts[0].s });
  if (pts[pts.length - 1].u < 1) pts.push({ u: 1, s: pts[pts.length - 1].s });
  if (pts.length > RAMP_MAX_POINTS) {
    // too many: keep the ends and the points spread evenly between them
    const keep = new Set([0, pts.length - 1]);
    for (let i = 1; keep.size < RAMP_MAX_POINTS; i++) keep.add(Math.round((i * (pts.length - 1)) / (RAMP_MAX_POINTS - 1)));
    return pts.filter((_, i) => keep.has(i));
  }
  return pts;
}

/** All points at the same speed: no curve really (that speed alone does it). */
export const isFlat = (r: Ramp) => r.every((p) => Math.abs(p.s - r[0].s) < 1e-6);

/** The curve's average speed (its area over 0–1): the clip's `speed`, which sets its length on the timeline. */
export function rampArea(r: Ramp): number {
  let a = 0;
  for (let i = 1; i < r.length; i++) a += ((r[i].u - r[i - 1].u) * (r[i].s + r[i - 1].s)) / 2;
  return a;
}

/** The speed at `u` (0–1; outside it, the edge's speed). */
export function rampSpeedAt(r: Ramp, u: number): number {
  if (u <= r[0].u) return r[0].s;
  for (let i = 1; i < r.length; i++) {
    if (u <= r[i].u) {
      const a = r[i - 1];
      const b = r[i];
      const d = b.u - a.u;
      return d > 0 ? a.s + ((b.s - a.s) * (u - a.u)) / d : b.s;
    }
  }
  return r[r.length - 1].s;
}

/** The speed added up from 0 to `u` (0–1): how much of the source has played by then, in curve units. */
export function rampCum(r: Ramp, u: number): number {
  const x = clamp(u, 0, 1);
  let f = 0;
  for (let i = 1; i < r.length; i++) {
    const a = r[i - 1];
    const b = r[i];
    if (x <= a.u) break;
    const t = Math.min(x, b.u) - a.u;
    const d = b.u - a.u;
    const k = d > 0 ? (b.s - a.s) / d : 0;
    f += a.s * t + (k * t * t) / 2;
  }
  return f;
}

/** The `u` where the speed added up reaches `f` (the other way of rampCum). */
export function rampInv(r: Ramp, f: number): number {
  if (f <= 0) return 0;
  let acc = 0;
  for (let i = 1; i < r.length; i++) {
    const a = r[i - 1];
    const b = r[i];
    const d = b.u - a.u;
    if (d <= 0) continue;
    const seg = (d * (a.s + b.s)) / 2;
    if (acc + seg >= f) {
      const k = (b.s - a.s) / d;
      const g = f - acc;
      // k/2·t² + s·t = g, solved without losing precision when k is small
      const t = (2 * g) / (a.s + Math.sqrt(Math.max(0, a.s * a.s + 2 * k * g)));
      return clamp(a.u + t, 0, 1);
    }
    acc += seg;
  }
  return 1;
}

/**
 * The part of a curve between `u0` and `u1` (either may be outside 0–1: the edge speed carries on), stretched back to
 * 0–1: what a piece of a split or trimmed clip keeps.
 */
export function rampSlice(r: Ramp, u0: number, u1: number): Ramp {
  if (!(u1 > u0)) return [{ u: 0, s: rampSpeedAt(r, u0) }, { u: 1, s: rampSpeedAt(r, u0) }];
  const pts: RampPoint[] = [{ u: u0, s: rampSpeedAt(r, u0) }];
  for (const p of r) if (p.u > u0 && p.u < u1) pts.push(p);
  pts.push({ u: u1, s: rampSpeedAt(r, u1) });
  const span = u1 - u0;
  return pts
    .map((p) => ({ u: round((p.u - u0) / span, 100000), s: round(p.s, 10000) }))
    .filter((p, i, all) => i === 0 || i === all.length - 1 || (p.u - all[i - 1].u > 0.00001 && all[all.length - 1].u - p.u > 0.00001));
}

/** A short signature of a curve (a cache key for its stretched sound). */
export const rampKey = (r: Ramp) => r.map((p) => `${p.u.toFixed(4)}:${p.s.toFixed(3)}`).join(",");

/** The curve's look in words for a label («بطيء ثم سريع», or «منحنى ٣ نقاط»). */
export function rampName(r: Ramp): string {
  const k = rampKey(r);
  const hit = RAMP_PRESET_IDS.find((id) => rampKey(RAMP_PRESETS[id].points) === k);
  return hit ? RAMP_PRESETS[hit].label : `منحنى ${r.length} نقاط`;
}

// ───────── a clip with a curve: source ↔ timeline ─────────

/** What the time mapping needs of a clip. */
export interface Timed {
  start: number;
  in: number;
  out: number;
  speed: number;
  ramp?: Ramp | null;
}

/** The clip's length on the timeline, unrounded. */
const lenOf = (c: Timed) => (c.out - c.in) / (c.speed || 1);

/** Where in its source a clip is at timeline time `ms` (before/after the clip: the edge speed carries on). */
export function rampSource(c: Timed, ms: number): number {
  const sp = c.speed || 1;
  const r = c.ramp;
  if (!r || r.length < 2) return c.in + (ms - c.start) * sp;
  const L = lenOf(c);
  const A = rampArea(r);
  const x = ms - c.start;
  if (L <= 0 || A <= 0) return c.in + x * sp;
  const k = sp / A;
  if (x <= 0) return c.in + x * r[0].s * k;
  if (x >= L) return c.out + (x - L) * r[r.length - 1].s * k;
  return c.in + L * k * rampCum(r, x / L);
}

/** Where on the timeline a clip plays source time `src` (the other way of rampSource). */
export function rampTimeline(c: Timed, src: number): number {
  const sp = c.speed || 1;
  const r = c.ramp;
  if (!r || r.length < 2) return c.start + (src - c.in) / sp;
  const L = lenOf(c);
  const A = rampArea(r);
  const y = src - c.in;
  const S = c.out - c.in;
  if (L <= 0 || A <= 0 || S <= 0) return c.start + y / sp;
  const k = sp / A;
  if (y <= 0) return c.start + y / (r[0].s * k);
  if (y >= S) return c.start + L + (y - S) / (r[r.length - 1].s * k);
  return c.start + L * rampInv(r, (y / S) * A);
}

/** How fast the clip plays at timeline time `ms` (the preview's playback rate). */
export function rampSpeed(c: Timed, ms: number): number {
  const sp = c.speed || 1;
  const r = c.ramp;
  if (!r || r.length < 2) return sp;
  const L = lenOf(c);
  const A = rampArea(r);
  if (L <= 0 || A <= 0) return sp;
  return (sp / A) * rampSpeedAt(r, (ms - c.start) / L);
}

/**
 * The clip cut to the timeline span [from, to) (absolute ms; past its ends the edge speed carries on): its new in/out,
 * speed and curve — a split's two sides, a trim, the part of a nested clip that shows. Without a curve it is the plain
 * constant-speed cut.
 */
export function cutTimed(c: Timed, from: number, to: number): { in: number; out: number; speed: number; ramp: Ramp | null } {
  const a = Math.round(rampSource(c, from));
  const b = Math.round(rampSource(c, to));
  const r = c.ramp;
  if (!r || r.length < 2) return { in: a, out: b, speed: c.speed, ramp: null };
  const L = lenOf(c);
  const part = rampSlice(r, (from - c.start) / L, (to - c.start) / L);
  if (isFlat(part)) return { in: a, out: b, speed: part[0].s, ramp: null };
  return { in: a, out: b, speed: rampArea(part), ramp: part };
}

/**
 * A sound at its curve, for the stretcher: for output sample `o` of the piece that starts at timeline time `fromMs`,
 * how many source samples after the piece's first one it reads. Undefined for a clip without a curve (a plain speed).
 */
export function rampSamples(c: Timed, fromMs: number, sr: number): ((o: number) => number) | undefined {
  if (!c.ramp || c.ramp.length < 2) return undefined;
  const s0 = rampSource(c, fromMs);
  return (o) => ((rampSource(c, fromMs + (o * 1000) / sr) - s0) * sr) / 1000;
}
