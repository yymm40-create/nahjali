// «بداية يومي»: when each person's day starts. By default at Fajr prayer in their area (the Ja'fari method: the sun 16°
// below the horizon); or at midnight; or at a time they pick. Until then it is still yesterday. The Fajr time is worked
// out here in code (no paid service). Pure functions: no React, no database.
//
// Only which date «now» belongs to depends on this: dates already logged stay as they are.

import { addDays, fromUTC, toUTC, type ISODate } from "./dates";

export type DayStartMode = "fajr" | "midnight" | "custom";

export interface DayStart {
  mode: DayStartMode;
  /** 'HH:MM' local time, for «وقت أحدده» */
  at: string | null;
  /** the person's area for Fajr (rounded to 2 decimals); null = the main city of their time zone */
  lat: number | null;
  lng: number | null;
  /** the city they picked from the list (null when picked from their location, or not picked) */
  city: string | null;
}

export const DEFAULT_DAY_START: DayStart = { mode: "fajr", at: null, lat: null, lng: null, city: null };

/** What a person needs to say which day it is: their time zone and their day start (missing = the default). */
export interface Clock {
  timeZone: string;
  dayStart?: DayStart | null;
}

/** The angle of the sun below the horizon at Fajr, in the Ja'fari (Shia) method. */
export const FAJR_ANGLE = 16;

/** «وقت أحدده» can be from midnight up to midday (a later start would make most of the day count as yesterday). */
export const CUSTOM_DAY_START_MAX_MIN = 12 * 60;

/** When Fajr can't be worked out (far north in summer): the day starts at this local minute. */
const FAJR_FALLBACK_MIN = 5 * 60;

export interface DayCity {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** the group it shows under in the list */
  group: string;
}

/** The cities to pick from (coordinates rounded to 2 decimals, like a location the person gives). */
export const DAY_CITIES: DayCity[] = [
  { id: "qatif", name: "القطيف", lat: 26.56, lng: 50.01, group: "المنطقة الشرقية" },
  { id: "ahsa", name: "الأحساء", lat: 25.38, lng: 49.59, group: "المنطقة الشرقية" },
  { id: "dammam", name: "الدمام", lat: 26.43, lng: 50.1, group: "المنطقة الشرقية" },
  { id: "saihat", name: "سيهات", lat: 26.48, lng: 50.04, group: "المنطقة الشرقية" },
  { id: "safwa", name: "صفوى", lat: 26.65, lng: 49.95, group: "المنطقة الشرقية" },
  { id: "awamiyah", name: "العوامية", lat: 26.59, lng: 49.99, group: "المنطقة الشرقية" },
  { id: "tarut", name: "تاروت", lat: 26.57, lng: 50.06, group: "المنطقة الشرقية" },
  { id: "jubail", name: "الجبيل", lat: 27.01, lng: 49.66, group: "المنطقة الشرقية" },
  { id: "khobar", name: "الخبر", lat: 26.28, lng: 50.21, group: "المنطقة الشرقية" },
  { id: "riyadh", name: "الرياض", lat: 24.71, lng: 46.68, group: "السعودية" },
  { id: "jeddah", name: "جدة", lat: 21.54, lng: 39.17, group: "السعودية" },
  { id: "madinah", name: "المدينة المنورة", lat: 24.47, lng: 39.61, group: "السعودية" },
  { id: "makkah", name: "مكة المكرمة", lat: 21.42, lng: 39.83, group: "السعودية" },
  { id: "bahrain", name: "البحرين", lat: 26.23, lng: 50.59, group: "الخليج" },
  { id: "kuwait", name: "الكويت", lat: 29.38, lng: 47.99, group: "الخليج" },
  { id: "qatar", name: "قطر", lat: 25.29, lng: 51.53, group: "الخليج" },
  { id: "uae", name: "الإمارات", lat: 25.2, lng: 55.27, group: "الخليج" },
  { id: "oman", name: "عُمان", lat: 23.59, lng: 58.41, group: "الخليج" },
  { id: "karbala", name: "كربلاء", lat: 32.62, lng: 44.02, group: "العراق" },
  { id: "najaf", name: "النجف", lat: 32.03, lng: 44.35, group: "العراق" },
  { id: "baghdad", name: "بغداد", lat: 33.31, lng: 44.37, group: "العراق" },
  { id: "basra", name: "البصرة", lat: 30.51, lng: 47.78, group: "العراق" },
  { id: "qom", name: "قم", lat: 34.64, lng: 50.88, group: "إيران" },
  { id: "mashhad", name: "مشهد", lat: 36.3, lng: 59.61, group: "إيران" },
  { id: "tehran", name: "طهران", lat: 35.69, lng: 51.39, group: "إيران" },
  { id: "lebanon", name: "لبنان", lat: 33.89, lng: 35.5, group: "لبنان" },
];

export const dayCity = (id: string | null | undefined) => DAY_CITIES.find((c) => c.id === id) ?? null;

/** The main city of a time zone: where Fajr is taken from until the person picks their own area. */
const TZ_CITY: Record<string, string> = {
  "Asia/Riyadh": "riyadh",
  "Asia/Bahrain": "bahrain",
  "Asia/Kuwait": "kuwait",
  "Asia/Qatar": "qatar",
  "Asia/Dubai": "uae",
  "Asia/Muscat": "oman",
  "Asia/Baghdad": "baghdad",
  "Asia/Tehran": "tehran",
  "Asia/Beirut": "lebanon",
};

export const timeZoneCity = (timeZone: string) => dayCity(TZ_CITY[timeZone]);

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The local date and minute of the day of an instant in a time zone (UTC for an unknown zone). */
export function localClock(timeZone: string, at: Date | number): { date: ISODate; minute: number } {
  const ms = typeof at === "number" ? at : at.getTime();
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(ms);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    return { date: `${get("year")}-${get("month")}-${get("day")}`, minute: (Number(get("hour")) % 24) * 60 + Number(get("minute")) };
  } catch {
    const d = new Date(ms);
    return { date: fromUTC(ms - (ms % 86_400_000)), minute: d.getUTCHours() * 60 + d.getUTCMinutes() };
  }
}

/** A time zone's offset from UTC in minutes at an instant (for a zone with no city: its sun is taken as at offset × 15°). */
function offsetMin(timeZone: string, ms: number): number {
  const { date, minute } = localClock(timeZone, ms);
  const [y, m, d] = date.split("-").map(Number);
  const local = Date.UTC(y, m - 1, d) + minute * 60_000;
  return Math.round((local - Math.floor(ms / 60_000) * 60_000) / 60_000);
}

/** Where the person's Fajr is taken from: their own area, else the main city of their time zone, else the time zone's sun. */
export function dayPlace(timeZone: string, dayStart?: DayStart | null, at = Date.now()): { lat: number; lng: number; city: string | null } {
  if (dayStart && dayStart.lat !== null && dayStart.lng !== null && Number.isFinite(dayStart.lat) && Number.isFinite(dayStart.lng)) {
    return { lat: dayStart.lat, lng: dayStart.lng, city: dayStart.city };
  }
  const c = dayStart?.city ? dayCity(dayStart.city) : timeZoneCity(timeZone);
  if (c) return { lat: c.lat, lng: c.lng, city: c.id };
  return { lat: 25, lng: round2(Math.max(-180, Math.min(180, offsetMin(timeZone, at) / 4))), city: null };
}

// ───────────────────────────── the sun (after the well-known PrayTimes method) ─────────────────────────────

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const fix = (a: number, b: number) => ((a % b) + b) % b;

function julian(y: number, m: number, d: number) {
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + b - 1524.5;
}

/** The sun's declination (degrees) and the equation of time (hours) on a Julian day. */
function sun(jd: number) {
  const D = jd - 2451545.0;
  const g = fix(357.529 + 0.98560028 * D, 360);
  const q = fix(280.459 + 0.98564736 * D, 360);
  const L = fix(q + 1.915 * Math.sin(rad(g)) + 0.02 * Math.sin(rad(2 * g)), 360);
  const e = 23.439 - 0.00000036 * D;
  const ra = fix(deg(Math.atan2(Math.cos(rad(e)) * Math.sin(rad(L)), Math.cos(rad(L)))) / 15, 24);
  const decl = deg(Math.asin(Math.sin(rad(e)) * Math.sin(rad(L))));
  let eqt = q / 15 - ra;
  eqt = eqt - 24 * Math.round(eqt / 24);
  return { decl, eqt };
}

/**
 * The moment of Fajr (ms since 1970, UTC) on a calendar date at a place, the sun `angle`° below the horizon before
 * sunrise. Null when the sun never goes that low (far north in summer).
 */
export function fajrAt(date: ISODate, lat: number, lng: number, angle = FAJR_ANGLE): number | null {
  const [y, m, d] = date.split("-").map(Number);
  const jd = julian(y, m, d) - lng / (15 * 24);
  let t = 5; // local solar hours: a first guess, made exact in two steps
  for (let k = 0; k < 2; k++) {
    const { decl, eqt } = sun(jd + t / 24);
    const cos = (-Math.sin(rad(angle)) - Math.sin(rad(decl)) * Math.sin(rad(lat))) / (Math.cos(rad(decl)) * Math.cos(rad(lat)));
    if (!(cos >= -1 && cos <= 1)) return null;
    t = 12 - eqt - deg(Math.acos(cos)) / 15;
  }
  const utcHours = t - lng / 15;
  return Date.UTC(y, m - 1, d) + Math.round(utcHours * 3_600_000);
}

/** Fajr on a date as a local minute of the day in the person's time zone (null when it can't be worked out). */
export function fajrMinute(timeZone: string, date: ISODate, dayStart?: DayStart | null): number | null {
  const p = dayPlace(timeZone, dayStart, toUTC(date) + 12 * 3_600_000);
  const ms = fajrAt(date, p.lat, p.lng);
  if (ms === null) return null;
  const local = localClock(timeZone, ms);
  // an area far from the time zone can put Fajr on the day before or after: then the day starts at that day's edge
  if (local.date < date) return 0;
  if (local.date > date) return 1439;
  return local.minute;
}

/** The angle of the sun below the horizon at Maghrib in the Ja'fari method (the eastern redness gone). */
export const MAGHRIB_ANGLE = 4;

/** Midday (Dhuhr: the sun at its highest) on a calendar date at a place, ms since 1970 (UTC). */
export function dhuhrAt(date: ISODate, lng: number): number {
  const [y, m, d] = date.split("-").map(Number);
  const jd = julian(y, m, d) - lng / (15 * 24);
  const { eqt } = sun(jd + 12 / 24);
  return Date.UTC(y, m - 1, d) + Math.round((12 - eqt - lng / 15) * 3_600_000);
}

/** The moment the sun is `angle`° below the horizon after sunset (Maghrib), ms; null when it never goes that low. */
export function maghribAt(date: ISODate, lat: number, lng: number, angle = MAGHRIB_ANGLE): number | null {
  const [y, m, d] = date.split("-").map(Number);
  const jd = julian(y, m, d) - lng / (15 * 24);
  let t = 18;
  for (let k = 0; k < 2; k++) {
    const { decl, eqt } = sun(jd + t / 24);
    const cos = (-Math.sin(rad(angle)) - Math.sin(rad(decl)) * Math.sin(rad(lat))) / (Math.cos(rad(decl)) * Math.cos(rad(lat)));
    if (!(cos >= -1 && cos <= 1)) return null;
    t = 12 - eqt + deg(Math.acos(cos)) / 15;
  }
  return Date.UTC(y, m - 1, d) + Math.round((t - lng / 15) * 3_600_000);
}

/** Fajr, Dhuhr and Maghrib on a date as local minutes of the day in the person's time zone, at their «بداية يومي»
 *  area (null when one can't be worked out). For «أذكّرك بكرة؟»: reminder times tied to the prayers. */
export function prayerMinutes(timeZone: string, date: ISODate, dayStart?: DayStart | null): { fajr: number | null; dhuhr: number | null; maghrib: number | null } {
  const p = dayPlace(timeZone, dayStart, toUTC(date) + 12 * 3_600_000);
  const local = (ms: number | null) => {
    if (ms === null) return null;
    const c = localClock(timeZone, ms);
    return c.date === date ? c.minute : null;
  };
  return { fajr: fajrMinute(timeZone, date, dayStart), dhuhr: local(dhuhrAt(date, p.lng)), maghrib: local(maghribAt(date, p.lat, p.lng)) };
}

/** 'HH:MM' → minutes since midnight, or null. */
const hhmm = (s: string | null | undefined) => {
  const m = /^([01]\d|2[0-3]):([0-5]\d)(?::\d\d)?$/.exec(s ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** The local minute at which a calendar date's day starts for this person. */
export function dayStartMinute(timeZone: string, date: ISODate, dayStart?: DayStart | null): number {
  const ds = dayStart ?? DEFAULT_DAY_START;
  if (ds.mode === "midnight") return 0;
  if (ds.mode === "custom") return Math.min(hhmm(ds.at) ?? 0, CUSTOM_DAY_START_MAX_MIN);
  return fajrMinute(timeZone, date, ds) ?? FAJR_FALLBACK_MIN;
}

/** Today's date in an IANA time zone (e.g. 'Asia/Riyadh'), the day starting at the person's day start (default: Fajr). */
export function todayIn(timeZone: string, now: Date = new Date(), dayStart?: DayStart | null): ISODate {
  const { date, minute } = localClock(timeZone, now);
  return minute < dayStartMinute(timeZone, date, dayStart) ? addDays(date, -1) : date;
}

/** Today for a person (their time zone and their «بداية يومي»). */
export const todayFor = (clock: Clock, now: Date = new Date()): ISODate => todayIn(clock.timeZone, now, clock.dayStart);

/** A minute of the clock as minutes into the person's day: before the day start it belongs to the night after (+24 h). */
export const appDayMinute = (minute: number, startMin: number) => (minute < startMin ? minute + 1440 : minute);

/** A day start read from the database row (columns of migration 0128; missing or wrong values = the default). */
export function readDayStart(raw: unknown): DayStart {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_DAY_START };
  const row = raw as { day_start_mode?: unknown; day_start_at?: unknown; day_lat?: unknown; day_lng?: unknown; day_city?: unknown };
  const mode: DayStartMode = row.day_start_mode === "midnight" || row.day_start_mode === "custom" ? row.day_start_mode : "fajr";
  const num = (v: unknown, max: number) => {
    const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
    return Number.isFinite(n) && Math.abs(n) <= max ? round2(n) : null;
  };
  let lat = num(row.day_lat, 90);
  let lng = num(row.day_lng, 180);
  if (lat === null || lng === null) lat = lng = null;
  const at = typeof row.day_start_at === "string" && hhmm(row.day_start_at) !== null ? row.day_start_at.slice(0, 5) : null;
  const city = typeof row.day_city === "string" && dayCity(row.day_city) ? row.day_city : null;
  return { mode: mode === "custom" && at === null ? "fajr" : mode, at, lat, lng, city };
}

/**
 * The setting as the person sent it (the API's input), checked: a known mode; a time from 00:00 to 12:00 for «وقت أحدده»;
 * a city from the list (its coordinates are taken from the list) or a location rounded to 2 decimals. Null when invalid.
 */
export function parseDayStart(raw: unknown): DayStart | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.mode !== "fajr" && r.mode !== "midnight" && r.mode !== "custom") return null;
  let at: string | null = null;
  if (r.at !== null && r.at !== undefined && r.at !== "") {
    const m = hhmm(typeof r.at === "string" ? r.at : null);
    if (m === null || m > CUSTOM_DAY_START_MAX_MIN) return null;
    at = (r.at as string).slice(0, 5);
  }
  if (r.mode === "custom" && at === null) return null;
  const city = r.city === null || r.city === undefined || r.city === "" ? null : dayCity(String(r.city));
  if (r.city && !city) return null;
  if (city) return { mode: r.mode, at, lat: city.lat, lng: city.lng, city: city.id };
  const has = (v: unknown) => v !== null && v !== undefined && v !== "";
  if (has(r.lat) || has(r.lng)) {
    const lat = Number(r.lat);
    const lng = Number(r.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { mode: r.mode, at, lat: round2(lat), lng: round2(lng), city: null };
  }
  return { mode: r.mode, at, lat: null, lng: null, city: null };
}

/** The database columns of a day start (migration 0128). */
export const dayStartColumns = (d: DayStart) => ({ day_start_mode: d.mode, day_start_at: d.at, day_lat: d.lat, day_lng: d.lng, day_city: d.city });
