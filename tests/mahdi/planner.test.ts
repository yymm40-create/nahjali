import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cleanGrowItem, cleanPlanItem, itemsOn, occursOn, sortGrow, timeText, type GrowItem, type PlanItem } from "@/lib/mahdi/planner";

const read = (p: string) => readFileSync(p, "utf8");
const item = (o: Partial<PlanItem>): PlanItem => ({ id: "x", title: "t", day: "2026-10-05", start: null, end: null, repeat: "none", note: "", ...o });

describe("the planner: which day an item lands on", () => {
  it("one-off: only its day; never before it", () => {
    expect(occursOn(item({}), "2026-10-05")).toBe(true);
    expect(occursOn(item({}), "2026-10-06")).toBe(false);
  });
  it("weekly: every 7 days from its day, on the same weekday, never before it", () => {
    const w = item({ repeat: "weekly" });
    expect(["2026-10-05", "2026-10-12", "2026-11-02"].every((d) => occursOn(w, d))).toBe(true);
    expect(occursOn(w, "2026-10-13")).toBe(false);
    expect(occursOn(w, "2026-09-28")).toBe(false);
  });
  it("monthly: the same date each month, the last day of a shorter month", () => {
    const m = item({ repeat: "monthly", day: "2026-01-31" });
    expect(occursOn(m, "2026-01-31")).toBe(true);
    expect(occursOn(m, "2026-02-28")).toBe(true);
    expect(occursOn(m, "2026-02-27")).toBe(false);
    expect(occursOn(m, "2026-03-31")).toBe(true);
    expect(occursOn(m, "2025-12-31")).toBe(false);
  });
  it("a day's items: the timed ones by hour first, then the ones with no time", () => {
    const list = [item({ id: "a", title: "بدون وقت" }), item({ id: "b", start: "18:30" }), item({ id: "c", start: "06:00" })];
    expect(itemsOn(list, "2026-10-05").map((i) => i.id)).toEqual(["c", "b", "a"]);
  });
  it("says the time in Arabic digits", () => {
    expect(timeText({ start: "09:30", end: "10:45" })).toBe("٩:٣٠–١٠:٤٥");
    expect(timeText({ start: null, end: null })).toBe("");
  });
});

describe("the planner: what is accepted", () => {
  it("needs a title and a real day; an end before the start is dropped; unknown repeats are one-off", () => {
    expect(cleanPlanItem({ title: "  ", day: "2026-10-05" })).toBeNull();
    expect(cleanPlanItem({ title: "x", day: "5/10" })).toBeNull();
    expect(cleanPlanItem({ title: "x", day: "2026-10-05", start: "18:00", end: "17:00", repeat: "daily" })).toMatchObject({ start: "18:00", end: null, repeat: "none" });
    expect(cleanPlanItem({ title: "x", day: "2026-10-05", start: "25:00" })?.start).toBeNull();
    expect(cleanPlanItem({ title: "x", day: "2026-10-05", end: "10:00" })?.end).toBeNull();
    expect(cleanPlanItem({ title: "x".repeat(500), day: "2026-10-05" })?.title).toHaveLength(80);
  });
});

describe("«تطوّر وازدهر»", () => {
  const g = (o: Partial<GrowItem>): GrowItem => ({ id: "x", title: "t", horizon: "month", note: "", doneAt: null, createdAt: "2026-10-01T00:00:00Z", ...o });
  it("cleans what is sent: a title is needed, the horizon defaults to the month", () => {
    expect(cleanGrowItem({ title: " " })).toBeNull();
    expect(cleanGrowItem({ title: "أحفظ سورة", horizon: "nope" })).toEqual({ title: "أحفظ سورة", horizon: "month", note: "" });
    expect(cleanGrowItem({ title: "a", horizon: "year" })?.horizon).toBe("year");
  });
  it("lists the open ones first (nearest horizon first), then the achieved, the latest first", () => {
    const list = sortGrow([
      g({ id: "done-old", doneAt: "2026-10-02T00:00:00Z" }),
      g({ id: "someday", horizon: "someday" }),
      g({ id: "week", horizon: "week" }),
      g({ id: "done-new", doneAt: "2026-10-09T00:00:00Z" }),
      g({ id: "year", horizon: "year" }),
    ]);
    expect(list.map((i) => i.id)).toEqual(["week", "year", "someday", "done-new", "done-old"]);
  });
});

describe("the wiring", () => {
  it("is private (RLS by the person, no service role), and shown on the calendar's squares, the home and «المزيد»", () => {
    const sql = read("supabase/migrations/0095_grow_planner.sql");
    expect((sql.match(/using \(user_id = auth\.uid\(\)\) with check \(user_id = auth\.uid\(\)\)/g) ?? []).length).toBe(2);
    for (const r of ["grow", "planner"]) expect(read(`src/app/api/mahdi/${r}/route.ts`)).not.toMatch(/createAdminClient/);
    expect(read("src/app/mahdi/(app)/progress/calendar/CalendarView.tsx")).toMatch(/<SquareText items=\{plans\} \/>/);
    expect(read("src/components/mahdi/DayView.tsx")).toMatch(/<GrowCard \/>/);
    expect(read("src/app/mahdi/(app)/more/page.tsx")).toMatch(/<GrowCard \/>/);
  });
});
