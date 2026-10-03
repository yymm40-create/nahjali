// The active language of «لأجل المهدي». Arabic only for now; a new language = a new file shaped like `Dict`
// plus an entry in LOCALES (direction, number and calendar settings).
import { ar, type Dict } from "./ar";
import { addDays, toUTC, weekday, type ISODate } from "../engine/dates";

export type { Dict };

const LOCALES = {
  ar: { dict: ar, lang: "ar", dir: "rtl" as const, intl: "ar-u-nu-latn" },
};

const active = LOCALES.ar;

export const t: Dict = active.dict;
export const LANG = active.lang;
export const DIR = active.dir;
const INTL = active.intl;

const num = new Intl.NumberFormat(INTL, { maximumFractionDigits: 2 });

/** Plain number with Latin digits (e.g. 1,250.5). */
export const fmtNum = (n: number) => num.format(n);

/** 0.823 → "82%" (null → "—"). */
export const fmtPct = (score: number | null) => (score === null ? "—" : `${Math.round(score * 100)}%`);

/** Signed change in percentage points: +12 / −5 / 0. */
export const fmtPoints = (delta: number) => {
  const r = Math.round(delta);
  return r > 0 ? `+${r}` : r < 0 ? `−${Math.abs(r)}` : "0";
};

const asDate = (d: ISODate) => new Date(toUTC(d));

const longDate = new Intl.DateTimeFormat(`${INTL}-ca-gregory`, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const mediumDate = new Intl.DateTimeFormat(`${INTL}-ca-gregory`, { day: "numeric", month: "long", timeZone: "UTC" });
const shortDate = new Intl.DateTimeFormat(`${INTL}-ca-gregory`, { day: "numeric", month: "numeric", timeZone: "UTC" });
const monthYear = new Intl.DateTimeFormat(`${INTL}-ca-gregory`, { month: "long", year: "numeric", timeZone: "UTC" });
const hijri = new Intl.DateTimeFormat(`${INTL}-ca-islamic-umalqura`, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** «الخميس، 8 أكتوبر 2026» */
export const fmtDateLong = (d: ISODate) => longDate.format(asDate(d));
/** «8 أكتوبر» */
export const fmtDate = (d: ISODate) => mediumDate.format(asDate(d));
/** «8/10» */
export const fmtDateShort = (d: ISODate) => shortDate.format(asDate(d));
/** «أكتوبر 2026» */
export const fmtMonth = (d: ISODate) => monthYear.format(asDate(d));
/** Hijri date (Umm al-Qura), shifted by the user's ± day adjustment. */
export const fmtHijri = (d: ISODate, offset = 0) => hijri.format(asDate(addDays(d, offset)));

export const weekdayName = (d: ISODate) => t.weekdays[weekday(d)];

/** «اليوم» / «أمس» / weekday + date. */
export function fmtRelativeDay(d: ISODate, today: ISODate) {
  if (d === today) return t.common.today;
  if (d === addDays(today, -1)) return t.common.yesterday;
  if (d === addDays(today, 1)) return t.common.tomorrow;
  return `${weekdayName(d)} ${fmtDate(d)}`;
}

/** Weekdays in display order for a week starting on `weekStart`. */
export const orderedWeekdays = (weekStart: number) => Array.from({ length: 7 }, (_, k) => (weekStart + k) % 7);

/** «السبت والاثنين والخميس» */
export function joinDays(days: number[], weekStart: number) {
  const names = orderedWeekdays(weekStart).filter((d) => days.includes(d)).map((d) => t.weekdays[d]);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join("، ")} و${names[names.length - 1]}`;
}
