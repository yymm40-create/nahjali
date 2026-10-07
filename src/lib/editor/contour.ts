// «ماسك ذكي»: a subject's mask (a black-and-white picture from SAM) turned into the outline the grade's "path" window
// draws — the biggest piece (or the one nearest where the subject was), its outer edge walked round, then set out as
// a fixed number of corners from its top, clockwise, so the outlines of one tracked subject blend into each other.
// Pure.

import type { Pt } from "./grade";

/** The pieces of a mask (8-connected), each with its pixels' count and centre. */
function pieces(on: Uint8Array, w: number, h: number) {
  const label = new Int32Array(w * h).fill(-1);
  const out: { n: number; cx: number; cy: number; first: number }[] = [];
  const stack: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (!on[i] || label[i] >= 0) continue;
    const id = out.length;
    let n = 0,
      sx = 0,
      sy = 0;
    label[i] = id;
    stack.push(i);
    while (stack.length) {
      const k = stack.pop()!;
      const x = k % w,
        y = (k - x) / w;
      n++;
      sx += x;
      sy += y;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx,
            yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const j = yy * w + xx;
          if (on[j] && label[j] < 0) {
            label[j] = id;
            stack.push(j);
          }
        }
    }
    out.push({ n, cx: sx / n, cy: sy / n, first: i });
  }
  return { label, out };
}

/** The outer edge of the piece that starts at pixel `first` (its top-left pixel), walked clockwise (Moore). */
function trace(label: Int32Array, id: number, first: number, w: number, h: number): Pt[] {
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && label[y * w + x] === id;
  // the 8 neighbours clockwise from west (y grows down)
  const D = [
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
  ];
  const sx = first % w,
    sy = (first - sx) / w;
  const pts: Pt[] = [{ x: sx, y: sy }];
  // arrived moving east (the pixel before is the one to the west, outside): the search starts just after it
  let x = sx,
    y = sy,
    dir = 4;
  for (let guard = 0; guard < w * h * 4; guard++) {
    let moved = false;
    for (let k = 0; k < 8; k++) {
      const d = (dir + 5 + k) % 8;
      const nx = x + D[d][0],
        ny = y + D[d][1];
      if (inside(nx, ny)) {
        x = nx;
        y = ny;
        dir = d;
        moved = true;
        break;
      }
    }
    if (!moved || (x === sx && y === sy)) break;
    pts.push({ x, y });
  }
  return pts;
}

/** `n` corners spread evenly along a closed line. */
export function resample(line: Pt[], n: number): Pt[] {
  if (line.length < 2) return line.slice();
  const seg: number[] = [];
  let total = 0;
  for (let i = 0; i < line.length; i++) {
    const a = line[i],
      b = line[(i + 1) % line.length];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    seg.push(d);
    total += d;
  }
  const out: Pt[] = [];
  let i = 0,
    acc = 0;
  for (let k = 0; k < n; k++) {
    const want = (k / n) * total;
    while (i < seg.length - 1 && acc + seg[i] < want) acc += seg[i++];
    const a = line[i],
      b = line[(i + 1) % line.length];
    const f = seg[i] ? (want - acc) / seg[i] : 0;
    out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
  }
  return out;
}

/**
 * The subject's outline from a mask (`v` one value per pixel, above 127 = the subject): `n` corners in 0…1 of the
 * picture, from its top going clockwise, or null when the mask is empty. `near` picks the piece nearest that point
 * (where the subject was a moment before) instead of the biggest.
 */
export function maskOutline(v: ArrayLike<number>, w: number, h: number, n = 48, near?: Pt | null): { points: Pt[]; centre: Pt; area: number } | null {
  const on = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) on[i] = v[i] > 127 ? 1 : 0;
  const { label, out } = pieces(on, w, h);
  const big = out.filter((p) => p.n >= Math.max(4, w * h * 0.002));
  if (!big.length) return null;
  const pick = near
    ? big.reduce((b, p) => (Math.hypot(p.cx / w - near.x, p.cy / h - near.y) - p.n / (w * h) < Math.hypot(b.cx / w - near.x, b.cy / h - near.y) - b.n / (w * h) ? p : b))
    : big.reduce((b, p) => (p.n > b.n ? p : b));
  const id = out.indexOf(pick);
  const edge = trace(label, id, pick.first, w, h);
  // pixel centres → 0…1 (the edge pixels' outer side, so the outline wraps the subject)
  const line = edge.map((p) => ({ x: (p.x + 0.5) / w, y: (p.y + 0.5) / h }));
  return { points: resample(line, n), centre: { x: pick.cx / w, y: pick.cy / h }, area: pick.n / (w * h) };
}

/** The same outline started at the corner that best follows `prev` (so blending moves each corner the least). */
export function alignTo(points: Pt[], prev: Pt[]): Pt[] {
  if (points.length !== prev.length) return points;
  const n = points.length;
  let best = 0,
    bestD = Infinity;
  for (let s = 0; s < n; s++) {
    let d = 0;
    for (let i = 0; i < n; i += 4) d += Math.hypot(points[(i + s) % n].x - prev[i].x, points[(i + s) % n].y - prev[i].y);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return points.map((_, i) => points[(i + best) % n]);
}
