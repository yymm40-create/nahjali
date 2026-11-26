// «أيام العذر والقضاء» (owner-approved, 26 November 2026): habits without guilt. Up to two excuse days a week (travel, illness, the
// shar'i excuse) and a pause of up to 14 days never break the day streak; a day that just went by is not a red mark but a soft
// orange one that can be made up later as «قضاء» from the day's page. Pure functions.
import { addDays, diffDays, startOfWeek, type ISODate } from "./dates";
import { dayScore } from "./score";
import type { Timeline } from "./schedule";

/** Why a day is excused: travel, illness, the shar'i excuse, or a day of a pause. */
export type ExcuseKind = "travel" | "illness" | "shari" | "pause";
/** What a day can be marked with: one of the excuses, or «قضاء» (a missed day the person made up later). */
export type DayMarkKind = ExcuseKind | "qada";

export interface DayMark {
  day: ISODate;
  kind: DayMarkKind;
}

export const EXCUSE_KINDS: readonly Exclude<ExcuseKind, "pause">[] = ["travel", "illness", "shari"];
export const DAY_MARK_KINDS: readonly DayMarkKind[] = [...EXCUSE_KINDS, "pause", "qada"];
/** Excuse days in one week (travel, illness, the shar'i excuse; a pause has its own limit). */
export const EXCUSES_PER_WEEK = 2;
/** The longest pause, in days. */
export const PAUSE_MAX_DAYS = 14;
/** How far back a day can be excused or made up (the same window the logs can be corrected in). */
export const MARK_BACK_DAYS = 30;

export const isDayMarkKind = (k: unknown): k is DayMarkKind => typeof k === "string" && (DAY_MARK_KINDS as readonly string[]).includes(k);
export const isExcuse = (k: DayMarkKind): k is ExcuseKind => k !== "qada";

/** The marks read safely: known kinds only, one per day (the last one wins), oldest first. */
export function cleanMarks(raw: unknown): DayMark[] {
  if (!Array.isArray(raw)) return [];
  const byDay = new Map<ISODate, DayMarkKind>();
  for (const x of raw) {
    const m = (x ?? {}) as Partial<DayMark>;
    if (typeof m.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(m.day) && isDayMarkKind(m.kind)) byDay.set(m.day, m.kind);
  }
  return [...byDay].sort(([a], [b]) => (a < b ? -1 : 1)).map(([day, kind]) => ({ day, kind }));
}

/** The days that do not break (nor count in) the day streak. */
export const excusedDays = (marks: readonly DayMark[]): Set<ISODate> => new Set(marks.filter((m) => isExcuse(m.kind)).map((m) => m.day));

export const markOn = (marks: readonly DayMark[], day: ISODate): DayMarkKind | null => marks.find((m) => m.day === day)?.kind ?? null;

/** Excuse days (not pause days) already taken in the week of `day`, leaving `day` itself out. */
export function excusesInWeek(marks: readonly DayMark[], day: ISODate, weekStart: number): number {
  const ws = startOfWeek(day, weekStart);
  const we = addDays(ws, 6);
  return marks.filter((m) => m.day !== day && m.day >= ws && m.day <= we && m.kind !== "pause" && m.kind !== "qada").length;
}

/** How many excuse days are left in the week of `day` (for the sheet: «باقي لك يوم عذر واحد هالأسبوع»). */
export const excusesLeft = (marks: readonly DayMark[], day: ISODate, weekStart: number) => Math.max(0, EXCUSES_PER_WEEK - excusesInWeek(marks, day, weekStart));

export type MarkCheck = { ok: true } | { ok: false; reason: "future" | "tooOld" | "weekFull" | "pauseLong" | "notMissed" };

/**
 * Whether `kind` can be put on `day` (today being `today`): never on a future day nor further back than a month; at most two excuse days
 * a week; «قضاء» only on a day that already went by.
 */
export function canMark(marks: readonly DayMark[], day: ISODate, kind: DayMarkKind, today: ISODate, weekStart: number): MarkCheck {
  if (day > today) return { ok: false, reason: "future" };
  if (diffDays(today, day) > MARK_BACK_DAYS) return { ok: false, reason: "tooOld" };
  if (kind === "qada") return day < today ? { ok: true } : { ok: false, reason: "notMissed" };
  if (kind !== "pause" && excusesInWeek(marks, day, weekStart) >= EXCUSES_PER_WEEK) return { ok: false, reason: "weekFull" };
  return { ok: true };
}

/** The days of a pause that starts on `from` and lasts `days` days (1 … 14). Null when the length is out of range. */
export function pauseDays(from: ISODate, days: number): ISODate[] | null {
  if (!Number.isInteger(days) || days < 1 || days > PAUSE_MAX_DAYS) return null;
  return Array.from({ length: days }, (_, k) => addDays(from, k));
}

/** The pause that covers `day` (its first and last day), or null. Consecutive «pause» days make one pause. */
export function pauseAround(marks: readonly DayMark[], day: ISODate): { from: ISODate; to: ISODate } | null {
  const paused = new Set(marks.filter((m) => m.kind === "pause").map((m) => m.day));
  if (!paused.has(day)) return null;
  let from = day;
  let to = day;
  while (paused.has(addDays(from, -1))) from = addDays(from, -1);
  while (paused.has(addDays(to, 1))) to = addDays(to, 1);
  return { from, to };
}

/**
 * How a day is drawn:
 * - `future` not yet; `none` nothing was due;
 * - `done` the day's goals reached (`qada` when they were made up later);
 * - `excused` an excuse or a pause and not reached (soft, never a failure);
 * - `open` today, still going;
 * - `missed` gone by without reaching them: soft orange, never red, and it can still be made up.
 */
export type DayState = "future" | "none" | "done" | "qada" | "excused" | "open" | "missed";

export function dayState(tl: Timeline, d: ISODate, threshold: number, marks: readonly DayMark[]): DayState {
  if (d > tl.ctx.asOf) return "future";
  const kind = markOn(marks, d);
  const s = dayScore(tl, d).score;
  if (s === null) return kind && isExcuse(kind) ? "excused" : "none";
  if (s >= threshold) return kind === "qada" ? "qada" : "done";
  if (kind && isExcuse(kind)) return "excused";
  return d === tl.ctx.asOf ? "open" : "missed";
}

/** The missed days in the last `back` days before today (newest first), for «عندك أيام تقضيها». */
export function missedDays(tl: Timeline, threshold: number, marks: readonly DayMark[], back = 7): ISODate[] {
  const out: ISODate[] = [];
  for (let k = 1; k <= back; k++) {
    const d = addDays(tl.ctx.asOf, -k);
    if (d < tl.from) break;
    if (dayState(tl, d, threshold, marks) === "missed") out.push(d);
  }
  return out;
}
