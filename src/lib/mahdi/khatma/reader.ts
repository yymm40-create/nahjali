// «الختمة العلوية» · the reader: where the person is in the Quran (the stretch they have finished, the page they free-read),
// and the time they spend reading, counted on a clock at the top of the reader and added to a habit if they link one. Pure.

import { portionSpan, portionVerses, verseIndex, type Division, type PortionRange, type VerseRef } from "./portions";

/** The pace of the clock's reports and the most a report may carry (a sleeping tab woken up does not count its sleep). */
export const CLOCK = { reportEvery: 20, maxPerReport: 120, maxPerDay: 86_400 } as const;

/** «٠٤:١٢» / «١:٠٤:١٢» */
export function clockText(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const two = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${two(m)}:${two(s % 60)}` : `${two(m)}:${two(s % 60)}`;
}

/** Whole minutes in some seconds (what a habit is credited). */
export const wholeMinutes = (seconds: number) => Math.floor(Math.max(0, seconds) / 60);

/** «١٢ دقيقة» · «ساعة و٥ دقائق» in digits readers use. */
export function minutesText(minutes: number): string {
  const m = Math.max(0, Math.floor(minutes));
  if (m < 60) return `${m} دقيقة`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} ساعة و${r} دقيقة` : `${h} ساعة`;
}

/** A habit that reading time can fill: an amount (minutes, or hours) or a done / not done one. */
export const isTimeHabit = (measure: "check" | "count" | "amount") => measure === "amount" || measure === "check";

/** What some minutes are in a habit's own unit: «ساعة» takes them as a fraction of an hour; anything else as minutes. */
export function minutesInUnit(unit: string, minutes: number): number {
  return /ساع|hour|\bh\b/i.test(unit) ? Math.round((minutes / 60) * 100) / 100 : minutes;
}

/**
 * A habit's new value for a day when `minutes` of reading are added: an amount grows by them (in its unit), a done / not
 * done habit becomes done. `current` is its value now.
 */
export function habitAfterReading(measure: "check" | "count" | "amount", unit: string, current: number, minutes: number): number {
  if (minutes <= 0) return current;
  if (measure === "check") return 1;
  if (measure === "amount") return Math.round((current + minutesInUnit(unit, minutes)) * 100) / 100;
  return current;
}

/** The page (1–604) a verse is on. */
export function pageOfVerse(v: VerseRef): number {
  const i = verseIndex(v);
  let lo = 1;
  let hi = 604;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (portionSpan("page", mid).fromV <= i) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** The first page of a portion of any division. */
export const firstPage = (d: Division, n: number) => (d === "page" ? n : pageOfVerse(portionVerses(d, n).from));

/** The portions of a stretch before `n` (where the person says they have reached): all of them are already read. */
export function portionsBefore(range: PortionRange, n: number): number[] {
  const out: number[] = [];
  for (let k = range.from; k < Math.min(n, range.to + 1); k++) out.push(k);
  return out;
}

/** The ones among `portions` not read yet. */
export const unreadOf = (portions: number[], read: ReadonlySet<number>) => portions.filter((n) => !read.has(n));
