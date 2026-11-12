// «حيدرة كت» — «النص» (editing from the transcript, the Descript way). Pure (browser and server). A file's words are
// kept in its own time (source ms, ElevenLabs Scribe, see speech.ts); the reading order is worked out from the
// timeline every time — each heard clip shows the words of its part of the file, at their place on the timeline — so it
// follows every cut, move and speed. Words chosen in the text become timeline spans cut out of every track
// (remove_ranges), one undo.

import { clipEnd, timelineTime, type Clip, type Timeline, type Track } from "./model";
import type { Timed } from "./ramp";

/** One spoken word of a file: from `s` to `e` (source ms). */
export interface TWord {
  s: number;
  e: number;
  w: string;
}

/** What is known of a file's speech: its words (sorted, no two overlapping) and the source spans that were listened to. */
export interface AssetSpeech {
  words: TWord[];
  spans: [number, number][];
}

/**
 * A word in the reading order. `clipId` null = a word cut out in this session («مشطوبة»): shown struck through where it
 * was, until an undo brings it back. `from`/`to` are timeline ms (a struck word: the place it was cut, from = to).
 */
export interface Line {
  key: string;
  assetId: string;
  /** its index in the file's words */
  i: number;
  w: string;
  s: number;
  e: number;
  clipId: string | null;
  trackId: string | null;
  from: number;
  to: number;
}

/** The key that names a file's word across edits (the file and the word's start). */
export const wordKey = (assetId: string, s: number) => `${assetId}:${Math.round(s)}`;

/** Where on the timeline a clip plays its source moment `src` (ms): the other way of `sourceTime`, speed curves included. */
export const timelineAt = (c: Timed, src: number) => timelineTime(c, src);

// ───────────────────────────── kept transcripts ─────────────────────────────

/**
 * Several transcripts of one file (each of a part of it, in any language) as one list of words: the longest ones
 * first win where two disagree, so a word is never written twice. `key` is how speech.ts keeps them: "from-to-lang".
 */
export function mergeTranscripts(kept: Record<string, TWord[]> | null | undefined): AssetSpeech {
  const list = Object.entries(kept ?? {})
    .filter(([, ws]) => Array.isArray(ws))
    .sort((a, b) => b[1].length - a[1].length);
  const spans: [number, number][] = [];
  const all: (TWord & { p: number })[] = [];
  list.forEach(([key, ws], p) => {
    const m = /^(\d+)-(\d+)-/.exec(key);
    if (m) spans.push([Number(m[1]), Number(m[2])]);
    for (const w of ws) {
      if (!w || typeof w.w !== "string" || !Number.isFinite(w.s) || !Number.isFinite(w.e)) continue;
      const word = w.w.trim();
      if (!word) continue;
      all.push({ s: Math.round(w.s), e: Math.round(Math.max(w.s, w.e)), w: word, p });
    }
  });
  all.sort((a, b) => a.s - b.s || a.p - b.p);
  const out: (TWord & { p: number })[] = [];
  for (const w of all) {
    const last = out[out.length - 1];
    // two words over the same moment: the one from the longer transcript stays
    if (last && w.s < last.e - 20) {
      if (w.p < last.p) out[out.length - 1] = w;
      continue;
    }
    out.push(w);
  }
  return { words: out.map(({ s, e, w }) => ({ s, e, w })), spans: mergeSpans(spans) };
}

function mergeSpans(spans: [number, number][]): [number, number][] {
  const sorted = spans.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out: [number, number][] = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a <= last[1] + 50) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

/** How much of a clip's part of its file (in → out) was listened to already, 0–1. */
export function covered(spans: [number, number][], from: number, to: number) {
  if (!(to > from)) return 1;
  let got = 0;
  for (const [a, b] of mergeSpans(spans)) got += Math.max(0, Math.min(b, to) - Math.max(a, from));
  return Math.min(1, got / (to - from));
}

/** A clip whose part still needs listening to (less than 90 % of it has words on record). */
export const needsListening = (spans: [number, number][] | undefined, c: Pick<Clip, "in" | "out">) => covered(spans ?? [], c.in, c.out) < 0.9;

// ───────────────────────────── the reading order ─────────────────────────────

/** The clips the transcript reads from: heard sound (not a text, not a muted track, not quiet, not the yellow track). */
export function heardClips(tl: Timeline): { track: Track; clip: Clip }[] {
  const out: { track: Track; clip: Clip }[] = [];
  for (const track of tl.tracks) {
    if (track.kind === "text" || track.muted || track.role === "cont") continue;
    for (const clip of track.clips) if (clip.assetId && !clip.seq && clip.volume > 0) out.push({ track, clip });
  }
  return out;
}

/**
 * The words said on the timeline, in the order they are heard: each heard clip shows the words of its part of the file
 * (a word belongs to the clip that holds its middle). The same word heard twice at the same moment (a video and its
 * sound on its own track) is listed once. Words in `struck` that are no longer heard come back as struck words, each
 * where it was: after the file's last word still heard before it.
 */
export function readingOrder(tl: Timeline, speech: Record<string, AssetSpeech | undefined>, struck: ReadonlySet<string> = new Set()): Line[] {
  const live: Line[] = [];
  for (const { track, clip } of heardClips(tl)) {
    const words = speech[clip.assetId!]?.words;
    if (!words?.length) continue;
    const end = clipEnd(clip);
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const mid = (w.s + w.e) / 2;
      if (mid < clip.in || mid >= clip.out) continue;
      const from = Math.max(clip.start, Math.round(timelineAt(clip, Math.max(w.s, clip.in))));
      const to = Math.min(end, Math.round(timelineAt(clip, Math.min(w.e, clip.out))));
      live.push({ key: wordKey(clip.assetId!, w.s), assetId: clip.assetId!, i, w: w.w, s: w.s, e: w.e, clipId: clip.id, trackId: track.id, from, to: Math.max(from, to) });
    }
  }
  live.sort((a, b) => a.from - b.from || a.to - b.to);
  // the same word twice at one moment: once
  const heard: Line[] = [];
  for (const l of live) {
    if (heard.some((h) => h.key === l.key && Math.abs(h.from - l.from) < 150)) continue;
    heard.push(l);
  }
  const shown = new Set(heard.map((l) => l.key));
  const gone = [...struck].filter((k) => !shown.has(k));
  if (!gone.length) return heard;
  // the struck words of each file, by their index there
  const byAsset = new Map<string, Line[]>();
  for (const k of gone) {
    const cut = k.lastIndexOf(":");
    const assetId = k.slice(0, cut);
    const s = Number(k.slice(cut + 1));
    const words = speech[assetId]?.words ?? [];
    const i = words.findIndex((w) => Math.round(w.s) === s);
    if (i < 0) continue;
    const list = byAsset.get(assetId) ?? [];
    list.push({ key: k, assetId, i, w: words[i].w, s: words[i].s, e: words[i].e, clipId: null, trackId: null, from: 0, to: 0 });
    byAsset.set(assetId, list);
  }
  for (const list of byAsset.values()) list.sort((a, b) => a.i - b.i);
  const out: Line[] = [];
  const put = (assetId: string, below: number, at: number) => {
    const list = byAsset.get(assetId);
    while (list?.length && list[0].i < below) out.push({ ...list.shift()!, from: at, to: at });
  };
  for (const l of heard) {
    put(l.assetId, l.i, l.from);
    out.push(l);
  }
  // what is left was after the last word still heard
  const endAt = heard.length ? heard[heard.length - 1].to : 0;
  for (const assetId of byAsset.keys()) put(assetId, Infinity, endAt);
  return out;
}

/**
 * The word heard at timeline `ms` (its index in `lines`), or −1; between words the last one said stays lit for a
 * moment. (Every line's `from` rises along the reading order, the struck ones included.)
 */
export function lineAt(lines: Line[], ms: number) {
  let lo = 0;
  let hi = lines.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].from <= ms) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  while (found >= 0 && !lines[found].clipId) found--;
  if (found < 0) return -1;
  return ms < lines[found].to + 250 ? found : -1;
}

/** The trailing pause taken with the last word of a cut (its breath), at most this much. */
export const TAIL_MS = 250;

/**
 * The chosen words as timeline spans to cut: words next to each other in the reading order make one span (the pauses
 * between them go too), and each span takes up to TAIL_MS of the pause after it when the next word is in the same
 * clip. Spans that touch are merged. Struck words are ignored.
 */
export function rangesFor(lines: Line[], chosen: ReadonlySet<string>): [number, number][] {
  const live = lines.filter((l) => l.clipId);
  const runs: [number, number][] = [];
  let i = 0;
  while (i < live.length) {
    if (!chosen.has(live[i].key)) {
      i++;
      continue;
    }
    const first = live[i];
    let last = first;
    let j = i + 1;
    while (j < live.length && chosen.has(live[j].key)) last = live[j++];
    const next = live[j];
    const gap = next && next.clipId === last.clipId ? Math.max(0, next.from - last.to) : 0;
    runs.push([first.from, last.to + Math.min(gap, TAIL_MS)]);
    i = j;
  }
  runs.sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const r of runs) {
    if (r[1] <= r[0]) continue;
    const last = out[out.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else out.push([r[0], r[1]]);
  }
  return out;
}

/** The words between two chosen in the reading order (both included), for a shift-click or a drag. */
export function keysBetween(lines: Line[], a: string, b: string): string[] {
  const i = lines.findIndex((l) => l.key === a);
  const j = lines.findIndex((l) => l.key === b);
  if (i < 0 || j < 0) return [];
  const [lo, hi] = i <= j ? [i, j] : [j, i];
  return lines.slice(lo, hi + 1).filter((l) => l.clipId).map((l) => l.key);
}

// ───────────────────────────── «شيل الحشو» ─────────────────────────────

/** A word as it is compared: no diacritics, tatweel or punctuation, alef forms as one, lower case. */
export function plain(w: string) {
  return w
    .normalize("NFKC")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .toLowerCase();
}

/**
 * Hesitation sounds that are never real words: «اممم» «ممم» «آآ» «ااا» «آآه» and um / uh / erm / hmm. Two meems only
 * with a plain alef («امم»): «أمم» (nations) and «مم» are words.
 */
const HESITATION = [/^ا?م{3,}$/, /^ا{2,}[هح]?$/, /^ء{2,}$/, /^u+m+$/, /^u+h+m*$/, /^e+r+m+$/, /^h+m+$/, /^m{2,}$/];
const SHORT_UMM = /^[اإآ]مم$/;
/** Words that are filler only when said on their own (a pause or a comma on both sides). */
const ALONE = new Set(["يعني"]);
/** A pause this long (ms) counts as a break around a word. */
const PAUSE_MS = 300;
const ENDS = /[.,!?؟،؛;:…]$/;

/**
 * Is this word a filler? A hesitation sound always is; «يعني» only when it stands alone — a pause (or punctuation)
 * before and after it, or said twice in a row («يعني يعني»: the first).
 */
export function isFiller(word: TWord, prev: TWord | null, next: TWord | null) {
  const p = plain(word.w);
  if (!p) return false;
  if (HESITATION.some((r) => r.test(p))) return true;
  if (SHORT_UMM.test(word.w.replace(/[\u064B-\u065F\u0670\u0640]/g, "").replace(/[^\p{L}]/gu, ""))) return true;
  if (!ALONE.has(p)) return false;
  if (next && plain(next.w) === p && next.s - word.e < PAUSE_MS) return true;
  const before = !prev || word.s - prev.e >= PAUSE_MS || ENDS.test(prev.w.trim());
  const after = !next || next.s - word.e >= PAUSE_MS || ENDS.test(word.w.trim());
  return before && after;
}

/** The filler words of the reading order (their keys), to review before they are cut. */
export function fillers(lines: Line[]): string[] {
  const live = lines.filter((l) => l.clipId);
  const out: string[] = [];
  live.forEach((l, i) => {
    // neighbours count only when they are next to it on the timeline (the same clip)
    const prev = i > 0 && live[i - 1].clipId === l.clipId ? { s: live[i - 1].from, e: live[i - 1].to, w: live[i - 1].w } : null;
    const next = i + 1 < live.length && live[i + 1].clipId === l.clipId ? { s: live[i + 1].from, e: live[i + 1].to, w: live[i + 1].w } : null;
    if (isFiller({ s: l.from, e: l.to, w: l.w }, prev, next)) out.push(l.key);
  });
  return out;
}

/** The words as paragraphs: a new one after a long pause or where another clip starts. */
export function paragraphs(lines: Line[], pauseMs = 1200): Line[][] {
  const out: Line[][] = [];
  let cur: Line[] = [];
  let prev: Line | null = null;
  for (const l of lines) {
    if (prev && l.clipId && prev.clipId && (l.clipId !== prev.clipId || l.from - prev.to >= pauseMs)) {
      out.push(cur);
      cur = [];
    }
    cur.push(l);
    if (l.clipId) prev = l;
  }
  if (cur.length) out.push(cur);
  return out;
}
