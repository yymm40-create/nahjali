// «الختمة العلوية» · «ختمتي»: a person's own khatma — the whole Quran or a stretch of it (pages, juz, hizb, half or
// quarter hizb), read portion by portion at their own pace. Where they are, what today's portion is, whether they are on
// time, and what a portion adds to the habit linked to it. Pure.

import { addDays, diffDays, type ISODate } from "../engine/dates";
import { amountText, fullRange, inRange, rangeSize, type Division, type PortionRange } from "./portions";

export const QUARTERS = 240;

/** Portions a day to read `total` of them in `days` days. */
export const dailyCount = (total: number, days: number) => Math.ceil(total / Math.max(1, days));

/** Quarters a day to finish the whole Quran in `days` days. */
export const dailyQuarters = (days: number) => dailyCount(QUARTERS, days);

/** A number of quarters as readers say it: «جزء»، «حزبان»، «نصف حزب»، «٣ أرباع». */
export function quartersText(q: number): string {
  if (q >= 8 && q % 8 === 0) return q === 8 ? "جزء" : q === 16 ? "جزءان" : `${q / 8} أجزاء`;
  if (q >= 4 && q % 4 === 0) return q === 4 ? "حزب" : q === 8 ? "حزبان" : `${q / 4} أحزاب`;
  if (q === 2) return "نصف حزب";
  if (q === 1) return "ربع حزب";
  return `${q} أرباع`;
}

/** A number of portions of a division, as readers say it (quarters become juz and hizb when they fit). */
export const unitText = (unit: Division, n: number) => (unit === "quarter" ? quartersText(n) : amountText(unit, n));

/** The juz a quarter is in (1–30). */
export const juzOf = (q: number) => Math.ceil(q / 8);

/** Where to go on: the first unread portion after the furthest one read; else the first unread; null when all are read. */
export function nextPortion(read: Iterable<number>, range: PortionRange): number | null {
  const set = new Set([...read].filter((n) => inRange(range, n)));
  const furthest = Math.max(range.from - 1, ...set);
  for (let n = furthest + 1; n <= range.to; n++) if (!set.has(n)) return n;
  for (let n = range.from; n <= range.to; n++) if (!set.has(n)) return n;
  return null;
}

/** The same for the whole Quran in quarters. */
export const nextQuarter = (read: Iterable<number>) => nextPortion(read, fullRange("quarter"));

export interface MyRead {
  quarter: number;
  readOn: ISODate;
}

/** How the khatma stands today (`reads[].quarter` is the portion number in the khatma's division). */
export function khatmaStats(reads: MyRead[], startedOn: ISODate, days: number, today: ISODate, range: PortionRange = fullRange("quarter")) {
  const inside = reads.filter((r) => inRange(range, r.quarter));
  const total = rangeSize(range);
  const perDay = dailyCount(total, days);
  const read = new Set(inside.map((r) => r.quarter)).size;
  const dayNo = Math.max(1, diffDays(today, startedOn) + 1);
  const todayCount = inside.filter((r) => r.readOn === today).length;
  // where the plan expects them to be by the end of today
  const expected = Math.min(total, perDay * dayNo);
  const readDays = new Set(inside.map((r) => r.readOn));
  // the days in a row with reading, up to today (a day not yet read today does not break it)
  let streak = 0;
  for (let d = readDays.has(today) ? today : addDays(today, -1); readDays.has(d); d = addDays(d, -1)) streak++;
  const left = total - read;
  return {
    total,
    perDay,
    read,
    left,
    todayCount,
    todayLeft: Math.max(0, perDay - todayCount),
    dayNo,
    expected,
    /** portions behind the plan (0 when on time or ahead) */
    behind: Math.max(0, expected - read),
    ahead: Math.max(0, read - expected),
    streak,
    finishBy: addDays(startedOn, days - 1),
    daysToFinish: left === 0 ? 0 : Math.ceil(left / perDay),
    next: nextPortion(inside.map((r) => r.quarter), range),
  };
}

/**
 * The habit's new value for a day when portions are read (+n) or taken back (−n): a done/not-done habit becomes done
 * (and stays so when one is taken back), a counted one moves by the number of portions.
 */
export function habitValueAfter(measure: "check" | "count" | "amount", current: number, n: number): number {
  if (measure === "check") return n > 0 ? 1 : current;
  return Math.max(0, Math.round((current + n) * 100) / 100);
}
