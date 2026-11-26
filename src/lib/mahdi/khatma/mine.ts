// «الختمة العلوية» · «ختمتي»: a person's own khatma — the whole Quran or a stretch of it (pages, juz, hizb, half or
// quarter hizb), read portion by portion at their own pace. Where they are, what today's portion is, whether they are on
// pace (spread again by itself when they miss a day), and what a portion adds to the habit linked to it. Pure.

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

/**
 * «مب شرط بالترتيب»: where to go on from the portion just read, wherever it was — the first unread after it, else the first
 * unread of the stretch; null when all are read.
 */
export function nextAfter(read: Iterable<number>, range: PortionRange, from: number): number | null {
  const set = new Set([...read].filter((n) => inRange(range, n)));
  for (let n = Math.max(range.from, from + 1); n <= range.to; n++) if (!set.has(n)) return n;
  for (let n = range.from; n <= range.to; n++) if (!set.has(n)) return n;
  return null;
}

/** The same for the whole Quran in quarters. */
export const nextQuarter = (read: Iterable<number>) => nextPortion(read, fullRange("quarter"));

export interface MyRead {
  quarter: number;
  readOn: ISODate;
}

/**
 * A portion read before the khatma began («وين وصلت»: what the person had already finished) is kept with the day before
 * it started. It counts as read, but not as today's reading, nor towards the streak, nor towards the habit.
 */
export const carriedDay = (startedOn: ISODate): ISODate => addDays(startedOn, -1);
export const isCarried = (r: MyRead, startedOn: ISODate) => r.readOn < startedOn;

/**
 * How the khatma stands today (`reads[].quarter` is the portion number in the khatma's division).
 *
 * Today's portion is never a fixed number that leaves the person «متأخر»: what was left when the day began is spread
 * over the days left (today included), so a missed day makes the next ones a little longer and reading ahead makes them
 * shorter, by itself. Once the planned days are over, it goes on at the plan's own pace and the finish moves with it.
 */
export function khatmaStats(reads: MyRead[], startedOn: ISODate, days: number, today: ISODate, range: PortionRange = fullRange("quarter")) {
  const inside = reads.filter((r) => inRange(range, r.quarter));
  const total = rangeSize(range);
  // what was already finished when the khatma began is not part of the plan: the pace is for what was left
  const carried = new Set(inside.filter((r) => isCarried(r, startedOn)).map((r) => r.quarter)).size;
  const planPerDay = dailyCount(Math.max(1, total - carried), days);
  const read = new Set(inside.map((r) => r.quarter)).size;
  const readSince = read - carried;
  const dayNo = Math.max(1, diffDays(today, startedOn) + 1);
  const todayCount = inside.filter((r) => r.readOn === today).length;
  const left = total - read;
  // the days of the plan still ahead, today included (0 once the planned days are over)
  const daysLeft = Math.max(0, days - dayNo + 1);
  // what was left when today began, spread over the days left
  const leftAtDawn = left + todayCount;
  const perDay = daysLeft > 0 ? Math.max(1, dailyCount(leftAtDawn, daysLeft)) : planPerDay;
  // where the first plan expected them to be by the end of today (of what they started with)
  const expected = Math.min(Math.max(0, total - carried), planPerDay * dayNo);
  const readDays = new Set(inside.filter((r) => !isCarried(r, startedOn)).map((r) => r.readOn));
  // the days in a row with reading, up to today (a day not yet read today does not break it)
  let streak = 0;
  for (let d = readDays.has(today) ? today : addDays(today, -1); readDays.has(d); d = addDays(d, -1)) streak++;
  const daysToFinish = left === 0 ? 0 : Math.ceil(left / perDay);
  return {
    total,
    perDay,
    /** the pace the khatma was planned with (perDay differs from it once the rest was spread again) */
    planPerDay,
    /** today's portion grew or shrank because the rest was spread over the days left */
    respread: perDay !== planPerDay,
    read,
    carried,
    left,
    todayCount,
    todayLeft: Math.max(0, perDay - todayCount),
    dayNo,
    daysLeft,
    expected,
    /** portions behind the first plan (0 when on time or ahead); kept for the numbers, never shown as «متأخر» */
    behind: Math.max(0, expected - readSince),
    ahead: Math.max(0, readSince - expected),
    streak,
    // inside the planned days the finish stays put; after them it moves with the plan's pace
    finishBy: daysLeft > 0 ? addDays(startedOn, days - 1) : addDays(today, Math.max(0, Math.ceil(leftAtDawn / perDay) - 1)),
    daysToFinish,
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

/**
 * Starting a khatma, in three steps with ready choices (the plan of 26 November 2026): what (the whole Quran, or a
 * stretch), how it is cut (by juz or by page), and when (30 days by default). Everything else — the smaller cuts, other
 * paces, «وين وصلت», the dedication — is folded under «خيارات أكثر».
 */
export const START = {
  units: ["juz", "page"] as Division[],
  moreUnits: ["hizb", "half", "quarter"] as Division[],
  paces: [
    { days: 7, note: "أسبوع" },
    { days: 15, note: "نص شهر" },
    { days: 30, note: "30 يوم" },
    { days: 60, note: "شهرين" },
  ],
  morePaces: [
    { days: 1, note: "اليوم" },
    { days: 10, note: "10 أيام" },
    { days: 90, note: "3 شهور" },
  ],
  unit: "juz" as Division,
  days: 30,
};

/** Whether a start's choices need «خيارات أكثر» open to be seen (a smaller cut, or a pace that is not one of the four). */
export const needsMore = (unit: Division, days: number) => !START.units.includes(unit) || !START.paces.some((p) => p.days === days);
