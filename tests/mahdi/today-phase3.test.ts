import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildTimeline,
  canMark,
  cleanMarks,
  dayState,
  dayStreak,
  excusedDays,
  excusesLeft,
  itemStreak,
  missedDays,
  pauseAround,
  pauseDays,
  type DayMark,
  type Item,
  type Version,
} from "@/lib/mahdi/engine";
import { applyMark } from "@/lib/mahdi/client/day-marks";
import { nextPopup } from "@/lib/mahdi/client/popups";
import { PROGRESS_TABS, progressTab } from "@/components/mahdi/Stats";
import { DEFAULT_WIDGETS } from "@/lib/mahdi/home-widgets";

// Phase 3 of the redesign (26 November 2026): «اليوم» lean, «تقدّمي» in three tabs, «أيام العذر والقضاء», and one popup per visit.

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const v = (o: Partial<Version> = {}): Version => ({ effectiveFrom: "2026-11-01", measure: "check", target: 1, unit: "", freq: "daily", days: [], state: "active", ...o });
const item = (logs: Record<string, number>): Item => ({ id: "h1", projectId: "p1", versions: [v()], logs });
// weeks start on Saturday (6); 2026-11-26 is a Thursday
const TODAY = "2026-11-26";
const tl = (logs: Record<string, number>, marks: DayMark[] = []) =>
  buildTimeline([item(logs)], "2026-11-01", TODAY, { asOf: TODAY, weekStart: 6, excused: excusedDays(marks) });
const done = (...days: string[]) => Object.fromEntries(days.map((d) => [d, 1]));

describe("«أيام العذر»: the streak never breaks on an excused day", () => {
  const logs = done("2026-11-22", "2026-11-23", "2026-11-25");
  it("a missed day breaks it, an excused one does not", () => {
    expect(dayStreak(tl(logs), 0.8).current).toBe(1);
    expect(dayStreak(tl(logs, [{ day: "2026-11-24", kind: "travel" }]), 0.8).current).toBe(3);
    expect(dayStreak(tl(logs, [{ day: "2026-11-24", kind: "pause" }]), 0.8).best).toBe(3);
    // «قضاء» is not an excuse: the day counts once it is logged
    expect(dayStreak(tl(logs, [{ day: "2026-11-24", kind: "qada" }]), 0.8).current).toBe(1);
    expect(dayStreak(tl({ ...logs, "2026-11-24": 1 }, [{ day: "2026-11-24", kind: "qada" }]), 0.8).current).toBe(4);
  });
  it("the habit's own streak holds too", () => {
    expect(itemStreak(tl(logs), "h1").current).toBe(1);
    expect(itemStreak(tl(logs, [{ day: "2026-11-24", kind: "illness" }]), "h1").current).toBe(3);
  });
  it("draws each day: missed soft (can be made up), excused, made up", () => {
    const marks: DayMark[] = [
      { day: "2026-11-24", kind: "shari" },
      { day: "2026-11-21", kind: "qada" },
    ];
    const t = tl({ ...logs, "2026-11-21": 1 }, marks);
    expect(dayState(t, "2026-11-24", 0.8, marks)).toBe("excused");
    expect(dayState(t, "2026-11-21", 0.8, marks)).toBe("qada");
    expect(dayState(t, "2026-11-20", 0.8, marks)).toBe("missed");
    expect(dayState(t, TODAY, 0.8, marks)).toBe("open");
    expect(dayState(t, "2026-11-27", 0.8, marks)).toBe("future");
    expect(missedDays(t, 0.8, marks, 7)).toEqual(["2026-11-20", "2026-11-19"]);
  });
});

describe("«أيام العذر»: two a week, a pause up to 14 days, «قضاء» for a day gone by", () => {
  const two: DayMark[] = [
    { day: "2026-11-22", kind: "travel" },
    { day: "2026-11-23", kind: "travel" },
  ];
  it("at most two excuse days in the person's week; a pause and «قضاء» are not counted", () => {
    expect(excusesLeft([], TODAY, 6)).toBe(2);
    expect(excusesLeft(two, TODAY, 6)).toBe(0);
    expect(canMark(two, TODAY, "illness", TODAY, 6)).toEqual({ ok: false, reason: "weekFull" });
    // the week before is another week (it began on Saturday 21 November)
    expect(canMark(two, "2026-11-20", "illness", TODAY, 6).ok).toBe(true);
    expect(excusesLeft([...two.slice(0, 1), { day: "2026-11-23", kind: "pause" }, { day: "2026-11-24", kind: "qada" }], TODAY, 6)).toBe(1);
  });
  it("never a future day nor further than a month back; «قضاء» only for a day that went by", () => {
    expect(canMark([], "2026-11-27", "travel", TODAY, 6)).toEqual({ ok: false, reason: "future" });
    expect(canMark([], "2026-10-20", "travel", TODAY, 6)).toEqual({ ok: false, reason: "tooOld" });
    expect(canMark([], TODAY, "qada", TODAY, 6)).toEqual({ ok: false, reason: "notMissed" });
    expect(canMark([], "2026-11-25", "qada", TODAY, 6).ok).toBe(true);
  });
  it("a pause is 1 to 14 days in a row, and can be ended early", () => {
    expect(pauseDays(TODAY, 15)).toBeNull();
    expect(pauseDays(TODAY, 0)).toBeNull();
    expect(pauseDays(TODAY, 3)).toEqual(["2026-11-26", "2026-11-27", "2026-11-28"]);
    const r = applyMark([], { action: "pause", from: TODAY, days: 14 }, TODAY, 6);
    expect("marks" in r && r.marks.length).toBe(14);
    const marks = "marks" in r ? r.marks : [];
    expect(pauseAround(marks, "2026-11-30")).toEqual({ from: TODAY, to: "2026-12-09" });
    const ended = applyMark(marks, { action: "endPause", day: "2026-11-28" }, "2026-11-28", 6);
    expect("marks" in ended && ended.marks.map((m) => m.day)).toEqual(["2026-11-26", "2026-11-27"]);
  });
  it("the device applies the same rules as the server, and reads its copy safely", () => {
    expect(applyMark(two, { action: "set", day: TODAY, kind: "shari" }, TODAY, 6)).toEqual({ refused: "weekFull" });
    const r = applyMark(two, { action: "clear", day: "2026-11-23" }, TODAY, 6);
    expect("marks" in r && r.marks).toEqual([two[0]]);
    expect(cleanMarks([{ day: "2026-11-24", kind: "nope" }, { day: "x", kind: "travel" }, { day: "2026-11-24", kind: "travel" }, { day: "2026-11-24", kind: "qada" }])).toEqual([
      { day: "2026-11-24", kind: "qada" },
    ]);
    expect(cleanMarks("broken")).toEqual([]);
  });
  it("needs SQL 0131, and works on the device before it runs; never a «streak broke» message", () => {
    const sql = read("supabase/migrations/0131_mahdi_day_marks.sql");
    expect(sql).toContain("create table if not exists public.mahdi_day_marks");
    expect(sql).toContain("'travel', 'illness', 'shari', 'pause', 'qada'");
    expect(sql).toContain("enable row level security");
    expect(read("src/lib/mahdi/server/snapshot.ts")).toContain("loadDayMarks(supabase, logsFrom).catch(() => null)");
    expect(read("src/app/api/mahdi/day-marks/route.ts")).toContain("503");
    expect(read("src/components/mahdi/Provider.tsx")).toContain("e.status === 503");
    const ui = read("src/components/mahdi/DayMarks.tsx");
    expect(ui).not.toMatch(/انكسرت|انقطعت/);
    expect(ui).toContain("أبي أقضيه");
  });
});

describe("«نافذة وحدة بس في كل زيارة»", () => {
  it("nothing opens before the person completes something, and only one per visit", () => {
    expect(nextPopup({ acted: false, shown: null }, ["reward"])).toBeNull();
    expect(nextPopup({ acted: true, shown: null }, ["feedback", "readChallenge", "reward"])).toBe("reward");
    expect(nextPopup({ acted: true, shown: null }, ["androidNews", "feedback"])).toBe("feedback");
    expect(nextPopup({ acted: true, shown: "feedback" }, ["reward"])).toBeNull();
    expect(nextPopup({ acted: true, shown: null }, [])).toBeNull();
  });
  it("every layer that opens by itself waits its turn", () => {
    for (const [f, id] of [
      ["src/components/mahdi/RewardReveal.tsx", "reward"],
      ["src/components/mahdi/ReadChallengeInvite.tsx", "readChallenge"],
      ["src/components/mahdi/Feedback.tsx", "feedback"],
      ["src/components/mahdi/AndroidNews.tsx", "androidNews"],
    ]) expect(read(f), f).toContain(`usePopupTurn("${id}"`);
    expect(read("src/lib/mahdi/client/store.ts")).toContain("noteAction()");
  });
});

describe("«اليوم» and «تقدّمي»", () => {
  it("the standard home is the day card and the habits, plus ONE card", () => {
    expect(DEFAULT_WIDGETS).toEqual(["habits", "reading", "quick"]);
    const board = read("src/components/mahdi/HomeBoard.tsx");
    expect(board).toContain('<div className="m-one">');
    expect(board).not.toContain("<SheikhLink");
    // «رتّب» and «الطوارئ» moved inside ⋯
    expect(board).toContain('aria-label="خيارات اليوم"');
    expect(read("src/app/mahdi/mahdi.css")).toContain(".m-one > :not(:first-child) { display: none; }");
  });
  it("three tabs: الأسبوع · الشهر · التقويم; the week report and «قارن» live inside them", () => {
    expect(PROGRESS_TABS.map((x) => x.label)).toEqual(["الأسبوع", "الشهر", "التقويم"]);
    expect(progressTab("/mahdi/progress")).toBe(0);
    expect(progressTab("/mahdi/progress/week")).toBe(0);
    expect(progressTab("/mahdi/progress/compare")).toBe(1);
    expect(progressTab("/mahdi/progress/calendar")).toBe(2);
    expect(read("src/app/mahdi/(app)/progress/month/MonthReport.tsx")).toContain('href="/mahdi/progress/compare"');
  });
  it("the habit page has one action and the rest inside ⋯", () => {
    const page = read("src/app/mahdi/(app)/habits/[id]/page.tsx");
    expect(page).toContain("سجّلها اليوم");
    expect(page).toContain('aria-label="خيارات العادة"');
    expect(page).not.toContain('className="m-btn m-btn-danger"');
  });
});
