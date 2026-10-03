// SERVER ONLY. Checks every value that comes from the browser before it reaches the database
// (the database checks again with its own constraints).
import { MAHDI_LIMITS, MAHDI_THEMES, PROJECT_COLORS, type MahdiTheme, type ProjectColor } from "@config/mahdi";
import { isISODate, isTimeZone, type Freq, type ISODate, type Measure } from "../engine";
import { t } from "../i18n";
import { UserError } from "./api";

const invalid = (msg: string = t.errors.invalid) => new UserError(msg, 400);

/** One line of text: control and invisible formatting characters removed, spaces collapsed. */
export function cleanLine(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  const s = v.replace(/[\p{Cc}\p{Cf}]/gu, " ").replace(/\s+/g, " ").trim();
  return [...s].slice(0, max).join("");
}

/** Multi-line text (notes). */
export function cleanText(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  const s = v
    .replace(/\r\n?/g, "\n")
    .replace(/[\p{Cc}\p{Cf}]/gu, (c) => (c === "\n" ? c : " "))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return [...s].slice(0, max).join("");
}

export function requireName(v: unknown, max: number, message: string = t.errors.invalid): string {
  const s = cleanLine(v, max + 1);
  if (!s || [...s].length > max) throw invalid(message);
  return s;
}

const segmenter = new Intl.Segmenter("ar", { granularity: "grapheme" });
/** A single emoji (or empty). Anything else is dropped. */
export function cleanIcon(v: unknown): string {
  if (typeof v !== "string") return "";
  const first = segmenter.segment(v.trim())[Symbol.iterator]().next().value?.segment ?? "";
  if (!first || first.length > 16 || !/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(first)) return "";
  return first;
}

export function oneOf<T extends string>(v: unknown, options: readonly T[]): T {
  if (typeof v !== "string" || !options.includes(v as T)) throw invalid();
  return v as T;
}

export const parseColor = (v: unknown): ProjectColor => oneOf(v, PROJECT_COLORS);
export const parseTheme = (v: unknown): MahdiTheme => oneOf(v, MAHDI_THEMES.map((x) => x.key));

export function parseDate(v: unknown): ISODate {
  if (!isISODate(v)) throw invalid();
  return v;
}

export function parseTime(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) throw invalid();
  return v;
}

export function parseTimeZone(v: unknown): string {
  if (!isTimeZone(v)) throw invalid();
  return v;
}

export function parseBool(v: unknown): boolean {
  if (typeof v !== "boolean") throw invalid();
  return v;
}

export function parseIntIn(v: unknown, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw invalid();
  return n;
}

export interface HabitConfig {
  measure: Measure;
  target: number;
  unit: string;
  freq: Freq;
  days: number[];
}

/** Measure, goal and schedule of a habit, normalised (e.g. a done/not-done daily habit always has target 1). */
export function parseConfig(b: Record<string, unknown>): HabitConfig {
  const measure = oneOf(b.measure, ["check", "count", "amount"] as const);
  const freq = oneOf(b.freq, ["daily", "days", "weekly", "monthly"] as const);
  let days =
    freq === "days" && Array.isArray(b.days)
      ? [...new Set(b.days.map(Number))].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort((x, y) => x - y)
      : [];
  if (freq === "days" && days.length === 0) throw invalid(t.habit.pickDays);
  if (freq !== "days") days = [];

  let target = Number(b.target);
  let unit = "";
  if (measure === "check") {
    if (freq === "daily" || freq === "days") target = 1;
    else if (!Number.isInteger(target) || target < 1 || target > (freq === "weekly" ? 7 : 31)) throw invalid();
  } else if (measure === "count") {
    if (!Number.isInteger(target) || target < 1 || target > MAHDI_LIMITS.maxCountTarget) throw invalid();
  } else {
    if (!Number.isFinite(target) || target <= 0 || target > MAHDI_LIMITS.maxValue) throw invalid();
    target = Math.round(target * 100) / 100;
    if (target <= 0) throw invalid();
    unit = cleanLine(b.unit, MAHDI_LIMITS.unitMax);
    if (!unit) throw invalid(t.habit.unitRequired);
  }
  return { measure, target, unit, freq, days };
}

/** A logged value: 0…1,000,000 with at most two decimals. */
export function parseValue(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > MAHDI_LIMITS.maxValue) throw invalid();
  return Math.round(n * 100) / 100;
}
