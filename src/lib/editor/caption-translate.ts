// «ترجم الكابشن» — the pure part (page, server and tests): which languages, how a caption track becomes lines to
// translate, how the translation comes back as a NEW caption track on the very same times (each line keeps its start
// and end; a line's word timing is spread over its translated words), and how many units it is priced by.

import type { CaptionStyle, Timeline, Word } from "./model";

/** The languages a caption can be translated into (the first two are the usual pair). */
export const TRANSLATE_LANGS = [
  { id: "en", label: "English", name: "English" },
  { id: "ar", label: "العربية", name: "Arabic (Modern Standard, plain and natural)" },
  { id: "fr", label: "Français", name: "French" },
  { id: "es", label: "Español", name: "Spanish" },
  { id: "tr", label: "Türkçe", name: "Turkish" },
  { id: "ur", label: "اردو", name: "Urdu" },
  { id: "fa", label: "فارسی", name: "Persian (Farsi)" },
  { id: "id", label: "Bahasa Indonesia", name: "Indonesian" },
  { id: "de", label: "Deutsch", name: "German" },
] as const;
export type TranslateLang = (typeof TRANSLATE_LANGS)[number]["id"];
export const isTranslateLang = (v: unknown): v is TranslateLang => TRANSLATE_LANGS.some((l) => l.id === v);
export const langOf = (id: TranslateLang) => TRANSLATE_LANGS.find((l) => l.id === id)!;

/** Lines priced together (the price is per started block of this many). */
export const TRANSLATE_BLOCK = 50;
/** The most lines one translation takes (a long film's captions: a few thousand). */
export const TRANSLATE_MAX = 3000;
/** One line's longest text. */
export const TRANSLATE_LINE_MAX = 500;
export const translateUnits = (lines: number) => Math.max(1, Math.ceil(lines / TRANSLATE_BLOCK));

/** One caption line as it goes to the translator and comes back: its times stay as they were. */
export interface CaptionLine {
  start: number;
  end: number;
  body: string;
  words?: Word[];
}

/** The caption tracks of a timeline (text tracks with at least one line, not the motion track). */
export const captionTracks = (tl: Timeline) => tl.tracks.filter((t) => t.kind === "text" && !t.motion && t.clips.some((c) => c.text?.body.trim()));

/** A caption track's lines, in order. */
export function captionLines(tl: Timeline, trackId: string): CaptionLine[] {
  const tr = tl.tracks.find((t) => t.id === trackId);
  if (!tr) return [];
  return tr.clips
    .filter((c) => c.text?.body.trim())
    .sort((a, b) => a.start - b.start)
    .slice(0, TRANSLATE_MAX)
    .map((c) => ({ start: c.start, end: c.start + Math.round((c.out - c.in) / (c.speed || 1)), body: c.text!.body.trim().slice(0, TRANSLATE_LINE_MAX), ...(c.words.length ? { words: c.words } : {}) }));
}

/**
 * The words of a translated line timed inside its line: the original's spoken span (first word's start → last word's
 * end) shared by the new words in proportion to their length, so a «word by word» caption still lights in time with
 * the voice. No timing in the original: none here either.
 */
export function spreadWords(text: string, words: Word[] | undefined, len: number): Word[] {
  const toks = text.split(/\s+/).filter(Boolean);
  if (!words?.length || !toks.length) return [];
  const from = Math.max(0, Math.min(...words.map((w) => w.s)));
  const to = Math.min(len, Math.max(...words.map((w) => w.e)));
  const span = Math.max(toks.length, to - from);
  const weight = toks.map((t) => Math.max(1, [...t].length));
  const total = weight.reduce((a, b) => a + b, 0);
  let at = from;
  return toks.map((w, i) => {
    const s = Math.round(at);
    at += (span * weight[i]) / total;
    return { s, e: Math.max(s + 1, Math.round(i === toks.length - 1 ? from + span : at)), w: w.slice(0, 60) };
  });
}

/**
 * The translated track's lines: one for one with the original's (the same count, the same start and end), the text
 * the translation's and its words spread on the original's timing. A line the translator left empty keeps the
 * original text (nothing goes missing from the video).
 */
export function translatedLines(lines: CaptionLine[], texts: string[]): CaptionLine[] {
  return lines.map((l, i) => {
    const body = (texts[i] ?? "").replace(/\s+/g, " ").trim().slice(0, TRANSLATE_LINE_MAX) || l.body;
    const words = spreadWords(body, l.words, l.end - l.start);
    return { start: l.start, end: l.end, body, ...(words.length ? { words } : {}) };
  });
}

/** The look a translated track takes: the original's style when it is word-lit, else the plain subtitle look. */
export const translatedStyle = (lines: CaptionLine[]): CaptionStyle => (lines.some((l) => l.words?.length) ? "karaoke" : "classic");

/** Lines received from the page, made safe (times whole and in order, texts short); null when unusable. */
export function readLines(v: unknown): CaptionLine[] | null {
  if (!Array.isArray(v) || !v.length || v.length > TRANSLATE_MAX) return null;
  const out: CaptionLine[] = [];
  for (const x of v) {
    if (!x || typeof x !== "object") return null;
    const o = x as Record<string, unknown>;
    const start = Math.round(Number(o.start));
    const end = Math.round(Number(o.end));
    const body = typeof o.body === "string" ? o.body.trim().slice(0, TRANSLATE_LINE_MAX) : "";
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || !body) return null;
    out.push({ start, end, body });
  }
  return out;
}
