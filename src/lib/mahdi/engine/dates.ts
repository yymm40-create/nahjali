// Calendar dates as 'YYYY-MM-DD' strings (the user's local day). All arithmetic happens at UTC midnight,
// so a time zone or daylight-saving change can never shift a day. Pure functions: no React, no database.

export type ISODate = string;

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");

export function toUTC(d: ISODate): number {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day);
}

export function fromUTC(ms: number): ISODate {
  const x = new Date(ms);
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
}

export const addDays = (d: ISODate, n: number): ISODate => fromUTC(toUTC(d) + n * DAY_MS);

/** Whole days from `b` to `a` (positive when `a` is later). */
export const diffDays = (a: ISODate, b: ISODate) => Math.round((toUTC(a) - toUTC(b)) / DAY_MS);

/** 0 = Sunday … 6 = Saturday. */
export const weekday = (d: ISODate) => new Date(toUTC(d)).getUTCDay();

/** First day of the week that contains `d`. `weekStart`: 0 = Sunday … 6 = Saturday. */
export const startOfWeek = (d: ISODate, weekStart: number): ISODate => addDays(d, -((weekday(d) - weekStart + 7) % 7));

export const startOfMonth = (d: ISODate): ISODate => `${d.slice(0, 7)}-01`;

export function daysInMonth(d: ISODate) {
  const [y, m] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export const endOfMonth = (d: ISODate): ISODate => `${d.slice(0, 7)}-${pad(daysInMonth(d))}`;

/** First day of the month `n` months after the month of `d`. */
export function addMonths(d: ISODate, n: number): ISODate {
  const [y, m] = d.split("-").map(Number);
  return fromUTC(Date.UTC(y, m - 1 + n, 1));
}

export function* eachDay(from: ISODate, to: ISODate): Generator<ISODate> {
  for (let d = from; d <= to; d = addDays(d, 1)) yield d;
}

export const minDate = (a: ISODate, b: ISODate) => (a < b ? a : b);
export const maxDate = (a: ISODate, b: ISODate) => (a > b ? a : b);

export const isISODate = (s: unknown): s is ISODate =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && fromUTC(toUTC(s)) === s;

/** Today's date in an IANA time zone (e.g. 'Asia/Riyadh'). */
export function todayIn(timeZone: string, now: Date = new Date()): ISODate {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return fromUTC(now.getTime() - (now.getTime() % DAY_MS));
  }
}

export function isTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
