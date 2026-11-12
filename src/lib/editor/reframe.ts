// «حيدرة كت» — «اتبع الوجه» (auto reframe): a wide video in a tall (or square) frame follows the speaker's face like a
// camera operator would. Pure: the faces are found in the browser (MediaPipe, face.ts) a few times a second; here they
// become a calm path — the camera holds while the face stays near the middle (a dead zone), glides when it leaves it
// (eased, and never faster than a set speed), holds where no face is seen, and turns to another face only when it is
// clearly the one to watch for a while. The path becomes ordinary motion points on the clip (its keys, in source time),
// so the person can move any of them afterwards.

import type { FaceBox } from "./talk-motion";
import { LIMITS, type Key, type Transform } from "./model";

/** The faces seen at one moment (source ms; boxes in fractions of the source picture). */
export interface FaceFrame {
  ms: number;
  faces: FaceBox[];
}

/** The frame, the picture and its size in it: `fit: "cover"` (the picture fills the frame), times the clip's scale. */
export interface Geometry {
  /** the project's frame (px) */
  W: number;
  H: number;
  /** the source picture (px) */
  sw: number;
  sh: number;
  /** the clip's own scale (1 = just fills the frame) */
  scale: number;
}

export interface ReframeOptions {
  /** the camera holds while the face stays within this of where it is aimed (a share of the frame's width/height) */
  deadZone: number;
  /** the fastest the camera moves: frame widths (heights) a second */
  maxSpeed: number;
  /** how soft the camera's glide is: seconds to cover most of the way to the face */
  ease: number;
  /** the path is averaged over this many seconds at the end (the last of the jitter) */
  smooth: number;
  /** another face is followed only when it is this many times bigger than the one followed … */
  switchArea: number;
  /** … for this long (ms) */
  switchMs: number;
  /** where the face sits from the top of the frame (0.4 = a little above the middle: room over the head) */
  eyeLine: number;
}

export const REFRAME: ReframeOptions = { deadZone: 0.07, maxSpeed: 0.45, ease: 0.45, smooth: 0.6, switchArea: 1.8, switchMs: 900, eyeLine: 0.42 };

/** How far the clip's centre (its transform x/y) may go while the picture still covers the whole frame. */
export function bounds(g: Geometry) {
  const k = Math.max(g.W / g.sw, g.H / g.sh) * g.scale;
  const w = (g.sw * k) / g.W;
  const h = (g.sh * k) / g.H;
  // the picture's half-size beyond the frame's half: how far the centre can move each way
  const rx = Math.max(0, (w - 1) / 2);
  const ry = Math.max(0, (h - 1) / 2);
  return { x: [0.5 - rx, 0.5 + rx] as const, y: [0.5 - ry, 0.5 + ry] as const, w, h };
}

const area = (f: FaceBox) => f.w * f.h;
const dist = (a: FaceBox, b: FaceBox) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * The face followed at each moment (null where none is seen): the same person as before (the nearest face to where
 * they were), until another face is clearly the one to watch — `switchArea` times bigger for `switchMs`, or the one
 * followed has gone and another has stayed that long.
 */
export function followed(frames: FaceFrame[], o: ReframeOptions = REFRAME): (FaceBox | null)[] {
  let cur: FaceBox | null = null;
  let since: number | null = null;
  return frames.map((f) => {
    const faces = f.faces.filter((x) => x.w > 0 && x.h > 0);
    if (!faces.length) {
      since = null;
      return null;
    }
    const biggest = faces.reduce((a, b) => (area(b) > area(a) ? b : a));
    if (!cur) {
      cur = biggest;
      return cur;
    }
    const prev: FaceBox = cur;
    const near = faces.reduce((a, b) => (dist(b, prev) < dist(a, prev) ? b : a));
    // the same person: near where they were (allowing for a move of about their own width)
    const same = dist(near, prev) <= Math.max(0.12, prev.w * 1.5) ? near : null;
    const rival = same ? (biggest !== same && area(biggest) >= area(same) * o.switchArea ? biggest : null) : biggest;
    if (rival) {
      since ??= f.ms;
      if (f.ms - since >= o.switchMs) {
        cur = rival;
        since = null;
        return cur;
      }
    } else since = null;
    if (same) cur = same;
    // the followed person not found but someone else is (not yet long enough): hold on them
    return same ?? null;
  });
}

/** Where the clip's centre must be (transform x/y) to put a face at the frame's middle (and its eye line). */
export function aimAt(face: FaceBox, g: Geometry, o: ReframeOptions = REFRAME) {
  const b = bounds(g);
  const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, v));
  return { x: clamp(0.5 + b.w * (0.5 - face.x), b.x), y: clamp(o.eyeLine + b.h * (0.5 - face.y), b.y) };
}

export interface PathPoint {
  /** source ms */
  t: number;
  x: number;
  y: number;
}

/** One axis of the camera: holds inside the dead zone, glides (eased, speed-capped) outside it, held where nothing is seen. */
function follow(ts: number[], aims: (number | null)[], start: number, o: ReframeOptions, lo: number, hi: number) {
  let cam = start;
  let goal = start;
  let moving = false;
  const out: number[] = [];
  for (let i = 0; i < ts.length; i++) {
    const dt = i ? Math.max(0, (ts[i] - ts[i - 1]) / 1000) : 0;
    const aim = aims[i];
    if (aim != null) {
      // start moving when the face leaves the dead zone; once moving, go all the way to it (no stopping at the edge)
      if (Math.abs(aim - cam) > o.deadZone) moving = true;
      if (moving) goal = aim;
    }
    if (moving) {
      const k = o.ease > 0 ? 1 - Math.exp(-dt / o.ease) : 1;
      const step = Math.max(-o.maxSpeed * dt, Math.min(o.maxSpeed * dt, (goal - cam) * k));
      cam += step;
      if (Math.abs(goal - cam) < o.deadZone * 0.15) moving = false;
    }
    cam = Math.min(hi, Math.max(lo, cam));
    out.push(cam);
  }
  return out;
}

/** A centred average over `win` ms (the path's last tremble taken out; it can't leave the bounds or move faster). */
function average(ts: number[], v: number[], win: number) {
  if (win <= 0 || v.length < 3) return v;
  const half = win / 2;
  let a = 0;
  let b = 0;
  let sum = 0;
  return v.map((_, i) => {
    while (b < v.length && ts[b] <= ts[i] + half) sum += v[b++];
    while (ts[a] < ts[i] - half) sum -= v[a++];
    return sum / (b - a);
  });
}

/** No step faster than `speed` a second (the averaged path's ends can lean a little past it). */
function capped(ts: number[], v: number[], speed: number) {
  const out = v.slice();
  for (let i = 1; i < out.length; i++) {
    const most = (speed * Math.max(0, ts[i] - ts[i - 1])) / 1000;
    out[i] = Math.max(out[i - 1] - most, Math.min(out[i - 1] + most, out[i]));
  }
  return out;
}

/**
 * The camera's path over the frames (source ms → the clip's centre), always inside the bounds so the picture covers
 * the frame. Before the first face is seen it waits on the first one; with no face at all it stays where `rest` is.
 */
export function cropPath(frames: FaceFrame[], g: Geometry, rest: Pick<Transform, "x" | "y">, o: ReframeOptions = REFRAME): PathPoint[] {
  if (!frames.length) return [];
  const b = bounds(g);
  const faces = followed(frames, o);
  const aims = faces.map((f) => (f ? aimAt(f, g, o) : null));
  const first = aims.find((x) => x);
  const clampTo = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, v));
  const sx = first ? first.x : clampTo(rest.x, b.x);
  const sy = first ? first.y : clampTo(rest.y, b.y);
  const ts = frames.map((f) => f.ms);
  const xs = capped(ts, average(ts, follow(ts, aims.map((a) => a?.x ?? null), sx, o, b.x[0], b.x[1]), o.smooth * 1000), o.maxSpeed);
  const ys = capped(ts, average(ts, follow(ts, aims.map((a) => a?.y ?? null), sy, o, b.y[0], b.y[1]), o.smooth * 1000), o.maxSpeed);
  return ts.map((t, i) => ({ t: Math.round(t), x: clampTo(xs[i], b.x), y: clampTo(ys[i], b.y) }));
}

/** The distance of a point from the line between two others (time scaled so a second weighs like a frame's width). */
function off(p: PathPoint, a: PathPoint, b: PathPoint) {
  const span = b.t - a.t || 1;
  const r = (p.t - a.t) / span;
  return Math.max(Math.abs(p.x - (a.x + (b.x - a.x) * r)), Math.abs(p.y - (a.y + (b.y - a.y) * r)));
}

/** The points that matter (Ramer–Douglas–Peucker): the path redrawn from these is never further than `tol` from it. */
function simplify(path: PathPoint[], tol: number): PathPoint[] {
  if (path.length <= 2) return path;
  const keep = new Uint8Array(path.length);
  keep[0] = keep[path.length - 1] = 1;
  const stack: [number, number][] = [[0, path.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let worst = -1;
    let at = -1;
    for (let i = a + 1; i < b; i++) {
      const d = off(path[i], path[a], path[b]);
      if (d > worst) {
        worst = d;
        at = i;
      }
    }
    if (at > 0 && worst > tol) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  return path.filter((_, i) => keep[i]);
}

/**
 * The path as the clip's motion points (source ms, the clip's own scale, turn and opacity kept): as few as keep it
 * within a hair of the path, never more than the editor allows. A camera that never moves gives one point.
 */
export function toKeys(path: PathPoint[], base: Transform, max: number = LIMITS.keys): Key[] {
  if (!path.length) return [];
  const still = path.every((p) => Math.abs(p.x - path[0].x) < 1e-4 && Math.abs(p.y - path[0].y) < 1e-4);
  const pts = still ? [path[0]] : (() => {
    let tol = 0.003;
    let s = simplify(path, tol);
    while (s.length > max && tol < 1) s = simplify(path, (tol *= 1.6));
    return s;
  })();
  const r = (v: number) => Math.round(v * 10000) / 10000;
  return pts.map((p) => ({ t: p.t, x: r(p.x), y: r(p.y), scale: base.scale, rotate: base.rotate, opacity: base.opacity }));
}

/** How many moments of a clip to look at: about five a second, between 4 and 1200. */
export const looksFor = (ms: number) => Math.max(4, Math.min(1200, Math.round(ms / 200)));
