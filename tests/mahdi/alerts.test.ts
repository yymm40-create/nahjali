import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_WIDGETS, WIDGETS, weekNoteFor } from "@/lib/mahdi/home-widgets";
import { cleanPlanItem } from "@/lib/mahdi/planner";

const read = (p: string) => readFileSync(p, "utf8");

describe("«ملاحظاتي على يومي» on the home", () => {
  it("is a card, on by default after «آية اليوم»", () => {
    expect(WIDGETS.some((w) => w.id === "dayNote")).toBe(true);
    expect(DEFAULT_WIDGETS.indexOf("dayNote")).toBe(DEFAULT_WIDGETS.indexOf("daily") + 1);
  });
});

describe("«ملاحظاتي على أسبوعي» comes to the home once a week", () => {
  // weeks start on Saturday (6): 2026-10-31 is a Saturday, 2026-11-06 the Friday that ends it
  it("on the first day: about the week that just ended", () => {
    expect(weekNoteFor("2026-10-31", 6, "first")).toBe("2026-10-24");
    expect(weekNoteFor("2026-11-01", 6, "first")).toBeNull();
  });
  it("on the last day: about this week", () => {
    expect(weekNoteFor("2026-11-06", 6, "last")).toBe("2026-10-31");
    expect(weekNoteFor("2026-11-05", 6, "last")).toBeNull();
  });
  it("sits at the top of «حاسبوا أنفسكم» (the week report and the overview)", () => {
    const week = read("src/app/mahdi/(app)/progress/week/WeekReport.tsx");
    expect(week.indexOf('<ReviewNote kind="week"')).toBeLessThan(week.indexOf("s.required === 0"));
    expect(read("src/app/mahdi/(app)/progress/page.tsx")).toContain('<ReviewNote kind="week"');
  });
});

describe("«اجعله تنبيهًا»", () => {
  it("a planner event's alert needs a time", () => {
    expect(cleanPlanItem({ title: "درس", day: "2026-11-01", start: "19:00", remind: true })?.remind).toBe(true);
    expect(cleanPlanItem({ title: "درس", day: "2026-11-01", remind: true })?.remind).toBe(false);
  });
  it("the bell is on habits, priorities, tasks and planner events", () => {
    for (const f of ["HabitRow", "DayPriorities", "DayTasks", "Planner"]) expect(read(`src/components/mahdi/${f}.tsx`)).toContain("<AlertBell");
  });
  it("habit and planner alerts are dispatched every run", () => {
    const route = read("src/app/api/mahdi/notifications/dispatch/route.ts");
    expect(route).toContain("dispatchHabitAlerts(db)");
    expect(route).toContain("dispatchPlanAlerts(db)");
  });
});
