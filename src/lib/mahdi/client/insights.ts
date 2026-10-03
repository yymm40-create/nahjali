// Short, gentle analysis sentences built from the numbers (never blaming).
import { addDays, compare, periodOf, previousPeriod, scoreBy, startOfWeek, weekGoals, type Timeline } from "../engine";
import { t } from "../i18n";
import type { Habit, Project } from "../types";

const STEADY_MIN = 0.8;

export function weekInsights(tl: Timeline, projects: Project[], habits: Habit[]): string[] {
  const ws = tl.ctx.weekStart;
  const thisWeek = periodOf("week", tl.ctx.asOf, ws);
  const c = compare(tl, previousPeriod(thisWeek, ws), thisWeek);
  const out: string[] = [];
  if (c.delta !== null) out.push(c.delta >= 3 ? t.insights.weekUp : c.delta <= -3 ? t.insights.weekDown : t.insights.weekSame);

  // A project at ≥ 80% in each of the last three finished weeks
  const last3 = [1, 2, 3].map((k) => scoreBy(weekGoals(tl, addDays(startOfWeek(tl.ctx.asOf, ws), -7 * k)), (i) => i.projectId));
  const steady = projects.find((p) => last3.every((m) => (m.get(p.id)?.score ?? 0) >= STEADY_MIN));
  if (steady) out.push(t.insights.steadyProject(steady.name));

  const name = (id: string) => habits.find((h) => h.id === id)?.name;
  if (c.mostDeclined && name(c.mostDeclined.key)) out.push(t.insights.attention(name(c.mostDeclined.key)!));
  return out.slice(0, 3);
}

export function monthInsight(tl: Timeline): string | null {
  const m = periodOf("month", tl.ctx.asOf, tl.ctx.weekStart);
  const c = compare(tl, previousPeriod(m, tl.ctx.weekStart), m);
  if (c.delta === null) return null;
  return c.delta >= 3 ? t.insights.monthUp : c.delta <= -3 ? t.insights.monthDown : null;
}
