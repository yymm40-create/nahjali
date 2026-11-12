// «حيدرة كت» — «طلّع مقاطع قصيرة» (the OpusClip way) and «ابحث في مقاطعك»: the pure part (page, server and tests).
// A file's words (source ms, speech.ts) become sentences; Claude picks moments as runs of whole sentences, and here
// they are checked, snapped to the pauses around the words (never inside a word), fitted to the length asked and
// turned into editing commands — a new timeline holding just that part of the file (optionally 9:16 and captioned),
// or the part put at the playhead. A moment's place on the open timeline goes through the clip's own time mapping
// (model.ts timelineTime), so cuts and speed curves are followed.

import { DEFAULT_TRANSFORM, timelineTime, type Clip, type Ratio, type Timeline } from "./model";
import type { Command } from "./commands";
import type { TWord } from "./transcript";

// ───────────────────────────── lengths, count, price units ─────────────────────────────

/** A short's length (seconds): the person's range is kept inside these, `min`/`max` are the starting values. */
export const SHORT_LEN = { floor: 5, ceil: 180, min: 15, max: 90 } as const;
/** How many moments are asked for (and the most kept). */
export const SHORT_COUNT = { min: 3, max: 10, default: 6 } as const;
/** The price is per started block of this many minutes of the file. */
export const SHORTS_BLOCK_MIN = 10;
/** The longest file looked through in one go (3 hours). */
export const SHORTS_MAX_MS = 3 * 3600_000;
export const shortsUnits = (durationMs: number) => Math.max(1, Math.ceil(Math.max(0, durationMs) / (SHORTS_BLOCK_MIN * 60_000)));

/** The length range asked (seconds, whole), kept sensible: inside SHORT_LEN and at least 5 s apart. */
export function readLengths(min: unknown, max: unknown): { min: number; max: number } {
  const n = (v: unknown, d: number) => (Number.isFinite(Number(v)) && v !== null && v !== "" ? Math.round(Number(v)) : d);
  let lo = Math.min(SHORT_LEN.ceil - 5, Math.max(SHORT_LEN.floor, n(min, SHORT_LEN.min)));
  let hi = Math.min(SHORT_LEN.ceil, Math.max(SHORT_LEN.floor + 5, n(max, SHORT_LEN.max)));
  if (hi < lo) [lo, hi] = [hi, lo];
  if (hi - lo < 5) hi = Math.min(SHORT_LEN.ceil, lo + 5);
  return { min: lo, max: hi };
}

export const readCount = (v: unknown) => (Number.isFinite(Number(v)) && v !== null ? Math.min(SHORT_COUNT.max, Math.max(SHORT_COUNT.min, Math.round(Number(v)))) : SHORT_COUNT.default);

// ───────────────────────────── sentences ─────────────────────────────

/** One sentence of a file: its words `a`…`b` (indices, both included) and their times (source ms). */
export interface Sentence {
  a: number;
  b: number;
  s: number;
  e: number;
  /** it ends a thought (a full stop, a question, or a long pause), not only a breath inside a long one */
  strong: boolean;
}

const END = /[.!?؟…]["»”'’)\]]*$/;
const SOFT = /[،,؛;:\-–—]["»”'’)\]]*$/;
/** A pause this long ends a sentence. */
export const STRONG_PAUSE_MS = 700;
/** A pause this long is a breath a long sentence can be split at. */
export const SOFT_PAUSE_MS = 300;
/** A sentence longer than this is split at its best breath. */
export const SENTENCE_MAX_MS = 25_000;

const gapAfter = (words: TWord[], i: number) => (i + 1 < words.length ? words[i + 1].s - words[i].e : Infinity);

/** The file's words as sentences: a full stop or question mark, or a long pause, ends one; a very long one is split at its best breath. */
export function sentences(words: TWord[]): Sentence[] {
  const out: Sentence[] = [];
  let a = 0;
  const push = (from: number, to: number, strong: boolean) => out.push({ a: from, b: to, s: words[from].s, e: words[to].e, strong });
  for (let i = 0; i < words.length; i++) {
    if (END.test(words[i].w.trim()) || gapAfter(words, i) >= STRONG_PAUSE_MS) {
      push(a, i, true);
      a = i + 1;
      continue;
    }
    if (words[i].e - words[a].s < SENTENCE_MAX_MS || i === a) continue;
    // too long: split after the word with the longest pause (a comma counts as a long one)
    let best = a;
    let score = -Infinity;
    for (let j = a; j < i; j++) {
      const sc = gapAfter(words, j) + (SOFT.test(words[j].w.trim()) ? 1000 : 0);
      if (sc >= score) {
        best = j;
        score = sc;
      }
    }
    push(a, best, false);
    a = best + 1;
  }
  if (a < words.length) push(a, words.length - 1, true);
  return out;
}

// ───────────────────────────── snapping and fitting ─────────────────────────────

/** Taken before the first word and after the last one (a breath), never into a neighbouring word. */
export const LEAD_MS = 150;
export const TAIL_MS = 300;

/** Words `a`…`b` as a source range that starts and ends in the pauses around them (never inside a word). */
export function snapRange(words: TWord[], a: number, b: number, durationMs = Infinity): { s: number; e: number } {
  const first = words[a];
  const last = words[b];
  const prevE = a > 0 ? words[a - 1].e : 0;
  const nextS = b + 1 < words.length ? words[b + 1].s : durationMs;
  const s = Math.max(0, Math.min(first.s, Math.max(prevE, first.s - LEAD_MS)));
  const e = Math.max(last.e, Math.min(nextS, last.e + TAIL_MS, durationMs));
  return { s: Math.round(s), e: Math.round(e) };
}

export interface Fitted {
  /** word indices (both included) */
  a: number;
  b: number;
  /** source ms */
  s: number;
  e: number;
}

/**
 * Sentences `from`…`to` fitted to `minMs`–`maxMs`: too long loses sentences from its end (its opening is its hook),
 * too short takes the next ones (or the ones before at the end of the file), and it prefers to stop at the end of a
 * thought. One sentence longer than the most is cut at its last breath that fits (still between two words). Null when
 * it can't be made long enough.
 */
export function fitLength(words: TWord[], sents: Sentence[], from: number, to: number, minMs: number, maxMs: number, durationMs = Infinity): Fitted | null {
  if (!sents.length) return null;
  let f = Math.max(0, Math.min(from, to, sents.length - 1));
  let t = Math.min(sents.length - 1, Math.max(from, to, f));
  const len = (x: number, y: number) => {
    const r = snapRange(words, sents[x].a, sents[y].b, durationMs);
    return r.e - r.s;
  };
  while (t > f && len(f, t) > maxMs) t--;
  while (len(f, t) < minMs) {
    if (t + 1 < sents.length && len(f, t + 1) <= maxMs) t++;
    else if (f > 0 && len(f - 1, t) <= maxMs) f--;
    else break;
  }
  // end on a finished thought when one is near: back to the last one that is still long enough, else on to the next
  if (!sents[t].strong) {
    let to2 = -1;
    for (let y = t - 1; y >= f; y--) {
      if (sents[y].strong && len(f, y) >= minMs) {
        to2 = y;
        break;
      }
    }
    if (to2 < 0) {
      for (let y = t + 1; y < sents.length && len(f, y) <= maxMs; y++) {
        if (sents[y].strong) {
          to2 = y;
          break;
        }
      }
    }
    if (to2 >= 0) t = to2;
  }
  const a = sents[f].a;
  let b = sents[t].b;
  if (len(f, t) > maxMs) {
    // one sentence longer than the most: cut after its last word that still fits, preferring a breath
    const s0 = snapRange(words, a, a, durationMs).s;
    let fit = -1;
    let breath = -1;
    for (let k = a; k <= b; k++) {
      if (snapRange(words, a, k, durationMs).e - s0 > maxMs) break;
      fit = k;
      if (gapAfter(words, k) >= SOFT_PAUSE_MS || SOFT.test(words[k].w.trim())) breath = k;
    }
    if (fit < 0) return null;
    b = breath >= 0 && snapRange(words, a, breath, durationMs).e - s0 >= minMs ? breath : fit;
  }
  const r = snapRange(words, a, b, durationMs);
  if (r.e - r.s < minMs) return null;
  return { a, b, s: r.s, e: r.e };
}

// ───────────────────────────── what Claude sends back ─────────────────────────────

/** What a reason speaks about (OpusClip's four): how strong the opening is, whether it stands alone, value/feeling, pace. */
export const REASON_KINDS = { hook: "البداية", complete: "مكتمل لحاله", value: "القيمة والإحساس", pace: "الإيقاع" } as const;
export type ReasonKind = keyof typeof REASON_KINDS;

export interface Reason {
  kind: ReasonKind;
  text: string;
}

/** One moment as Claude named it: sentences `from`…`to`. */
export interface RawMoment {
  from: number;
  to: number;
  title: string;
  score: number;
  reasons: Reason[];
  tip: string;
}

/** The reply's JSON shape (sent as the call's schema). */
export const SHORTS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["clips"],
  properties: {
    clips: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["from", "to", "title", "score", "reasons", "tip"],
        properties: {
          from: { type: "integer", description: "the first sentence's number" },
          to: { type: "integer", description: "the last sentence's number (included)" },
          title: { type: "string" },
          score: { type: "integer", description: "0–99" },
          reasons: {
            type: "array",
            items: { type: "object", additionalProperties: false, required: ["kind", "text"], properties: { kind: { type: "string", enum: Object.keys(REASON_KINDS) }, text: { type: "string" } } },
          },
          tip: { type: "string" },
        },
      },
    },
  },
} as const;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/**
 * Claude's reply made safe: sentence numbers whole and inside the file (swapped when backwards), a score 0–99, two or
 * three short reasons of the known kinds (one at least), a title and a tip of sensible length. A moment that can't be
 * read is dropped, never guessed.
 */
export function readMoments(v: unknown, sentenceCount: number): RawMoment[] {
  const list = v && typeof v === "object" && Array.isArray((v as { clips?: unknown }).clips) ? (v as { clips: unknown[] }).clips : [];
  const out: RawMoment[] = [];
  for (const x of list.slice(0, 30)) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    let from = Number(o.from);
    let to = Number(o.to);
    if (!Number.isInteger(from) || !Number.isInteger(to)) continue;
    if (from > to) [from, to] = [to, from];
    if (from < 0 || to >= sentenceCount) continue;
    const score = Number(o.score);
    if (o.score === null || o.score === "" || !Number.isFinite(score)) continue;
    const reasons: Reason[] = [];
    for (const r of Array.isArray(o.reasons) ? o.reasons : []) {
      const kind = (r as { kind?: unknown })?.kind;
      const text = str((r as { text?: unknown })?.text, 90);
      if (typeof kind === "string" && kind in REASON_KINDS && text && reasons.length < 3) reasons.push({ kind: kind as ReasonKind, text });
    }
    const title = str(o.title, 70);
    if (!title || !reasons.length) continue;
    out.push({ from, to, title, score: Math.min(99, Math.max(0, Math.round(score))), reasons, tip: str(o.tip, 160) });
  }
  return out;
}

// ───────────────────────────── the moments, ready ─────────────────────────────

export interface Moment {
  id: string;
  assetId: string;
  /** source ms */
  s: number;
  e: number;
  title: string;
  /** 0–99, an estimate */
  score: number;
  reasons: Reason[];
  tip: string;
  /** its first words (to recognise it) */
  text: string;
}

/** What is said in words `a`…`b`, at most `max` words (with «…» when cut). */
export function wordsText(words: TWord[], a: number, b: number, max = 30) {
  const part = words.slice(a, b + 1).map((w) => w.w.trim()).filter(Boolean);
  return part.length > max ? `${part.slice(0, max).join(" ")} …` : part.join(" ");
}

/** How much two ranges overlap, as a share of the shorter one. */
const overlap = (x: { s: number; e: number }, y: { s: number; e: number }) => Math.max(0, Math.min(x.e, y.e) - Math.max(x.s, y.s)) / Math.max(1, Math.min(x.e - x.s, y.e - y.s));

/**
 * Claude's moments as clips: each fitted to the length range and snapped to the pauses; one that overlaps a better one
 * by more than a third is dropped; the best `count` are kept, best first.
 */
export function planMoments(raw: RawMoment[], words: TWord[], sents: Sentence[], o: { assetId: string; minMs: number; maxMs: number; count: number; durationMs?: number }): Moment[] {
  const fitted = raw
    .map((m) => ({ m, f: fitLength(words, sents, m.from, m.to, o.minMs, o.maxMs, o.durationMs) }))
    .filter((x): x is { m: RawMoment; f: Fitted } => !!x.f)
    .sort((x, y) => y.m.score - x.m.score);
  const kept: Moment[] = [];
  for (const { m, f } of fitted) {
    if (kept.length >= Math.min(SHORT_COUNT.max, o.count)) break;
    if (kept.some((k) => overlap(k, f) > 1 / 3)) continue;
    kept.push({ id: `${o.assetId.slice(0, 8)}-${f.s}`, assetId: o.assetId, s: f.s, e: f.e, title: m.title, score: m.score, reasons: m.reasons, tip: m.tip, text: wordsText(words, f.a, f.b, 24) });
  }
  return kept;
}

/** Kept moments read back (from a file's record): only well-formed ones. */
export function readKeptMoments(v: unknown): Moment[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((x) => {
    const o = (x ?? {}) as Record<string, unknown>;
    const s = Number(o.s);
    const e = Number(o.e);
    if (typeof o.assetId !== "string" || !Number.isFinite(s) || !Number.isFinite(e) || e <= s) return [];
    const reasons = (Array.isArray(o.reasons) ? o.reasons : []).flatMap((r) => {
      const kind = (r as { kind?: unknown })?.kind;
      const text = str((r as { text?: unknown })?.text, 90);
      return typeof kind === "string" && kind in REASON_KINDS && text ? [{ kind: kind as ReasonKind, text }] : [];
    });
    return [{ id: str(o.id, 40) || `${o.assetId.slice(0, 8)}-${s}`, assetId: o.assetId, s, e, title: str(o.title, 70), score: Math.min(99, Math.max(0, Math.round(Number(o.score) || 0))), reasons: reasons.slice(0, 3), tip: str(o.tip, 160), text: str(o.text, 400) }];
  });
}

// ───────────────────────────── for Claude ─────────────────────────────

const clock = (ms: number) => {
  const t = Math.floor(ms / 1000);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(s).padStart(2, "0")}`;
};

/** The transcript as Claude reads it: one numbered sentence a line, with its start and length. */
export function sentenceLines(words: TWord[], sents: Sentence[]) {
  return sents.map((x, i) => `[${i}] ${clock(x.s)} (${Math.max(1, Math.round((x.e - x.s) / 1000))}s) ${wordsText(words, x.a, x.b, 400)}`).join("\n");
}

// ───────────────────────────── «ابحث في مقاطعك» ─────────────────────────────

/**
 * A word as it is searched: no diacritics, tatweel or punctuation, lower case, and the letters that are written more
 * than one way as one: أ إ آ ٱ → ا, ة → ه, ى → ي, ؤ → و, ئ → ي.
 */
export function searchForm(w: string) {
  return w
    .normalize("NFKC")
    .replace(/[ً-ٰٟۖ-ۭـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .toLowerCase();
}

export interface Hit {
  assetId: string;
  /** the matched words (indices in the file's words) */
  a: number;
  b: number;
  /** when the match is said (source ms) */
  at: number;
  /** its sentence(s), snapped to the pauses: what «ضيفه» places (source ms) */
  s: number;
  e: number;
  before: string;
  match: string;
  after: string;
}

/** The fewest letters a search needs (one letter would match nearly every word). */
export const SEARCH_MIN = 2;
export const SEARCH_LIMIT = 200;

/**
 * Every place the words are said across the files (in `order`, then the rest): the query's words must follow one
 * another, each inside a said word (partial words match: «كتاب» finds «الكتاب»), letter forms ignored (searchForm).
 */
export function searchSpeech(speech: Record<string, { words: TWord[] } | undefined>, query: string, o: { order?: string[]; limit?: number; durations?: Record<string, number | null | undefined> } = {}): Hit[] {
  const toks = query.split(/\s+/).map(searchForm).filter(Boolean);
  if (toks.join("").length < SEARCH_MIN) return [];
  const limit = o.limit ?? SEARCH_LIMIT;
  const ids = [...new Set([...(o.order ?? []).filter((id) => speech[id]), ...Object.keys(speech)])];
  const out: Hit[] = [];
  for (const id of ids) {
    const words = speech[id]?.words ?? [];
    if (!words.length) continue;
    // the words that have letters (a lone punctuation mark is skipped)
    const idx: number[] = [];
    const forms: string[] = [];
    words.forEach((w, i) => {
      const f = searchForm(w.w);
      if (!f) return;
      idx.push(i);
      forms.push(f);
    });
    let sents: Sentence[] | null = null;
    for (let k = 0; k + toks.length <= forms.length; k++) {
      if (!toks.every((t, j) => forms[k + j].includes(t))) continue;
      sents ??= sentences(words);
      const a = idx[k];
      const b = idx[k + toks.length - 1];
      const sa = sents.find((x) => x.a <= a && a <= x.b) ?? sents[0];
      const sb = sents.find((x) => x.a <= b && b <= x.b) ?? sa;
      const r = snapRange(words, sa.a, sb.b, o.durations?.[id] ?? Infinity);
      out.push({ assetId: id, a, b, at: words[a].s, s: r.s, e: r.e, before: tail(words, sa.a, a - 1, 12), match: wordsText(words, a, b, 40), after: wordsText(words, b + 1, sb.b, 12) });
      if (out.length >= limit) return out;
      k += toks.length - 1;
    }
  }
  return out;
}

/** The last `max` words of `a`…`b` (with «…» in front when cut). */
function tail(words: TWord[], a: number, b: number, max: number) {
  const part = words.slice(Math.max(0, a), b + 1).map((w) => w.w.trim()).filter(Boolean);
  return part.length > max ? `… ${part.slice(-max).join(" ")}` : part.join(" ");
}

// ───────────────────────────── on the timeline ─────────────────────────────

/** A file's part `s`–`e` (source ms) as a plain clip starting at 0 (speed 1, the whole picture filling the frame). */
export function rangeClip(assetId: string, s: number, e: number): Clip {
  return {
    id: "src",
    assetId,
    seq: null,
    start: 0,
    in: Math.max(0, Math.round(s)),
    out: Math.max(Math.round(s) + 100, Math.round(e)),
    speed: 1,
    volume: 1,
    fit: "cover",
    transform: { ...DEFAULT_TRANSFORM },
    text: null,
    keys: [],
    color: null,
    grades: [],
    transition: null,
    fadeIn: 0,
    fadeOut: 0,
    shape: "rect",
    crop: null,
    blend: "normal",
    key: null,
    words: [],
    bg: null,
    sound: null,
    anim: null,
    fx: [],
    own: false,
    fix: null,
  };
}

/** «ضيفه»: the part of the file put on the timeline at `at` (the main track for a video, a sound track for sound). */
export const placeRange = (assetId: string, s: number, e: number, at: number): Command => ({ type: "paste_clips", clips: [{ clip: rangeClip(assetId, s, e), trackId: "" }], at: Math.max(0, Math.round(at)) });

/** A caption line of a short (ms from the short's start). */
export interface ShortCaption {
  start: number;
  end: number;
  body: string;
  words?: { s: number; e: number; w: string }[];
}

/**
 * «سوّه مقطع»: a new timeline (named after the moment) holding just its part of the file from 0, in the shape asked
 * (9:16 for a reel), with its captions when they were chosen — one undo. The new timeline is the one left open.
 */
export function shortCommands(m: Pick<Moment, "assetId" | "s" | "e" | "title">, o: { ratio?: Ratio | null; captions?: ShortCaption[] | null; style?: "karaoke" | "pop2" | "classic" | "box" | "neon" } = {}): Command[] {
  const cmds: Command[] = [{ type: "seq_new", name: m.title.slice(0, 40) }];
  if (o.ratio) cmds.push({ type: "set_ratio", ratio: o.ratio });
  cmds.push(placeRange(m.assetId, m.s, m.e, 0));
  if (o.captions?.length) cmds.push({ type: "add_captions", items: o.captions, style: o.style ?? "karaoke", name: "كابشن" });
  return cmds;
}

/** The file's words said in `s`–`e` as times in a short that starts there (a word belongs where its middle is). */
export function wordsInShort(words: TWord[], s: number, e: number): TWord[] {
  return words.filter((w) => (w.s + w.e) / 2 >= s && (w.s + w.e) / 2 < e).map((w) => ({ s: Math.max(0, w.s - s), e: Math.max(0, Math.min(w.e, e) - s), w: w.w }));
}

/**
 * Where the open timeline plays the file's moment `src` (ms) — the clip of that file that holds it (the main track
 * first), through its own time mapping (speed curves followed) — or null when it isn't on the timeline.
 */
export function whereOnTimeline(tl: Timeline, assetId: string, src: number): number | null {
  const tracks = [...tl.tracks].sort((x, y) => (x.kind === "video" ? 0 : 1) - (y.kind === "video" ? 0 : 1));
  for (const t of tracks) {
    if (t.kind === "text") continue;
    for (const c of t.clips) if (c.assetId === assetId && !c.seq && src >= c.in && src < c.out) return Math.round(timelineTime(c, src));
  }
  return null;
}
