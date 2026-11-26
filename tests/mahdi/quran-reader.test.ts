// «الختمة العلوية» · the reader: where I reached (what was already finished), the free reading, and the clock at the top
// whose minutes fill a reading habit.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { carriedDay, isCarried, khatmaStats, nextAfter, nextPortion } from "@/lib/mahdi/khatma/mine";
import { CLOCK, clampSize, clockText, firstPage, habitAfterReading, isTimeHabit, minutesInUnit, minutesText, pageOfVerse, pillText, pinchSize, portionsBefore, QURAN_SIZE, readSize, readSurface, stepSize, unreadOf, wholeMinutes } from "@/lib/mahdi/khatma/reader";
import { carryQuarters, loadMyKhatma, readQuarters, startMyKhatma, unreadQuarter } from "@/lib/mahdi/server/my-khatma";
import { addTime, loadReader, setFreePage, setTimeHabit } from "@/lib/mahdi/server/quran-reader";
import { fakeDb } from "./fake-db";

const read = (p: string) => readFileSync(p, "utf8");
const ME = "me";

describe("where I reached", () => {
  it("everything before the place I name is finished", () => {
    expect(portionsBefore({ from: 1, to: 30 }, 5)).toEqual([1, 2, 3, 4]);
    expect(portionsBefore({ from: 28, to: 30 }, 28)).toEqual([]);
    expect(portionsBefore({ from: 1, to: 10 }, 99)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(unreadOf([1, 2, 3, 4], new Set([2, 4]))).toEqual([1, 3]);
  });
  it("what was finished before is read, but not today's reading, not the streak, and the pace is for what is left", () => {
    const start = "2026-10-20";
    const carried = Array.from({ length: 6 }, (_, i) => ({ quarter: i + 1, readOn: carriedDay(start) }));
    expect(carriedDay(start)).toBe("2026-10-19");
    expect(isCarried(carried[0], start)).toBe(true);
    const s = khatmaStats(carried, start, 2, start, { from: 1, to: 10 });
    expect(s).toMatchObject({ total: 10, read: 6, carried: 6, left: 4, todayCount: 0, streak: 0, perDay: 2, behind: 2, ahead: 0, next: 7 });
    // two days for the 4 left: 2 a day; reading 3 today is ahead of the plan by 1
    const more = khatmaStats([...carried, ...[7, 8, 9].map((q) => ({ quarter: q, readOn: start }))], start, 2, start, { from: 1, to: 10 });
    expect(more).toMatchObject({ read: 9, todayCount: 3, streak: 1, ahead: 1, behind: 0 });
    // a khatma with nothing carried is as before
    expect(khatmaStats([{ quarter: 1, readOn: start }], start, 10, start)).toMatchObject({ perDay: 24, carried: 0, read: 1 });
  });
  it("on the server: kept with the day before the start, outside the stretch refused, finishing it finishes the khatma", async () => {
    const { db, tables } = fakeDb();
    await startMyKhatma(db, ME, "2026-10-20", { days: 5, unit: "juz", range: { from: 1, to: 4 }, dedicatedTo: "", forSoulOf: "" });
    await expect(carryQuarters(db, ME, "2026-10-20", [9])).rejects.toThrow(/خارج/);
    expect(await carryQuarters(db, ME, "2026-10-20", [1, 2])).toEqual({ added: [1, 2], finished: false });
    expect(tables.mahdi_my_khatma_reads.map((r) => [r.quarter, r.read_on])).toEqual([[1, "2026-10-19"], [2, "2026-10-19"]]);
    // what is already read is not marked again, and reading today's goes on from there
    expect(await carryQuarters(db, ME, "2026-10-20", [2, 3])).toMatchObject({ added: [3] });
    expect(await readQuarters(db, ME, "2026-10-20", [3, 4])).toMatchObject({ added: [4], finished: true });
    const mine = await loadMyKhatma(db, ME);
    expect(mine.ready && mine.current).toMatchObject({ status: "done" });
  });
  it("taking one back returns the day it was read on (before the start for a carried one)", async () => {
    const { db } = fakeDb();
    await startMyKhatma(db, ME, "2026-10-20", { days: 5, unit: "juz", range: { from: 1, to: 10 }, dedicatedTo: "", forSoulOf: "" });
    await carryQuarters(db, ME, "2026-10-20", [1]);
    await readQuarters(db, ME, "2026-10-20", [2]);
    expect(await unreadQuarter(db, ME, 1)).toEqual({ readOn: "2026-10-19" });
    expect(await unreadQuarter(db, ME, 2)).toEqual({ readOn: "2026-10-20" });
  });
});

describe("the clock and the habit", () => {
  it("reads as the clock does", () => {
    expect(clockText(0)).toBe("00:00");
    expect(clockText(75)).toBe("01:15");
    expect(clockText(3725)).toBe("1:02:05");
    expect(wholeMinutes(119)).toBe(1);
    expect(minutesText(0)).toBe("0 دقيقة");
    expect(minutesText(12)).toBe("12 دقيقة");
    expect(minutesText(65)).toBe("1 ساعة و5 دقيقة");
    expect(minutesText(120)).toBe("2 ساعة");
  });
  it("a reading habit: an amount grows by the minutes (in its own unit), a done / not done one becomes done, a counter is not for time", () => {
    expect(isTimeHabit("amount")).toBe(true);
    expect(isTimeHabit("check")).toBe(true);
    expect(isTimeHabit("count")).toBe(false);
    expect(habitAfterReading("amount", "دقيقة", 10, 3)).toBe(13);
    expect(habitAfterReading("amount", "ساعة", 0.5, 30)).toBe(1);
    expect(minutesInUnit("ساعات", 90)).toBe(1.5);
    expect(habitAfterReading("check", "", 0, 1)).toBe(1);
    expect(habitAfterReading("count", "", 2, 5)).toBe(2);
    expect(habitAfterReading("amount", "دقيقة", 10, 0)).toBe(10);
  });
  it("the day's seconds add up, a report is capped, and each completed minute is reported once", async () => {
    const { db } = fakeDb();
    expect(await loadReader(db, ME, "2026-10-20")).toEqual({ ready: true, timeHabitId: null, freePage: null, todaySeconds: 0 });
    expect(await addTime(db, ME, "2026-10-20", 50)).toEqual({ before: 0, after: 50, minutes: 0 });
    expect(await addTime(db, ME, "2026-10-20", 20)).toEqual({ before: 50, after: 70, minutes: 1 });
    expect(await addTime(db, ME, "2026-10-20", 40)).toEqual({ before: 70, after: 110, minutes: 0 });
    expect(await addTime(db, ME, "2026-10-20", 99_999)).toEqual({ before: 110, after: 110 + CLOCK.maxPerReport, minutes: 2 });
    expect(await addTime(db, ME, "2026-10-20", -5)).toMatchObject({ before: 230, after: 230, minutes: 0 });
    // another day starts from zero; another person has their own
    expect((await loadReader(db, ME, "2026-10-21")).todaySeconds).toBe(0);
    expect((await loadReader(db, "other", "2026-10-20")).todaySeconds).toBe(0);
  });
  it("the linked habit and the free page are kept apart", async () => {
    const { db } = fakeDb();
    await setTimeHabit(db, ME, "habit-1");
    await setFreePage(db, ME, 77);
    expect(await loadReader(db, ME, "2026-10-20")).toMatchObject({ timeHabitId: "habit-1", freePage: 77 });
    await setTimeHabit(db, ME, null);
    expect(await loadReader(db, ME, "2026-10-20")).toMatchObject({ timeHabitId: null, freePage: 77 });
  });
});

describe("free reading", () => {
  it("a surah or a juz opens on its first page", () => {
    expect(pageOfVerse([1, 1])).toBe(1);
    expect(pageOfVerse([2, 1])).toBe(2);
    expect(pageOfVerse([114, 1])).toBe(604);
    expect(firstPage("page", 77)).toBe(77);
    expect(firstPage("juz", 1)).toBe(1);
    expect(firstPage("juz", 2)).toBeGreaterThan(firstPage("juz", 1));
    expect(firstPage("juz", 30)).toBeLessThanOrEqual(604);
  });
});

describe("the reader's wiring", () => {
  it("one reader for the three: my khatma, the free reading and a group's portion — no glass, the tab bar away", () => {
    for (const page of ["src/app/mahdi/(app)/khatma/read/[q]/page.tsx", "src/app/mahdi/(app)/khatma/free/[p]/page.tsx", "src/app/mahdi/(app)/khatma/[id]/read/[n]/page.tsx"]) {
      const src = read(page);
      expect(src, page).toMatch(/<QuranReader\b/);
      // the reader draws the words and the clock itself
      expect(src, page).not.toMatch(/<QuranText\b|<ReaderClock\b/);
    }
    const reader = read("src/components/mahdi/khatma/QuranReader.tsx");
    expect(reader).toMatch(/<ReaderClock clock=\{clock\} \/>/);
    expect(reader).toMatch(/useReadingMode\(prefs\.surface\)/);
    expect(reader).toContain("Aa");
    expect(reader).toContain("قراءة الليل");
    expect(read("src/components/mahdi/khatma/useReaderPrefs.ts")).toMatch(/setAttribute\("data-mreading"/);
    const css = read("src/app/mahdi/mahdi.css");
    expect(css).toMatch(/\.mahdi-root\[data-mreading\] \.m-bottom-nav \{ display: none; \}/);
    const page = css.slice(css.indexOf(".m-reader-page {"));
    expect(page.slice(0, page.indexOf("}"))).not.toMatch(/backdrop-filter|blur|url\(/);
    expect(read("src/components/mahdi/khatma/KhatmaTabs.tsx")).toMatch(/\/free\//);
  });
  it("the stopwatch goes on from page to page (the owner's rule), and the day's total keeps counting too", () => {
    const clock = read("src/components/mahdi/khatma/ReaderClock.tsx");
    // kept outside the screens (each page is a new screen) and cleared only after a long absence
    expect(clock).toMatch(/const visit = \{ seconds: 0/);
    expect(clock).toMatch(/VISIT_GAP_MS/);
    expect(clock).toMatch(/visit\.seconds \+= 1/);
    expect(clock).not.toMatch(/seenPage|setSession\(0\)/);
    expect(clock).toMatch(/initial \+ \(session - from\)/);
    // a pill with minutes, a tap pauses it; never the ticking seconds
    expect(clock).toMatch(/pillText\(session\)/);
    expect(clock).not.toMatch(/clockText\(/);
  });
  it("the tables are server-only and the time route credits the habit through the person's own client", () => {
    const sql = read("supabase/migrations/0084_mahdi_quran_reader.sql");
    expect(sql).toMatch(/revoke all on public\.mahdi_quran_time from anon, authenticated/);
    expect(sql).toMatch(/revoke all on public\.mahdi_quran_reader from anon, authenticated/);
    expect(read("src/app/api/mahdi/khatma/reader/route.ts")).toMatch(/applyMinutesToHabit\(supabase,/);
    expect(read("src/lib/mahdi/server/quran-reader.ts")).toMatch(/isTimeHabit\(v\.measure\)/);
  });
  it("«وين وصلت» never touches the habit", () => {
    expect(read("src/app/api/mahdi/khatma/mine/route.ts")).toMatch(/case "carry"/);
    expect(read("src/components/mahdi/khatma/useMyKhatma.ts")).toMatch(/r\.readOn < data\.current\.startedOn/);
  });
});

describe("reading wherever they like", () => {
  it("goes on from the portion just read: the next unread after it, else the first unread; null when all are read", () => {
    const r = { from: 1, to: 10 };
    expect(nextAfter([1, 2, 3], r, 7)).toBe(8);
    expect(nextAfter([1, 2, 3, 7, 8, 9, 10], r, 7)).toBe(4);
    expect(nextAfter([5, 6], r, 5)).toBe(7);
    expect(nextAfter([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], r, 3)).toBeNull();
    // the same set in order goes after the furthest read instead
    expect(nextPortion([1, 2, 3, 7], r)).toBe(8);
    expect(nextAfter([1, 2, 3, 7], r, 2)).toBe(4);
  });
  it("the choice is on the khatma page and the reader follows it", () => {
    expect(read("src/app/mahdi/(app)/khatma/page.tsx")).toMatch(/أقرأ من أي مكان/);
    expect(read("src/app/mahdi/(app)/khatma/read/[q]/page.tsx")).toMatch(/order === "free" \? nextAfter/);
  });
});

describe("the reader's settings", () => {
  it("the pill shows whole minutes", () => {
    expect(pillText(0)).toBe("0 د");
    expect(pillText(59)).toBe("0 د");
    expect(pillText(61)).toBe("1 د");
    expect(pillText(3725)).toBe("62 د");
  });
  it("the letter size: the old five steps carried over, the new rem kept, «أكبر/أصغر» and two fingers inside the bounds", () => {
    expect(readSize(null, null)).toBe(QURAN_SIZE.def);
    expect(readSize(null, "0")).toBe(1.25);
    expect(readSize(null, "4")).toBe(2.2);
    expect(readSize(null, "9")).toBe(QURAN_SIZE.def);
    expect(readSize("2.05", "0")).toBe(2.05);
    expect(readSize("99", null)).toBe(QURAN_SIZE.max);
    expect(readSize("abc", null)).toBe(QURAN_SIZE.def);
    expect(stepSize(1.65, 1)).toBe(1.8);
    expect(stepSize(QURAN_SIZE.min, -1)).toBe(QURAN_SIZE.min);
    expect(pinchSize(1.6, 1.5)).toBe(2.4);
    expect(pinchSize(1.6, 10)).toBe(QURAN_SIZE.max);
    expect(pinchSize(1.6, 0)).toBe(1.6);
    expect(clampSize(Number.NaN)).toBe(QURAN_SIZE.def);
  });
  it("the reading surface: day unless night was picked", () => {
    expect(readSurface(null)).toBe("day");
    expect(readSurface("night")).toBe("night");
    expect(readSurface("dark")).toBe("day");
  });
  it("«قراءة الليل» is a light surface, never black", () => {
    const css = read("src/app/mahdi/mahdi.css");
    const night = css.slice(css.indexOf('.mahdi-root[data-mreading="night"] {'));
    const bg = night.slice(0, night.indexOf("}")).match(/--m-read-bg: #([0-9a-f]{6})/i)![1];
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(bg.slice(i, i + 2), 16));
    expect(Math.min(r, g, b)).toBeGreaterThan(200);
    // warmer: more red than blue
    expect(r).toBeGreaterThan(b);
  });
});
