// «الختمة العلوية»: how the Quran is shared out (juz, hizb, half hizb, quarter hizb), each portion's exact first and
// last verse, which portions a reader may take, and the weekly schedule. Pure: used by the page and the server.

import { AYAH_COUNTS, QUARTER_STARTS, QUARTER_WORDS, SURA_NAMES } from "./quran-map";

export const DIVISIONS = ["juz", "hizb", "half", "quarter"] as const;
export type Division = (typeof DIVISIONS)[number];

/** How many hizb quarters one portion holds, per division. 240 quarters = the whole Quran. */
const QUARTERS_PER: Record<Division, number> = { juz: 8, hizb: 4, half: 2, quarter: 1 };

export const portionCount = (d: Division) => 240 / QUARTERS_PER[d];

export const isDivision = (v: unknown): v is Division => typeof v === "string" && (DIVISIONS as readonly string[]).includes(v);

/** The quarters a portion covers, 1–240, both ends included. */
export function portionQuarters(d: Division, n: number): { fromQ: number; toQ: number } {
  if (!Number.isInteger(n) || n < 1 || n > portionCount(d)) throw new RangeError(`portion ${n} of ${d}`);
  const size = QUARTERS_PER[d];
  return { fromQ: (n - 1) * size + 1, toQ: n * size };
}

export type VerseRef = readonly [sura: number, aya: number];

/** The verse just before another (the last verse of the Quran for the end). */
function verseBefore([s, a]: VerseRef): VerseRef {
  if (a > 1) return [s, a - 1];
  return [s - 1, AYAH_COUNTS[s - 2]];
}

/** The exact first and last verse of a portion. */
export function portionVerses(d: Division, n: number): { from: VerseRef; to: VerseRef } {
  const { fromQ, toQ } = portionQuarters(d, n);
  const from = QUARTER_STARTS[fromQ - 1];
  const to = toQ === 240 ? ([114, AYAH_COUNTS[113]] as const) : verseBefore(QUARTER_STARTS[toQ]);
  return { from: [from[0], from[1]], to };
}

const ORD = ["الأول", "الثاني", "الثالث", "الرابع"];

/** «الجزء ٣» · «الحزب ٥» · «الحزب ٥ · النصف الثاني» · «الحزب ٥ · الربع الثالث». */
export function portionTitle(d: Division, n: number): string {
  if (d === "juz") return `الجزء ${n}`;
  if (d === "hizb") return `الحزب ${n}`;
  if (d === "half") return `الحزب ${Math.ceil(n / 2)} · النصف ${ORD[(n - 1) % 2]}`;
  return `الحزب ${Math.ceil(n / 4)} · الربع ${ORD[(n - 1) % 4]}`;
}

/** The division's name for one portion (جزء، حزب…) and for the whole set. */
export const DIVISION_LABEL: Record<Division, { one: string; all: string }> = {
  juz: { one: "جزء", all: "٣٠ جزءًا" },
  hizb: { one: "حزب", all: "٦٠ حزبًا" },
  half: { one: "نصف حزب", all: "١٢٠ نصف حزب" },
  quarter: { one: "ربع حزب", all: "٢٤٠ ربع حزب" },
};

export const verseName = ([s, a]: VerseRef) => `${SURA_NAMES[s - 1]} ${a}`;

/** «من البقرة ٢٦ إلى البقرة ٤٣» and the first words the portion opens with. */
export function portionSummary(d: Division, n: number) {
  const { from, to } = portionVerses(d, n);
  return { from, to, range: `${verseName(from)} – ${verseName(to)}`, opening: QUARTER_WORDS[portionQuarters(d, n).fromQ - 1] };
}

/** Whether two quarter ranges share a quarter (the same Quran read again). */
export const overlaps = (a: { fromQ: number; toQ: number }, b: { fromQ: number; toQ: number }) => a.fromQ <= b.toQ && b.fromQ <= a.toQ;

export type PortionState = "free" | "reading" | "done" | "blocked" | "taken";

/**
 * Every portion of a khatma as one reader sees it: their own (reading / done), someone else's (taken — hidden from
 * them), one they read in the khatmas the leader counts back (blocked — shown grey, not pressable), or free.
 */
export function portionStates(
  d: Division,
  claims: { portion: number; userId: string | null; status: "reading" | "done" }[],
  me: string,
  readBefore: { fromQ: number; toQ: number }[],
): PortionState[] {
  const byPortion = new Map(claims.map((c) => [c.portion, c]));
  return Array.from({ length: portionCount(d) }, (_, i) => {
    const c = byPortion.get(i + 1);
    if (c) return c.userId === me ? c.status : "taken";
    const q = portionQuarters(d, i + 1);
    return readBefore.some((r) => overlaps(q, r)) ? "blocked" : "free";
  });
}

// ── The schedule: the leader picks the night it ends (weekday + hour, their time zone) and every how many weeks ──

/** The wall-clock offset of a time zone at an instant, in ms (local − UTC). */
function offsetAt(ms: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const local = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return local - Math.floor(ms / 1000) * 1000;
}

/** The instant a local date and hour happen in a time zone. */
function zoned(y: number, m: number, day: number, hour: number, timeZone: string) {
  const guess = Date.UTC(y, m, day, hour);
  const first = guess - offsetAt(guess, timeZone);
  const second = guess - offsetAt(first, timeZone);
  return second;
}

/** The first time strictly after `after` that is weekday `dow` (0 = Sunday) at `hour`:00 in `timeZone`. */
export function nextSlot(after: Date, timeZone: string, dow: number, hour: number): Date {
  const local = new Date(after.getTime() + offsetAt(after.getTime(), timeZone));
  for (let i = 0; i <= 8; i++) {
    const day = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + i));
    if (day.getUTCDay() !== dow) continue;
    const at = zoned(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour, timeZone);
    if (at > after.getTime()) return new Date(at);
  }
  throw new Error("no slot");
}

export interface Schedule {
  weeks: number;
  endDow: number;
  endHour: number;
  timeZone: string;
}

/** When a khatma that starts after `from` ends: the chosen night, `weeks` of them on. */
export function khatmaEnd(from: Date, s: Schedule): Date {
  let end = from;
  for (let i = 0; i < s.weeks; i++) end = nextSlot(end, s.timeZone, s.endDow, s.endHour);
  return end;
}

/** The end of the khatma after one that ended at `prevEnd`, moved on until it is still ahead of `now`. */
export function followingEnd(prevEnd: Date, now: Date, s: Schedule): Date {
  let end = khatmaEnd(prevEnd, s);
  while (end.getTime() <= now.getTime()) end = khatmaEnd(end, s);
  return end;
}

/** The night the khatma ends, as people say it: the evening before a day is that day's night (Thursday 9 pm = «ليلة الجمعة»). */
export function nightName(dow: number, hour: number) {
  const days = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  return hour >= 12 ? `ليلة ${days[(dow + 1) % 7]}` : `${days[dow]}`;
}

/** A khatma's end, as people say it, in the group's time zone: «ليلة الجمعة ٢٣ أكتوبر · 9:00 م». */
export function nightText(iso: string | Date, timeZone: string) {
  const at = new Date(iso);
  let tz = timeZone;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    tz = "Asia/Riyadh";
  }
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "2-digit", hourCycle: "h23" }).formatToParts(at);
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.find((p) => p.type === "weekday")?.value ?? "");
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const date = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { timeZone: tz, day: "numeric", month: "long" }).format(at);
  const time = new Intl.DateTimeFormat("ar-SA-u-nu-latn", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(at);
  return `${nightName(dow, hour)} ${date} · ${time}`;
}

/** Ayah numbers in Arabic-Indic digits, as in the mushaf. */
export const arabicDigits = (n: number) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
