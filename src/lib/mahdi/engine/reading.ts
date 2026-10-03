// «القارئ العلوي»: pages, progress, time and goals of reading. Pure functions (no React, no database).
// A book is counted in pages, or (for books of narrations such as al-Kafi) in narrations: the same numbering rules
// apply to both, so "pages" below means "units of the book" unless a function says otherwise.
import { addDays, startOfMonth, startOfWeek, type ISODate } from "./dates";

/** Pages read, as inclusive ranges: [[1, 12], [30, 30]]. */
export type PageRange = [number, number];

/** How a book is counted: pages, or numbered narrations (روايات). */
export type BookUnit = "page" | "narration";

export interface ReadingSession {
  id: string;
  bookId: string;
  /** The unit of the session's book. */
  unit: BookUnit;
  /** The day it counts for (the user's own calendar). */
  date: ISODate;
  /** 0 for pages added by hand without the timer. */
  seconds: number;
  ranges: PageRange[];
  /** Distinct pages (or narrations, for a book of narrations) in this session. */
  pages: number;
  note: string;
}

export type ReadingMetric = "minutes" | "pages" | "narrations";

export interface ReadingGoals {
  daily: { metric: ReadingMetric; target: number } | null;
  weekly: { metric: ReadingMetric; target: number } | null;
  /** A habit filled automatically after each session. */
  habitId: string | null;
  habitMetric: ReadingMetric;
}

/** Sorts, clamps to 1…maxPage and merges touching or overlapping ranges. Invalid ones are dropped. */
export function mergeRanges(ranges: readonly (readonly number[])[], maxPage = Infinity): PageRange[] {
  const clean = ranges
    .filter((r) => Array.isArray(r) && r.length === 2 && Number.isInteger(r[0]) && Number.isInteger(r[1]))
    .map(([a, b]) => [Math.max(1, Math.min(a, b)), Math.min(maxPage, Math.max(a, b))] as PageRange)
    .filter(([a, b]) => a <= b)
    .sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  const out: PageRange[] = [];
  for (const r of clean) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1] + 1) last[1] = Math.max(last[1], r[1]);
    else out.push([r[0], r[1]]);
  }
  return out;
}

/** How many distinct pages the ranges cover. */
export const countPages = (ranges: readonly PageRange[]) => mergeRanges(ranges).reduce((n, [a, b]) => n + b - a + 1, 0);

const toLatinDigits = (s: string) =>
  s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0));

/**
 * Reads pages typed by hand: «15-20، 33, 40 - 42» → [[15,20],[33,33],[40,42]].
 * Accepts Arabic digits, Arabic commas and dashes. Returns null if something cannot be understood.
 */
export function parsePagesInput(text: string, maxPage = Infinity): PageRange[] | null {
  const s = toLatinDigits(text).replace(/[–—−]/g, "-").replace(/إلى|الى/g, "-").replace(/\s*-\s*/g, "-").trim();
  if (!s) return [];
  const parts = s.split(/[,،؛;\s]+/).filter(Boolean);
  const out: PageRange[] = [];
  for (const p of parts) {
    const m = /^(\d{1,5})(?:-(\d{1,5}))?$/.exec(p);
    if (!m) return null;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    if (a < 1 || b < 1 || Math.max(a, b) > maxPage) return null;
    out.push([Math.min(a, b), Math.max(a, b)]);
  }
  return mergeRanges(out, maxPage);
}

/** «1–12، 30» */
export const formatRanges = (ranges: readonly PageRange[]) => mergeRanges(ranges).map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join("، ");

export interface BookProgress {
  readPages: number;
  totalPages: number;
  /** 0…1 */
  share: number;
  ranges: PageRange[];
  seconds: number;
  /** Pages per hour over timed sessions, or null without enough data. */
  pagesPerHour: number | null;
  /** Estimated seconds to read the remaining pages, or null. */
  secondsLeft: number | null;
  /** The first page not read yet (where to continue), or null when all pages are read. */
  nextPage: number | null;
}

/** Progress in one book from all its sessions. Pages read twice count once. */
export function bookProgress(sessions: readonly ReadingSession[], totalPages: number): BookProgress {
  const ranges = mergeRanges(sessions.flatMap((s) => s.ranges), totalPages);
  const readPages = countPages(ranges);
  const timed = sessions.filter((s) => s.seconds >= 60 && s.pages > 0);
  const secs = timed.reduce((n, s) => n + s.seconds, 0);
  const pgs = timed.reduce((n, s) => n + s.pages, 0);
  const pagesPerHour = secs >= 600 && pgs >= 3 ? (pgs / secs) * 3600 : null;
  const left = totalPages - readPages;
  let nextPage: number | null = null;
  for (let p = 1, i = 0; p <= totalPages; ) {
    const r = ranges[i];
    if (r && p >= r[0]) {
      p = r[1] + 1;
      i++;
    } else {
      nextPage = p;
      break;
    }
  }
  return {
    readPages,
    totalPages,
    share: totalPages > 0 ? readPages / totalPages : 0,
    ranges,
    seconds: sessions.reduce((n, s) => n + s.seconds, 0),
    pagesPerHour,
    secondsLeft: pagesPerHour && left > 0 ? Math.round((left / pagesPerHour) * 3600) : null,
    nextPage,
  };
}

export interface ReadingTotals {
  seconds: number;
  /** Pages read in books counted by pages. */
  pages: number;
  /** Narrations read in books counted by narrations. */
  narrations: number;
  sessions: number;
}

const add = (t: ReadingTotals, s: ReadingSession): ReadingTotals => ({
  seconds: t.seconds + s.seconds,
  pages: t.pages + (s.unit === "narration" ? 0 : s.pages),
  narrations: t.narrations + (s.unit === "narration" ? s.pages : 0),
  sessions: t.sessions + 1,
});
const ZERO: ReadingTotals = { seconds: 0, pages: 0, narrations: 0, sessions: 0 };

/** Totals of the sessions between two days (inclusive). */
export function readingTotals(sessions: readonly ReadingSession[], from: ISODate, to: ISODate): ReadingTotals {
  return sessions.filter((s) => s.date >= from && s.date <= to).reduce(add, ZERO);
}

export interface ReadingSummary {
  today: ReadingTotals;
  week: ReadingTotals;
  month: ReadingTotals;
  /** Consecutive days with reading, ending today (or yesterday, if today has nothing yet). */
  streak: number;
  /** The last 7 days, oldest first. */
  last7: { date: ISODate; seconds: number; pages: number; narrations: number }[];
}

export function readingSummary(sessions: readonly ReadingSession[], today: ISODate, weekStart: number): ReadingSummary {
  const days = new Set(sessions.filter((s) => s.seconds > 0 || s.pages > 0).map((s) => s.date));
  let streak = 0;
  let d = days.has(today) ? today : addDays(today, -1);
  while (days.has(d)) {
    streak++;
    d = addDays(d, -1);
  }
  return {
    today: readingTotals(sessions, today, today),
    week: readingTotals(sessions, startOfWeek(today, weekStart), today),
    month: readingTotals(sessions, startOfMonth(today), today),
    streak,
    last7: Array.from({ length: 7 }, (_, k) => {
      const date = addDays(today, k - 6);
      const t = readingTotals(sessions, date, date);
      return { date, seconds: t.seconds, pages: t.pages, narrations: t.narrations };
    }),
  };
}

/** Progress towards a goal: the amount done (minutes, pages or narrations) and the share 0…1 (capped). */
export function goalProgress(goal: { metric: ReadingMetric; target: number } | null, t: ReadingTotals) {
  if (!goal) return null;
  const done = goal.metric === "minutes" ? Math.floor(t.seconds / 60) : goal.metric === "narrations" ? t.narrations : t.pages;
  return { done, target: goal.target, share: Math.min(1, done / goal.target), metric: goal.metric };
}

/** What a session adds to the linked habit: minutes, or the pages / narrations read (only from books counted that way). */
export function habitDelta(metric: ReadingMetric, seconds: number, count: number, unit: BookUnit): number {
  if (metric === "minutes") return Math.floor(seconds / 60);
  return (metric === "narrations") === (unit === "narration") ? count : 0;
}

/**
 * Arabic-aware search key: diacritics and tatweel removed, alef forms → ا, ة → ه, ى → ي, spaces collapsed, lowercase.
 * «الكافي» and «الكافِى» find each other.
 */
export function normalizeTitle(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase()
    .slice(0, 200);
}

/** Usernames: lowercase Latin letters, digits and _, 3–20 characters, starting with a letter. */
export const USERNAME_RE = /^[a-z][a-z0-9_]{2,19}$/;
export const cleanUsername = (s: string) => s.trim().replace(/^@/, "").toLowerCase();
