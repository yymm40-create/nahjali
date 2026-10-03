// Checks the «لأجل المهدي» goal engine (no database needed).
// Usage: npx tsx scripts/test-mahdi-engine.mts
import { startOfWeek, todayIn } from "../src/lib/mahdi/engine/dates";
import { buildTimeline, dayInstance } from "../src/lib/mahdi/engine/schedule";
import { dayGoals, dayScore, monthGoals, periodGoalsOn, summarize, weekGoals, weekScore } from "../src/lib/mahdi/engine/score";
import { dayStreak, daysSinceLastActivity, itemStreak, weekStreak } from "../src/lib/mahdi/engine/streaks";
import { compare, periodOf, previousPeriod, recentPeriods } from "../src/lib/mahdi/engine/compare";
import type { EngineContext, Item, Version } from "../src/lib/mahdi/engine/types";

let failures = 0;
const check = (ok: boolean, label: string, detail?: unknown) => {
  console.log(`${ok ? "✅" : "❌"} ${label}${ok || detail === undefined ? "" : `  → got ${JSON.stringify(detail)}`}`);
  if (!ok) failures++;
};
const near = (a: number | null, b: number) => a !== null && Math.abs(a - b) < 1e-9;

const v = (effectiveFrom: string, p: Partial<Version> = {}): Version => ({
  effectiveFrom, measure: "check", target: 1, unit: "", freq: "daily", days: [], state: "active", ...p,
});
const item = (id: string, versions: Version[], logs: Record<string, number> = {}, projectId = "p1"): Item => ({ id, projectId, versions, logs });

// 2026-10-08 is a Thursday; with Saturday as week start the week is Sat 03 … Fri 09.
const ctx: EngineContext = { asOf: "2026-10-08", weekStart: 6 };

// ── dates ──
check(startOfWeek("2026-10-08", 6) === "2026-10-03", "week starting Saturday");
check(startOfWeek("2026-10-08", 0) === "2026-10-04", "week starting Sunday");
check(startOfWeek("2026-10-08", 1) === "2026-10-05", "week starting Monday");
check(todayIn("Asia/Riyadh", new Date("2026-10-03T22:30:00Z")) === "2026-10-04", "today in Riyadh after 9:30pm UTC is the next day");
check(todayIn("America/New_York", new Date("2026-10-03T22:30:00Z")) === "2026-10-03", "today in New York");

// ── 1. daily done/not-done ──
{
  const h = item("h", [v("2026-10-03")], { "2026-10-03": 1, "2026-10-04": 1, "2026-10-06": 1, "2026-10-07": 1 });
  const tl = buildTimeline([h], "2026-09-01", "2026-10-31", ctx);
  check(dayScore(tl, "2026-10-03").score === 1 && dayScore(tl, "2026-10-05").score === 0, "day score: done = 100%, missed = 0%");
  check(dayScore(tl, "2026-10-08").score === 0 && dayScore(tl, "2026-10-08").required === 1, "today's unfinished goal shows 0% in the day view");
  check(near(weekScore(tl, "2026-10-03").score, 0.8), "week so far = 4 of 5 past days (today's unfinished goal not counted yet)", weekScore(tl, "2026-10-03"));
  check(dayScore(tl, "2026-09-20").score === null, "before the habit started there is nothing to measure (no fake 0%)");
  const s = itemStreak(tl, "h");
  check(s.current === 2 && s.best === 2 && s.unit === "day", "streak 2: today is pending, Monday was missed", s);
  const tl2 = buildTimeline([{ ...h, logs: { ...h.logs, "2026-10-08": 1 } }], "2026-09-01", "2026-10-31", ctx);
  check(itemStreak(tl2, "h").current === 3, "logging today extends the streak to 3");
  check(near(weekScore(tl2, "2026-10-03").score, 5 / 6), "a goal finished today counts right away (5 of 6)", weekScore(tl2, "2026-10-03"));
}

// ── 2. counter beyond the goal ──
{
  const h = item("c", [v("2026-10-01", { measure: "count", target: 3 })], { "2026-10-07": 5 });
  const tl = buildTimeline([h], "2026-10-01", "2026-10-31", ctx);
  const i = dayGoals(tl, "2026-10-07")[0];
  check(i.progress === 1 && i.over === 2, "5 of 3: goal reached (100%, not 166%) + 2 extra", i);
  const sc = summarize([i]);
  check(sc.overCount === 1 && near(sc.overRatio, 2 / 3), "overachievement reported separately", sc);
}

// ── 3. amount ──
{
  const h = item("a", [v("2026-10-01", { measure: "amount", target: 20, unit: "صفحة" })], { "2026-10-07": 10 });
  const tl = buildTimeline([h], "2026-10-01", "2026-10-31", ctx);
  check(dayGoals(tl, "2026-10-07")[0].progress === 0.5, "10 of 20 pages = 50%");
}

// ── 4. chosen weekdays (Sat, Mon, Thu) ──
{
  const h = item("d", [v("2026-10-03", { freq: "days", days: [6, 1, 4] })], { "2026-10-03": 1, "2026-10-05": 1 });
  const tl = buildTimeline([h], "2026-10-01", "2026-10-31", ctx);
  const due = ["2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"].map((d) => dayGoals(tl, d).length);
  check(due.join() === "1,0,1,0,0,1", "goals only on Saturday, Monday and Thursday", due);
  check(itemStreak(tl, "d").current === 2, "days in between don't break the streak");
}

// ── 5. "3 times a week" started mid-week ──
{
  const h = item("w", [v("2026-10-07", { measure: "count", target: 3, freq: "weekly" })], { "2026-10-07": 1 });
  const tl = buildTimeline([h], "2026-10-01", "2026-10-31", ctx);
  const wk = tl.byWeek.get("2026-10-03")!;
  check(wk.length === 1 && wk[0].target === 1 && wk[0].partial, "started Wednesday (3 days left) → fair goal of 1 this week", wk);
  check(wk[0].progress === 1 && weekScore(tl, "2026-10-03").required === 1, "reached → counts in the week score now");
  const next = tl.byWeek.get("2026-10-10")!;
  check(next[0].target === 3 && !next[0].partial, "next full week: goal 3");
  check(periodGoalsOn(tl, "2026-10-08").length === 1 && dayGoals(tl, "2026-10-08").length === 0, "visible every day of the week, but not a daily goal");
  const late = item("w2", [v("2026-10-09", { measure: "count", target: 3, freq: "weekly" })]);
  check(buildTimeline([late], "2026-10-01", "2026-10-31", ctx).byWeek.get("2026-10-03")![0].target === 1, "started on the last day → at least 1");
  const over = item("w3", [v("2026-10-03", { measure: "count", target: 3, freq: "weekly" })], { "2026-10-03": 2, "2026-10-05": 3 });
  const o = buildTimeline([over], "2026-10-01", "2026-10-31", ctx).byWeek.get("2026-10-03")![0];
  check(o.value === 5 && o.progress === 1 && o.over === 2, "5 of 3 this week: 100% + 2 extra, the habit stays open", o);
}

// ── 6. changing the goal keeps old periods on the old goal ──
{
  const ctx2: EngineContext = { asOf: "2026-10-08", weekStart: 6 };
  const logs: Record<string, number> = {};
  for (const d of ["2026-09-05", "2026-09-06", "2026-09-07", "2026-09-12", "2026-09-13", "2026-09-14", "2026-09-19", "2026-09-20", "2026-09-21", "2026-09-26", "2026-09-27", "2026-09-28"]) logs[d] = 1;
  const h = item("g", [v("2026-09-05", { measure: "count", target: 3, freq: "weekly" }), v("2026-09-19", { measure: "count", target: 5, freq: "weekly" })], logs);
  const tl = buildTimeline([h], "2026-09-01", "2026-10-31", ctx2);
  const scores = ["2026-09-05", "2026-09-12", "2026-09-19", "2026-09-26"].map((w) => weekScore(tl, w).score);
  check(scores.join() === "1,1,0.6,0.6", "3/week weeks stay 100%; from the change on, 3 of 5 = 60%", scores);
  const mid = item("g2", [v("2026-09-05", { measure: "count", target: 3, freq: "weekly" }), v("2026-09-23", { measure: "count", target: 5, freq: "weekly" })]);
  const m = buildTimeline([mid], "2026-09-01", "2026-10-31", ctx2).byWeek.get("2026-09-19")![0];
  check(m.target === 4 && m.partial, "changed on Wednesday: that week blends 4 days at 3 and 3 days at 5 → 4", m);
  const daily = item("g3", [v("2026-09-01", { measure: "amount", target: 20, unit: "صفحة" }), v("2026-09-10", { measure: "amount", target: 30, unit: "صفحة" })], { "2026-09-09": 20, "2026-09-10": 20 });
  const t3 = buildTimeline([daily], "2026-09-01", "2026-10-31", ctx2);
  check(dayGoals(t3, "2026-09-09")[0].progress === 1 && near(dayGoals(t3, "2026-09-10")[0].progress, 2 / 3), "daily goal change applies from that day only");
}

// ── 7. pause and archive ──
{
  const logs: Record<string, number> = {};
  for (let d = 1; d <= 20; d++) logs[`2026-09-${String(d).padStart(2, "0")}`] = 1;
  const h = item("p", [v("2026-09-01"), v("2026-09-10", { state: "paused" }), v("2026-09-15")], logs);
  const tl = buildTimeline([h], "2026-09-01", "2026-09-20", { asOf: "2026-09-20", weekStart: 6 });
  const count = [...tl.byDay.values()].flat().length;
  check(count === 15, "paused days have no goals (9 before + 6 after)", count);
  check(itemStreak(tl, "p").current === 15, "the pause does not break the streak");
  const a = item("x", [v("2026-09-01"), v("2026-09-10", { state: "archived" })], logs);
  const ta = buildTimeline([a], "2026-09-01", "2026-09-20", { asOf: "2026-09-20", weekStart: 6 });
  check(dayGoals(ta, "2026-09-09").length === 1 && dayGoals(ta, "2026-09-12").length === 0, "archived: past goals kept, none after");
}

// ── 8. monthly, and check-type week goals ──
{
  const h = item("m", [v("2026-09-20", { measure: "count", target: 10, freq: "monthly" })]);
  const t = buildTimeline([h], "2026-09-01", "2026-10-31", ctx).byMonth.get("2026-09-01")![0];
  check(t.target === 4 && t.partial, "10 a month started on the 20th (11 of 30 days) → 4", t);
  const c = item("k", [v("2026-10-08", { measure: "check", target: 7, freq: "weekly" })]);
  const tk = buildTimeline([c], "2026-10-01", "2026-10-31", ctx).byWeek.get("2026-10-03")![0];
  check(tk.target === 2, "every day of the week, started Thursday → 2 days this week", tk);
  const dbl = item("k2", [v("2026-10-03", { measure: "check", target: 2, freq: "weekly" })], { "2026-10-03": 3 });
  check(buildTimeline([dbl], "2026-10-01", "2026-10-31", ctx).byWeek.get("2026-10-03")![0].value === 1, "a done/not-done day counts once, even if logged 3 times");
}

// ── 9. switching measure mid-week makes two separate goals ──
{
  const h = item("s", [v("2026-10-03", { measure: "count", target: 3, freq: "weekly" }), v("2026-10-07", { measure: "amount", target: 70, unit: "دقيقة", freq: "weekly" })], { "2026-10-03": 1, "2026-10-07": 30 });
  const wk = buildTimeline([h], "2026-10-01", "2026-10-31", ctx).byWeek.get("2026-10-03")!;
  check(wk.length === 2 && wk.some((i) => i.measure === "count" && i.target === 2) && wk.some((i) => i.measure === "amount" && i.target === 30), "count part (4 days → 2) and minutes part (3 days → 30)", wk.map((i) => [i.measure, i.target, i.value]));
}

// ── 10. overall streaks, empty data, months ──
{
  const a = item("a", [v("2026-10-01")], { "2026-10-01": 1, "2026-10-02": 1, "2026-10-03": 1, "2026-10-04": 1, "2026-10-05": 1, "2026-10-06": 1, "2026-10-07": 1 });
  const b = item("b", [v("2026-10-01")], { "2026-10-01": 1, "2026-10-02": 1, "2026-10-04": 1, "2026-10-05": 1, "2026-10-06": 1, "2026-10-07": 1 });
  const tl = buildTimeline([a, b], "2026-09-01", "2026-10-31", ctx);
  const ds = dayStreak(tl, 0.8);
  check(ds.current === 4 && ds.best === 4, "overall day streak: 4 days ≥ 80% (Oct 3 was 50%)", ds);
  const empty = buildTimeline([], "2026-09-01", "2026-10-31", ctx);
  check(dayScore(empty, "2026-10-08").score === null && weekScore(empty, "2026-10-03").score === null && dayStreak(empty, 0.8).current === 0, "no habits: no scores, no streak");
  const ws = weekStreak(tl, 0.8);
  check(ws.current >= 1, "week streak counts the current week once it is ≥ 80%", ws);
  const w = item("w", [v("2026-09-26", { measure: "count", target: 2, freq: "weekly" })], { "2026-09-29": 2 });
  const tw = buildTimeline([w], "2026-09-01", "2026-10-31", ctx);
  // week Sat Sep 26 … Fri Oct 2 ends in October → it belongs to October's month report
  check(monthGoals(tw, "2026-10-01").some((i) => i.kind === "week" && i.periodStart === "2026-09-26"), "a week counts in the month it ends in");
  check(weekGoals(tw, "2026-09-26").length === 1, "week goals listed for their week");
  check(daysSinceLastActivity([a, b], "2026-10-08") === 1 && daysSinceLastActivity([], "2026-10-08") === null, "days since last activity");
}

// ── 11. a habit that starts in the future ──
{
  const h = item("f", [v("2026-10-12")]);
  const tl = buildTimeline([h], "2026-10-01", "2026-10-31", ctx);
  check(dayInstance(h, "2026-10-10", ctx) === null && dayGoals(tl, "2026-10-12")[0]?.status === "future", "no goals before the start date; future goals are marked future");
  check(weekScore(tl, "2026-10-10").score === null, "future goals never count");
}

// ── 12. comparing two weeks ──
{
  const logs: Record<string, number> = {};
  // week of Sep 26: 5 of 7 days; week of Oct 3 (so far, to Thu Oct 8): all 5 past days + today
  for (const d of ["2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"]) logs[d] = 1;
  const h = item("c1", [v("2026-09-26")], logs);
  const tl = buildTimeline([h], "2026-09-01", "2026-10-08", ctx);
  const wk = periodOf("week", "2026-10-08", 6);
  const prev = previousPeriod(wk, 6);
  const c = compare(tl, prev, wk);
  check(prev.start === "2026-09-26" && near(c.scoreA.score, 5 / 7) && c.scoreB.score === 1, "week vs previous week scores", [c.scoreA, c.scoreB]);
  check(Math.round(c.delta!) === 29, "difference in percentage points (71% → 100% = +29)", c.delta);
  check(c.mostImproved?.key === "c1" && c.mostDeclined === null, "most improved habit found, none declined");
  const r = recentPeriods("month", "2026-10-08", 6, 3).map((p) => p.start);
  check(r.join() === "2026-10-01,2026-09-01,2026-08-01", "recent months, newest first", r);
  const e = compare(buildTimeline([], "2026-09-01", "2026-10-08", ctx), prev, wk);
  check(e.delta === null, "no data: no fake comparison");
}

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
