import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildTimeline, dayInstance, doneByEmergency, emergencyStats, validEmergencyTarget, type Item, type Version } from "@/lib/mahdi/engine";
import { toItems } from "@/lib/mahdi/client/derive";
import type { Habit } from "@/lib/mahdi/types";

// «خانة الطوارئ»: a counter or an amount habit carries a SMALLER goal for the days the person chooses «اليوم طوارئ». Reaching it is the day's
// goal reached (so scores and streaks hold), shown in its own colour; the week and the month count the days and the habits.

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const CTX = { asOf: "2026-10-29", weekStart: 6 };
const v = (o: Partial<Version> = {}): Version => ({ effectiveFrom: "2026-10-01", measure: "amount", target: 20, unit: "صفحة", freq: "daily", days: [], state: "active", ...o });
const item = (o: Partial<Item> = {}): Item => ({ id: "h1", projectId: "p1", versions: [v()], logs: {}, emergency: { target: 5, days: new Set(["2026-10-28"]) }, ...o });

describe("the engine", () => {
  it("lowers the day's goal only on the days chosen", () => {
    const it1 = item({ logs: { "2026-10-27": 5, "2026-10-28": 5 } });
    const normal = dayInstance(it1, "2026-10-27", CTX)!;
    const em = dayInstance(it1, "2026-10-28", CTX)!;
    expect(normal.target).toBe(20);
    expect(normal.progress).toBe(0.25);
    expect(normal.emergency).toBeUndefined();
    expect(em).toMatchObject({ target: 5, emergency: true, fullTarget: 20, progress: 1 });
    expect(doneByEmergency(em)).toBe(true);
  });

  it("a full day on an emergency day is a normal full day, not an emergency one", () => {
    const em = dayInstance(item({ logs: { "2026-10-28": 25 } }), "2026-10-28", CTX)!;
    expect(em.progress).toBe(1);
    expect(em.over).toBe(20);
    expect(doneByEmergency(em)).toBe(false);
  });

  it("never touches a done / not done habit, nor a number that is not smaller", () => {
    expect(dayInstance(item({ versions: [v({ measure: "check", target: 1 })] }), "2026-10-28", CTX)!.emergency).toBeUndefined();
    expect(dayInstance(item({ emergency: { target: 30, days: new Set(["2026-10-28"]) } }), "2026-10-28", CTX)!.target).toBe(20);
  });

  it("the day's score counts the reduced goal as reached", () => {
    const tl = buildTimeline([item({ logs: { "2026-10-28": 5 } })], "2026-10-28", "2026-10-28", CTX);
    expect(tl.byDay.get("2026-10-28")![0].progress).toBe(1);
  });

  it("validates the number: smaller than the usual goal, a counter or an amount", () => {
    expect(validEmergencyTarget("amount", 20, "5")).toBe(5);
    expect(validEmergencyTarget("amount", 20, 2.46)).toBe(2.5);
    expect(validEmergencyTarget("count", 5, 2.4)).toBe(2);
    expect(validEmergencyTarget("count", 5, 5)).toBeNull();
    expect(validEmergencyTarget("check", 1, 1)).toBeNull();
    expect(validEmergencyTarget("amount", 20, 0)).toBeNull();
    expect(validEmergencyTarget("amount", 20, "x")).toBeNull();
  });
});

describe("the week and the month report", () => {
  it("counts the days, the habits and the ones reached", () => {
    const a = item({ id: "a", logs: { "2026-10-27": 5, "2026-10-28": 5 }, emergency: { target: 5, days: new Set(["2026-10-27", "2026-10-28"]) } });
    const b = item({ id: "b", logs: { "2026-10-28": 1 }, emergency: { target: 5, days: new Set(["2026-10-28"]) } });
    const days = { a: ["2026-10-27", "2026-10-28"], b: ["2026-10-28"] };
    const st = emergencyStats([a, b], days, "2026-10-25", "2026-10-31", CTX);
    expect(st).toMatchObject({ days: 2, habits: 3, distinctHabits: 2, reached: 2 });
    expect(st.dates).toEqual(["2026-10-27", "2026-10-28"]);
    // outside the range nothing counts
    expect(emergencyStats([a, b], days, "2026-11-01", "2026-11-30", CTX).habits).toBe(0);
    expect(emergencyStats([a], undefined, "2026-10-25", "2026-10-31", CTX).habits).toBe(0);
  });

  it("toItems carries the goal and the days of a habit that has an emergency", () => {
    const habit = { id: "h1", projectId: "p1", versions: [v()], emergencyTarget: 5 } as unknown as Habit;
    const plain = { id: "h2", projectId: "p1", versions: [v()] } as unknown as Habit;
    const [a, b] = toItems([habit, plain], {}, { h1: ["2026-10-28"] });
    expect(a.emergency?.target).toBe(5);
    expect([...a.emergency!.days]).toEqual(["2026-10-28"]);
    expect(b.emergency).toBeUndefined();
  });
});

describe("the wiring", () => {
  it("the migration keeps the goal on the habit and the days in an own-rows table", () => {
    const sql = read("supabase/migrations/0098_mahdi_emergency.sql");
    expect(sql).toMatch(/add column if not exists emergency_target numeric/);
    expect(sql).toMatch(/create table if not exists public\.mahdi_emergency_days/);
    expect(sql).toMatch(/enable row level security/);
    expect(sql).toMatch(/user_id = \(select auth\.uid\(\)\)/);
  });

  it("the snapshot loads the days (and works before the SQL runs), and every timeline of the screens carries them", () => {
    expect(read("src/lib/mahdi/server/snapshot.ts")).toMatch(/loadEmergencyDays\(supabase, logsFrom\)\.catch\(\(\) => \(\{\}\)\)/);
    expect(read("src/components/mahdi/Provider.tsx")).toMatch(/toItems\(allHabits, state\.logs, snap\.emergencyDays\)/);
    expect(read("src/app/api/mahdi/rewards/route.ts")).toMatch(/snap\.emergencyDays/);
  });

  it("the route sets the goal for many habits at once and the day for one or more, and refuses a number that is not smaller", () => {
    const route = read("src/app/api/mahdi/emergency/route.ts");
    expect(route).toMatch(/body\.action === "set"/);
    expect(route).toMatch(/body\.action === "day"/);
    expect(route).toMatch(/validEmergencyTarget\(/);
    expect(route).toMatch(/MAX_ITEMS/);
  });

  it("the sheet picks several projects, then the habits and their numbers; the log sheet turns a day into an emergency; the habit shows its colour", () => {
    const setup = read("src/components/mahdi/EmergencySetup.tsx");
    expect(setup).toMatch(/تقدر تختار أكثر من مشروع/);
    expect(setup).toMatch(/\/api\/mahdi\/emergency/);
    expect(read("src/components/mahdi/LogSheet.tsx")).toMatch(/<EmergencyDay /);
    expect(read("src/components/mahdi/HabitRow.tsx")).toMatch(/var\(--m-emergency\)/);
    expect(read("src/components/mahdi/home/DesignQuick.tsx")).toMatch(/data-emergency=\{h\.inst\.emergency/);
    expect(read("src/app/mahdi/mahdi.css")).toMatch(/\[data-emergency="1"\]/);
  });

  it("the buttons: every project, the projects list (several at once) and every habit; the week and the month report", () => {
    expect(read("src/app/mahdi/(app)/projects/[id]/page.tsx")).toMatch(/<EmergencySetup /);
    expect(read("src/app/mahdi/(app)/projects/page.tsx")).toMatch(/<EmergencySetup /);
    expect(read("src/app/mahdi/(app)/habits/[id]/page.tsx")).toMatch(/<EmergencySetup /);
    expect(read("src/app/mahdi/(app)/progress/week/WeekReport.tsx")).toMatch(/<EmergencySummary /);
    expect(read("src/app/mahdi/(app)/progress/month/MonthReport.tsx")).toMatch(/<EmergencySummary /);
  });
});
