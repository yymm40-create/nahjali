import { describe, expect, it } from "vitest";
import {
  appDayMinute,
  DEFAULT_DAY_START,
  dayPlace,
  dayStartMinute,
  fajrMinute,
  parseDayStart,
  readDayStart,
  taskReminderDue,
  todayFor,
  todayIn,
  type DayStart,
} from "@/lib/mahdi/engine";

const at = (iso: string) => new Date(iso);
const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const qatif: DayStart = { mode: "fajr", at: null, lat: 26.56, lng: 50.01, city: "qatif" };

describe("Fajr (Ja'fari, 16°)", () => {
  it("is about 4:54 in Al-Qatif in late November", () => {
    const m = fajrMinute("Asia/Riyadh", "2026-11-25", qatif)!;
    expect(m).toBeGreaterThanOrEqual(4 * 60 + 48);
    expect(m).toBeLessThanOrEqual(5 * 60);
  });

  it("is earlier in summer than in winter", () => {
    const june = fajrMinute("Asia/Riyadh", "2026-06-21", qatif)!;
    const dec = fajrMinute("Asia/Riyadh", "2026-12-21", qatif)!;
    expect(june).toBeLessThan(dec);
    expect(hm(june) >= "03:00" && hm(june) <= "03:40").toBe(true);
  });

  it("takes the main city of the time zone until the person picks", () => {
    expect(dayPlace("Asia/Riyadh").city).toBe("riyadh");
    expect(dayPlace("Asia/Bahrain").city).toBe("bahrain");
    expect(dayPlace("Asia/Kuwait", DEFAULT_DAY_START).city).toBe("kuwait");
    // Riyadh is west of Al-Qatif: its Fajr comes later on the same clock
    expect(fajrMinute("Asia/Riyadh", "2026-11-25")!).toBeGreaterThan(fajrMinute("Asia/Riyadh", "2026-11-25", qatif)!);
  });

  it("still works for a zone with no city (its sun taken from the offset)", () => {
    const m = dayStartMinute("Etc/GMT-3", "2026-11-25");
    expect(m).toBeGreaterThan(3 * 60);
    expect(m).toBeLessThan(7 * 60);
  });

  it("follows daylight saving (the time zone's own clock)", () => {
    // Beirut moves its clocks: Fajr stays between 3 and 6 on the local clock all year
    for (const d of ["2026-01-15", "2026-07-15"]) {
      const m = fajrMinute("Asia/Beirut", d)!;
      expect(m).toBeGreaterThan(3 * 60);
      expect(m).toBeLessThan(6 * 60);
    }
  });
});

describe("todayIn with the person's day start", () => {
  const fajr = fajrMinute("Asia/Riyadh", "2026-11-25", qatif)!; // ~04:54 local = ~01:54 UTC
  const utc = (localMin: number) => new Date(Date.UTC(2026, 10, 25) + (localMin - 180) * 60_000);

  it("flips at Fajr by default", () => {
    expect(todayIn("Asia/Riyadh", utc(fajr - 1), qatif)).toBe("2026-11-24");
    expect(todayIn("Asia/Riyadh", utc(fajr), qatif)).toBe("2026-11-25");
    // no longer at 6:00: at 5:30 the new day has begun (Al-Qatif, and Riyadh — the default for Asia/Riyadh)
    expect(todayIn("Asia/Riyadh", at("2026-11-25T02:30:00Z"), qatif)).toBe("2026-11-25");
    expect(todayIn("Asia/Riyadh", at("2026-11-25T02:30:00Z"))).toBe("2026-11-25");
    // and before Fajr it is still yesterday
    expect(todayIn("Asia/Riyadh", at("2026-11-25T01:00:00Z"))).toBe("2026-11-24");
  });

  it("flips at midnight", () => {
    const mid: DayStart = { ...DEFAULT_DAY_START, mode: "midnight" };
    expect(todayIn("Asia/Riyadh", at("2026-11-24T20:59:00Z"), mid)).toBe("2026-11-24");
    expect(todayIn("Asia/Riyadh", at("2026-11-24T21:00:00Z"), mid)).toBe("2026-11-25");
  });

  it("flips at a time the person picks", () => {
    const seven: DayStart = { ...DEFAULT_DAY_START, mode: "custom", at: "07:00" };
    expect(todayFor({ timeZone: "Asia/Riyadh", dayStart: seven }, at("2026-11-25T03:59:00Z"))).toBe("2026-11-24");
    expect(todayFor({ timeZone: "Asia/Riyadh", dayStart: seven }, at("2026-11-25T04:00:00Z"))).toBe("2026-11-25");
  });

  it("an evening is the same day whatever the setting", () => {
    for (const d of [qatif, { ...DEFAULT_DAY_START, mode: "midnight" as const }, { ...DEFAULT_DAY_START, mode: "custom" as const, at: "06:00" }]) {
      expect(todayIn("Asia/Riyadh", at("2026-11-25T18:00:00Z"), d)).toBe("2026-11-25");
    }
  });
});

describe("minutes into the day", () => {
  it("puts the hours before the day start after the evening", () => {
    expect(appDayMinute(60, 270)).toBe(1500);
    expect(appDayMinute(300, 270)).toBe(300);
    expect(appDayMinute(60, 0)).toBe(60);
  });

  it("task reminders follow the person's day start", () => {
    // a task at 23:30, now 04:00: with the day starting at Fajr (~4:54) 04:00 is the night after, so it is late
    expect(taskReminderDue("23:30", 0, 240, 294)).toBe("late");
    // with the day starting at midnight, 04:00 is early in a new day: the 23:30 task is not due yet
    expect(taskReminderDue("23:30", 0, 240, 0)).toBe(null);
  });
});

describe("reading and checking the setting", () => {
  it("falls back to Fajr when the columns are missing (before SQL 0128)", () => {
    expect(readDayStart({})).toEqual(DEFAULT_DAY_START);
    expect(readDayStart(null)).toEqual(DEFAULT_DAY_START);
    expect(readDayStart({ day_start_mode: "custom", day_start_at: null })).toEqual(DEFAULT_DAY_START);
  });

  it("reads the stored values", () => {
    expect(readDayStart({ day_start_mode: "custom", day_start_at: "07:30:00", day_lat: "26.56", day_lng: 50.01, day_city: "qatif" })).toEqual({ mode: "custom", at: "07:30", lat: 26.56, lng: 50.01, city: "qatif" });
  });

  it("takes a city's coordinates from the list", () => {
    expect(parseDayStart({ mode: "fajr", city: "karbala" })).toEqual({ mode: "fajr", at: null, lat: 32.62, lng: 44.02, city: "karbala" });
  });

  it("keeps only 2 decimals of a location", () => {
    expect(parseDayStart({ mode: "fajr", lat: 26.567891, lng: 50.012345 })).toEqual({ mode: "fajr", at: null, lat: 26.57, lng: 50.01, city: null });
  });

  it("refuses what isn't valid", () => {
    expect(parseDayStart({ mode: "sunset" })).toBeNull();
    expect(parseDayStart({ mode: "custom" })).toBeNull();
    expect(parseDayStart({ mode: "custom", at: "15:00" })).toBeNull();
    expect(parseDayStart({ mode: "fajr", city: "paris" })).toBeNull();
    expect(parseDayStart({ mode: "fajr", lat: 200, lng: 10 })).toBeNull();
    expect(parseDayStart({ mode: "custom", at: "05:15" })).toEqual({ mode: "custom", at: "05:15", lat: null, lng: null, city: null });
  });
});
