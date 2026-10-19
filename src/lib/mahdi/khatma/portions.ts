// «الختمة العلوية»: how the Quran is shared out (pages, juz, hizb, half hizb, quarter hizb), each portion's exact first
// and last verse, the part a khatma covers (the whole Quran or a stretch of it), which portions a reader may take, and
// the weekly schedule. Pure: used by the page and the server.

import { AYAH_COUNTS, PAGE_STARTS, QUARTER_STARTS, QUARTER_WORDS, SURA_NAMES } from "./quran-map";

export const DIVISIONS = ["page", "juz", "hizb", "half", "quarter"] as const;
export type Division = (typeof DIVISIONS)[number];

/** How many portions the whole Quran makes, per division. */
const COUNT: Record<Division, number> = { page: 604, juz: 30, hizb: 60, half: 120, quarter: 240 };
/** How many hizb quarters one portion holds (pages do not follow the quarters). */
const QUARTERS_PER: Record<Exclude<Division, "page">, number> = { juz: 8, hizb: 4, half: 2, quarter: 1 };

export const portionCount = (d: Division) => COUNT[d];

export const isDivision = (v: unknown): v is Division => typeof v === "string" && (DIVISIONS as readonly string[]).includes(v);

export type VerseRef = readonly [sura: number, aya: number];

// where each surah starts in the 6236 verses (verse numbers across the whole Quran, 1-based)
const SURA_OFFSET: number[] = [];
AYAH_COUNTS.reduce((sum, n, i) => ((SURA_OFFSET[i] = sum), sum + n), 0);
export const TOTAL_VERSES = 6236;

/** A verse's number across the whole Quran, 1–6236. */
export const verseIndex = ([s, a]: VerseRef) => SURA_OFFSET[s - 1] + a;

/** The verse just before another. */
function verseBefore([s, a]: VerseRef): VerseRef {
  if (a > 1) return [s, a - 1];
  return [s - 1, AYAH_COUNTS[s - 2]];
}

const LAST: VerseRef = [114, 6];
const startOf = (starts: readonly (readonly [number, number])[], i: number): VerseRef => [starts[i][0], starts[i][1]];

/** The exact first and last verse of a portion. */
export function portionVerses(d: Division, n: number): { from: VerseRef; to: VerseRef } {
  if (!Number.isInteger(n) || n < 1 || n > portionCount(d)) throw new RangeError(`portion ${n} of ${d}`);
  if (d === "page") return { from: startOf(PAGE_STARTS, n - 1), to: n === 604 ? LAST : verseBefore(PAGE_STARTS[n]) };
  const size = QUARTERS_PER[d];
  const fromQ = (n - 1) * size + 1;
  const toQ = n * size;
  return { from: startOf(QUARTER_STARTS, fromQ - 1), to: toQ === 240 ? LAST : verseBefore(QUARTER_STARTS[toQ]) };
}

/** The verses a portion covers, as numbers across the whole Quran (to compare portions cut differently). */
export function portionSpan(d: Division, n: number): { fromV: number; toV: number } {
  const { from, to } = portionVerses(d, n);
  return { fromV: verseIndex(from), toV: verseIndex(to) };
}

/** The hizb quarter a verse is in. */
export function quarterOf(v: VerseRef): number {
  const i = verseIndex(v);
  let q = 1;
  while (q < 240 && verseIndex(QUARTER_STARTS[q]) <= i) q++;
  return q;
}

/** The quarters a portion covers or touches, 1–240 (a page may start or end inside a quarter). */
export function portionQuarters(d: Division, n: number): { fromQ: number; toQ: number } {
  if (d !== "page") {
    if (!Number.isInteger(n) || n < 1 || n > portionCount(d)) throw new RangeError(`portion ${n} of ${d}`);
    const size = QUARTERS_PER[d];
    return { fromQ: (n - 1) * size + 1, toQ: n * size };
  }
  const { from, to } = portionVerses(d, n);
  return { fromQ: quarterOf(from), toQ: quarterOf(to) };
}

/** The verses of a stretch of quarters (what khatmas kept before pages existed stored). */
export function quarterSpan(fromQ: number, toQ: number) {
  return { fromV: portionSpan("quarter", fromQ).fromV, toV: portionSpan("quarter", toQ).toV };
}

const ORD = ["الأول", "الثاني", "الثالث", "الرابع"];

/** «صفحة ٢٣» · «الجزء ٣» · «الحزب ٥» · «الحزب ٥ · النصف الثاني» · «الحزب ٥ · الربع الثالث». */
export function portionTitle(d: Division, n: number): string {
  if (d === "page") return `صفحة ${n}`;
  if (d === "juz") return `الجزء ${n}`;
  if (d === "hizb") return `الحزب ${n}`;
  if (d === "half") return `الحزب ${Math.ceil(n / 2)} · النصف ${ORD[(n - 1) % 2]}`;
  return `الحزب ${Math.ceil(n / 4)} · الربع ${ORD[(n - 1) % 4]}`;
}

/** The division's name for one portion (صفحة، جزء، حزب…), for several, and for the whole Quran cut that way. */
export const DIVISION_LABEL: Record<Division, { one: string; many: string; all: string; unit: string }> = {
  page: { one: "صفحة", many: "صفحات", all: "٦٠٤ صفحات", unit: "صفحة" },
  juz: { one: "جزء", many: "أجزاء", all: "٣٠ جزءًا", unit: "جزء" },
  hizb: { one: "حزب", many: "أحزاب", all: "٦٠ حزبًا", unit: "حزب" },
  half: { one: "نصف حزب", many: "أنصاف أحزاب", all: "١٢٠ نصف حزب", unit: "نصف حزب" },
  quarter: { one: "ربع حزب", many: "أرباع أحزاب", all: "٢٤٠ ربع حزب", unit: "ربع" },
};

/** «٣ أجزاء» · «١٢ صفحة» — a number of portions of a division. */
export function amountText(d: Division, n: number) {
  const l = DIVISION_LABEL[d];
  return n === 1 ? `${l.one}` : n === 2 ? `${n} ${l.one}` : n <= 10 ? `${n} ${l.many}` : `${n} ${l.one}`;
}

export const verseName = ([s, a]: VerseRef) => `${SURA_NAMES[s - 1]} ${a}`;

/** «البقرة ٢٦ – البقرة ٤٣» and, for the hizb divisions, the first words the portion opens with (how readers name it). */
export function portionSummary(d: Division, n: number) {
  const { from, to } = portionVerses(d, n);
  return { from, to, range: `${verseName(from)} – ${verseName(to)}`, opening: d === "page" ? "" : QUARTER_WORDS[portionQuarters(d, n).fromQ - 1] };
}

// ── The part a khatma covers: the whole Quran, or a stretch of it in the khatma's division (e.g. juz 1–5, pages 1–100) ──

export interface PortionRange {
  from: number;
  to: number;
}

export const fullRange = (d: Division): PortionRange => ({ from: 1, to: portionCount(d) });

/** The stretch, checked against the division; null or anything wrong = the whole Quran. */
export function cleanRange(d: Division, from: unknown, to: unknown): PortionRange {
  const f = Number(from);
  const t = Number(to);
  if (!Number.isInteger(f) || !Number.isInteger(t) || f < 1 || t > portionCount(d) || f > t) return fullRange(d);
  return { from: f, to: t };
}

export const rangeSize = (r: PortionRange) => r.to - r.from + 1;
export const isFull = (d: Division, r: PortionRange) => r.from === 1 && r.to === portionCount(d);
export const inRange = (r: PortionRange, n: number) => n >= r.from && n <= r.to;

/** «القرآن كاملًا» or «من الجزء ١ إلى الجزء ٥». */
export function rangeTitle(d: Division, r: PortionRange) {
  if (isFull(d, r)) return "القرآن كاملًا";
  if (r.from === r.to) return portionTitle(d, r.from);
  return `من ${portionTitle(d, r.from)} إلى ${portionTitle(d, r.to)}`;
}

/** Whether two verse spans share a verse (the same Quran read again). */
export const overlaps = (a: { fromV: number; toV: number }, b: { fromV: number; toV: number }) => a.fromV <= b.toV && b.fromV <= a.toV;

export type PortionState = "free" | "reading" | "done" | "blocked" | "taken" | "out";

/**
 * Every portion of a khatma as one reader sees it (index = portion number − 1): their own (reading / done), someone
 * else's (taken — hidden from them), one they read in the khatmas the leader counts back (blocked — grey, not
 * pressable), outside the stretch this khatma covers (out — not shown), or free.
 */
export function portionStates(
  d: Division,
  claims: { portion: number; userId: string | null; status: "reading" | "done" }[],
  me: string,
  readBefore: { fromV: number; toV: number }[],
  range: PortionRange = fullRange(d),
): PortionState[] {
  const byPortion = new Map(claims.map((c) => [c.portion, c]));
  return Array.from({ length: portionCount(d) }, (_, i) => {
    const n = i + 1;
    if (!inRange(range, n)) return "out";
    const c = byPortion.get(n);
    if (c) return c.userId === me ? c.status : "taken";
    const span = portionSpan(d, n);
    return readBefore.some((r) => overlaps(span, r)) ? "blocked" : "free";
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
