"use client";

import { CONSISTENCY_THRESHOLD } from "@config/mahdi";
import { addDays, daySeries, dayStreak, monthSeries, scoreBy, startOfWeek, summarize, weekGoals, weekSeries, weekStreak } from "@/lib/mahdi/engine";
import { fmtDate, fmtMonth, fmtNum, fmtPct, fmtPoints, t } from "@/lib/mahdi/i18n";
import { bySort } from "@/lib/mahdi/client/derive";
import { weekInsights } from "@/lib/mahdi/client/insights";
import DayBars from "@/components/mahdi/DayBars";
import TrendLine from "@/components/mahdi/TrendLine";
import { BarRow, Insights, ProgressTabs, Tile } from "@/components/mahdi/Stats";
import { FeedbackCard } from "@/components/mahdi/Feedback";
import { useMahdi } from "@/components/mahdi/Provider";

/** Overview of all projects: this week, streaks, trends, projects and habits. */
export default function ProgressPage() {
  const { state, timeline } = useMahdi();
  const { snap, today } = state;
  const ws = startOfWeek(today, snap.profile.weekStart);
  const goals = weekGoals(timeline, ws);
  const week = summarize(goals);
  const last = summarize(weekGoals(timeline, addDays(ws, -7)));
  const days = dayStreak(timeline, CONSISTENCY_THRESHOLD);
  const weeks = weekStreak(timeline, CONSISTENCY_THRESHOLD);
  const byProject = scoreBy(goals, (i) => i.projectId);
  const byHabit = scoreBy(goals, (i) => i.itemId);
  const projects = snap.projects.filter((p) => byProject.has(p.id)).sort(bySort);
  const habits = snap.habits.filter((h) => byHabit.has(h.id)).sort((a, b) => (byHabit.get(b.id)!.score ?? 0) - (byHabit.get(a.id)!.score ?? 0));
  const trendW = weekSeries(timeline, today, 12).map((w) => ({ key: w.weekStart, label: fmtDate(w.weekStart), score: w.score }));
  const trendM = monthSeries(timeline, today, 6).map((m) => ({ key: m.monthStart, label: fmtMonth(m.monthStart), score: m.score }));
  const hasData = week.required > 0 || last.required > 0;
  const color = (projectId: string) => snap.projects.find((p) => p.id === projectId)?.color ?? "gold";

  return (
    <div className="space-y-6">
      <h1 className="m-display text-3xl">{t.progress.title}</h1>
      <ProgressTabs />

      {!hasData ? (
        <p className="m-card p-6 text-center m-muted">{t.progress.notEnough}</p>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label={t.progress.weekSoFar} value={fmtPct(week.score)} sub={last.score !== null && week.score !== null ? `${t.progress.lastWeek} ${fmtPct(last.score)} (${fmtPoints((week.score - last.score) * 100)})` : undefined} />
            <Tile label={t.progress.dayStreak} value={t.units.days(days.current)} sub={`${t.progress.best}: ${t.units.days(days.best)}`} />
            <Tile label={t.progress.weekStreak} value={t.units.weeks(weeks.current)} sub={`${t.progress.best}: ${t.units.weeks(weeks.best)}`} />
            <Tile label={t.progress.goalsReached} value={`${fmtNum(week.achieved)} / ${fmtNum(week.required)}`} sub={week.overCount ? `${t.progress.extra}: ${fmtNum(week.overCount)}` : undefined} />
          </section>

          <Insights lines={weekInsights(timeline, projects, snap.habits)} />

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="m-card space-y-3 p-5">
              <h2 className="font-semibold">{t.progress.last7}</h2>
              <DayBars points={daySeries(timeline, today, 7)} today={today} height={140} />
              <p className="text-xs m-muted">{t.progress.consistencyNote}</p>
            </section>
            <section className="m-card space-y-3 p-5">
              <h2 className="font-semibold">{t.reports.weeks}</h2>
              <TrendLine points={trendW} />
            </section>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <section className="m-card space-y-3 p-5">
              <h2 className="font-semibold">{t.progress.byProject}</h2>
              <ul className="space-y-3">
                {projects.map((p) => (
                  <BarRow key={p.id} color={p.color} label={`${p.icon ? `${p.icon} ` : ""}${p.name}`} score={byProject.get(p.id)!.score} href={`/mahdi/projects/${p.id}`} />
                ))}
              </ul>
            </section>
            <section className="m-card space-y-3 p-5 lg:col-span-2">
              <h2 className="font-semibold">{t.progress.byHabit}</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {habits.map((h) => (
                  <BarRow key={h.id} color={color(h.projectId)} label={h.name} score={byHabit.get(h.id)!.score} href={`/mahdi/habits/${h.id}`} extra={byHabit.get(h.id)!.overCount ? `+${byHabit.get(h.id)!.overCount}` : undefined} />
                ))}
              </ul>
            </section>
          </div>

          <section className="m-card space-y-3 p-5">
            <h2 className="font-semibold">{t.reports.monthTotal}</h2>
            <TrendLine points={trendM} />
          </section>
        </>
      )}
      <FeedbackCard place="progress" />
    </div>
  );
}
