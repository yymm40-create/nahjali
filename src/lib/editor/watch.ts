// «👁️ حيدرا ماكس يشوف المقطع كامل» — the selected clip WATCHED, not glanced at: the person's browser goes through every
// frame it plays (a tiny copy of each, src/components/jawad/editor/watch.ts) and measures it — how bright, how much it
// changed from the one before — so the cuts, the black and the frozen moments and the motion are found in all of them;
// then the frames worth seeing (every cut, and the rest evenly, many a second for a short clip) are drawn as numbered
// tiles on contact sheets, each with its time on the timeline. حيدرا ماكس gets the sheets and the measured summary.
// Pure: the reading of the measurements and of what the page sends.

/** One measured frame: its time on the timeline, its brightness (0–255) and how much it changed from the one before. */
export interface FrameStat {
  t: number;
  luma: number;
  diff: number;
}

export interface Watch {
  clipId: string;
  /** contact sheets: a JPEG each, and the timeline time of each of its tiles in order */
  sheets: { data: string; times: number[] }[];
  /** frames measured, and the span they cover (timeline ms) */
  analysed: number;
  from: number;
  to: number;
  cuts: number[];
  black: [number, number][];
  frozen: [number, number][];
  /** how much happens in each second (mean change, 0–100) */
  motion: number[];
}

export const WATCH = {
  /** frames shown to him at most (tiles), and per sheet */
  tiles: 96,
  perSheet: 12,
  sheets: 8,
  /** a tile's box (px) */
  tile: 300,
  /** frames measured at most, and the tiny copy each is measured on */
  measureMax: 3600,
  probeW: 32,
  probeH: 18,
  /** a sheet's JPEG, in base64 characters, at most */
  sheetMax: 700_000,
} as const;

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** The cuts: a change far above the clip's usual change, the biggest within a third of a second. */
export function findCuts(stats: FrameStat[]): number[] {
  if (stats.length < 3) return [];
  const d = stats.slice(1).map((s) => s.diff);
  const m = mean(d);
  const sd = Math.sqrt(mean(d.map((x) => (x - m) ** 2)));
  const bar = Math.max(18, m + 3 * sd);
  const out: number[] = [];
  for (let i = 1; i < stats.length; i++) {
    const s = stats[i];
    if (s.diff < bar) continue;
    const near = stats.filter((x) => Math.abs(x.t - s.t) < 330);
    if (near.some((x) => x.diff > s.diff)) continue;
    if (out.length && s.t - out[out.length - 1] < 330) continue;
    out.push(s.t);
  }
  return out;
}

/** Spans where a test holds for at least `minMs` (black: almost no light; frozen: almost no change). */
export function spansOf(stats: FrameStat[], test: (s: FrameStat) => boolean, minMs: number): [number, number][] {
  const out: [number, number][] = [];
  let start: number | null = null;
  let last = 0;
  for (const s of stats) {
    if (test(s)) {
      if (start === null) start = s.t;
      last = s.t;
    } else if (start !== null) {
      if (last - start >= minMs) out.push([start, last]);
      start = null;
    }
  }
  if (start !== null && last - start >= minMs) out.push([start, last]);
  return out;
}

/** How much happens in each second of the span (mean change of the frames in it, rounded). */
export function motionPerSecond(stats: FrameStat[], from: number, to: number): number[] {
  const n = Math.max(1, Math.ceil((to - from) / 1000));
  const out: number[] = [];
  for (let i = 0; i < Math.min(n, 600); i++) {
    const inSec = stats.filter((s) => s.t >= from + i * 1000 && s.t < from + (i + 1) * 1000).map((s) => s.diff);
    out.push(Math.round(Math.min(100, mean(inSec))));
  }
  return out;
}

/**
 * The frames to show him: one just after every cut (what the new shot is), then the rest spread evenly over the span,
 * never two closer than a frame apart — up to `budget`.
 */
export function pickTimes(from: number, to: number, cuts: number[], budget: number = WATCH.tiles): number[] {
  const len = Math.max(1, to - from);
  const after = cuts.map((c) => Math.min(to - 1, c + 80)).slice(0, Math.floor(budget / 3));
  const rest = Math.max(1, budget - after.length);
  // a short clip is seen many times a second (at most 8), a long one evenly
  const step = Math.max(125, len / rest);
  const even: number[] = [];
  for (let t = from + step / 2; t < to && even.length < rest; t += step) even.push(Math.round(t));
  // the frames after the cuts always stay; an even one too close to a kept frame is dropped
  const out = [...after];
  for (const t of even) if (out.every((k) => Math.abs(k - t) >= 40)) out.push(t);
  return out.sort((a, b) => a - b).slice(0, budget);
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const nums = (v: unknown, max: number) => (Array.isArray(v) ? v.map(num).filter((x): x is number => x !== null).slice(0, max) : []);
const pairs = (v: unknown) =>
  (Array.isArray(v) ? v : [])
    .filter((p): p is [number, number] => Array.isArray(p) && p.length === 2 && num(p[0]) !== null && num(p[1]) !== null)
    .slice(0, 60)
    .map(([a, b]) => [Math.round(a), Math.round(b)] as [number, number]);

/** What the page sent, checked: a clip of this timeline, a few sheets of plain base64 JPEG, numbers only. */
export function readWatch(v: unknown, clipIds: Set<string>): Watch | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.clipId !== "string" || !clipIds.has(o.clipId)) return null;
  const sheets = (Array.isArray(o.sheets) ? o.sheets : [])
    .filter((s): s is { data: string; times: unknown } => !!s && typeof s === "object" && typeof (s as { data?: unknown }).data === "string")
    .filter((s) => s.data.length < WATCH.sheetMax && /^[A-Za-z0-9+/]+=*$/.test(s.data))
    .slice(0, WATCH.sheets)
    .map((s) => ({ data: s.data, times: nums(s.times, WATCH.perSheet).map(Math.round) }));
  if (!sheets.length) return null;
  const from = Math.round(num(o.from) ?? 0);
  const to = Math.round(num(o.to) ?? from);
  return {
    clipId: o.clipId,
    sheets,
    analysed: Math.max(0, Math.round(num(o.analysed) ?? 0)),
    from,
    to: Math.max(from, to),
    cuts: nums(o.cuts, 200).map(Math.round),
    black: pairs(o.black),
    frozen: pairs(o.frozen),
    motion: nums(o.motion, 600).map((x) => Math.max(0, Math.min(100, Math.round(x)))),
  };
}

const sec = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

/** The words that go with the sheets: what was measured, what was found, how to read the tiles. */
export function watchText(w: Watch): string {
  const shown = w.sheets.reduce((n, s) => n + s.times.length, 0);
  const lenS = (w.to - w.from) / 1000;
  return [
    `THE SELECTED CLIP (${w.clipId}) WATCHED WHOLE, ${sec(w.from)}–${sec(w.to)} on the timeline (${lenS.toFixed(1)} s): the page went through ${w.analysed} frames (about ${lenS > 0 ? Math.round(w.analysed / lenS) : 0} a second) and measured every one; ${shown} of them are shown below on ${w.sheets.length} contact sheets — tiles left to right, top to bottom, in time order, each labelled with its TIMELINE time. Use them as your eyes on this clip: what is in it, who does what and when, text on screen, where each shot starts and ends, the best and the weak moments. Name moments by these times; when you cut or place something on a moment, use the timeline ms of the tile.`,
    `MEASURED IN EVERY FRAME — cuts (a new shot starts): ${w.cuts.length ? w.cuts.map(sec).join(", ") : "none"}; black: ${w.black.length ? w.black.map(([a, b]) => `${sec(a)}–${sec(b)}`).join(", ") : "none"}; frozen (no change for a second or more): ${w.frozen.length ? w.frozen.map(([a, b]) => `${sec(a)}–${sec(b)}`).join(", ") : "none"}.`,
    w.motion.length ? `HOW MUCH HAPPENS EACH SECOND (0 still … 100 everything changes), from ${sec(w.from)}: ${w.motion.join(" ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Does the person's request need to SEE what happens in the clip (rather than its settings)? */
export const asksToSee = (message: string) =>
  /(شوف|تشوف|شاهد|اتفرج|تفرج|تابع|لاحظ|اوصف|أوصف|وصف|صف لي|حلل|حلّل|افهم|تفهم|وش (فيه|يصير|صاير|قاعد|يسوي)|ايش (فيه|يصير)|متى|وين|أي لحظة|اي لحظة|اللحظة|لحظة|اللقطة|لقطة|لقطات|مشهد|يظهر|يطلع|يدخل|يتحرك|يمشي|يضحك|يتكلم|حركة|كل فريم|فريم|محتوى المقطع|في المقطع|بالمقطع|في الفيديو|بالفيديو|watch|look at|describe|what happens|when does)/i.test(message);
