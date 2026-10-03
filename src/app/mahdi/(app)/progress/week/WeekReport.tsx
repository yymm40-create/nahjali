"use client";

import Link from "next/link";
import { CONSISTENCY_THRESHOLD } from "@config/mahdi";
import { addDays, bestAndWeakest, compare, dayScore, isISODate, periodOf, previousPeriod, scoreBy, startOfWeek, weekGoals, weekStreak } from "@/lib/mahdi/engine";
import { fmtDate, fmtNum, fmtPct, t, weekdayName } from "@/lib/mahdi/i18n";
import { bySort, pickPhrase } from "@/lib/mahdi/client/derive";
import { weekInsights } from "@/lib/mahdi/client/insights";
import Icon from "@/components/mahdi/Icon";
import { BarRow, Delta, Insights, ProgressTabs, Tile } from "@/components/mahdi/Stats";
import { useMahdi } from "@/components/mahdi/Provider";

/** One week: each day on its own, then the overall score, projects, habits, streak and the previous week. */
export default function WeekReport({ start }: { start?: string }) {
  const { state, timeline } = useMahdi();
  const { snap, today } = state;
  const wsDay = snap.profile.weekStart;
  const current = startOfWeek(today, wsDay);
  const ws = start && isISODate(start) ? startOfWeek(start, wsDay) : current;
  const week = periodOf("week", ws, wsDay);
  const c = compare(timeline, previousPeriod(week, wsDay), week);
  const goals = weekGoals(timeline, ws);
  const s = c.scoreB;
  const isCurrent = ws === current;
  const days = Array.from({ length: 7 }, (_, k) => addDays(ws, k));
  const byProject = scoreBy(goals, (i) => i.projectId);
  const byHabit = scoreBy(goals, (i) => i.itemId);
  const { best, weakest } = bestAndWeakest(goals);
  const name = (id: string) => snap.habits.find((h) => h.id === id)?.name ?? "";
  const streak = weekStreak(timeline, CONSISTENCY_THRESHOLD);
  const phrase = pickPhrase(snap.phrases, "weekly", ws + snap.profile.userId);
  const habitColor = (id: string) => snap.projects.find((p) => p.id === snap.habits.find((h) => h.id === id)?.projectId)?.color ?? "gold";

  return (
    <div className="space-y-6">
      <h1 className="m-display text-3xl">{t.reports.week}</h1>
      <ProgressTabs />

      <nav className="flex items-center justify-between gap-2" aria-label={t.reports.week}>
        <Link href={`/mahdi/progress/week?start=${addDays(ws, -7)}`} className="m-btn m-btn-ghost m-btn-sm">
          <Icon name="chevronRight" size={18} /> {t.reports.prev}
        </Link>
        <span className="m-num font-semibold">{t.reports.weekRange(fmtDate(ws), fmtDate(addDays(ws, 6)))}</span>
        {isCurrent ? (
          <span className="w-20" />
        ) : (
          <Link href={addDays(ws, 7) === current ? "/mahdi/progress/week" : `/mahdi/progress/week?start=${addDays(ws, 7)}`} className="m-btn m-btn-ghost m-btn-sm">
            {t.reports.next} <Icon name="chevronLeft" size={18} />
          </Link>
        )}
      </nav>

      {s.required === 0 ? (
        <p className="m-card p-6 text-center m-muted">{t.reports.noData}</p>
      ) : (
        <>
          <section className="m-card p-5">
            <ul className="divide-y" style={{ borderColor: "var(--m-line)" }}>
              {days.map((d) => {
                const ds = dayScore(timeline, d);
                const future = d > today;
                return (
                  <li key={d}>
                    <Link href={d === today ? "/mahdi" : `/mahdi/day/${d}`} className={`flex items-center gap-3 py-2.5 ${future ? "pointer-events-none opacity-50" : ""}`}>
                      <span className="w-20 shrink-0 font-semibold">{weekdayName(d)}</span>
                      <span className="m-bar flex-1" aria-hidden="true">
                        <span style={{ width: `${Math.round((ds.score ?? 0) * 100)}%` }} />
                      </span>
                      <span className="m-num w-14 text-end font-semibold">{future ? "" : fmtPct(ds.score)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 border-t pt-4" style={{ borderColor: "var(--m-line)" }}>
              <span className="text-lg font-semibold">
                {t.reports.weekTotal}
                {isCurrent && <span className="m-muted text-sm font-normal"> ({t.reports.soFar})</span>}
              </span>
              <span className="m-num m-gold text-3xl font-semibold">{fmtPct(s.score)}</span>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label={t.reports.requiredVsDone} value={t.reports.reached(s.achieved, s.required)} />
            <Tile label={t.reports.vsPrevWeek} value={c.delta === null ? "—" : `${c.delta >= 0 ? "+" : "−"}${Math.abs(Math.round(c.delta))}`} sub={c.scoreA.score !== null ? `${fmtPct(c.scoreA.score)} ← ${fmtPct(s.score)}` : undefined} />
            <Tile label={t.progress.weekStreak} value={t.units.weeks(streak.current)} sub={`${t.progress.best}: ${t.units.weeks(streak.best)}`} />
            <Tile label={t.reports.extra} value={fmtNum(s.overCount)} sub={s.overCount ? t.reports.extraTimes(s.overCount) : undefined} />
          </section>

          {isCurrent && <Insights lines={weekInsights(timeline, snap.projects, snap.habits)} />}
          {phrase && <p className="text-center m-muted">{phrase.text}</p>}

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="m-card space-y-3 p-5">
              <h2 className="font-semibold">{t.reports.projects}</h2>
              <ul className="space-y-3">
                {snap.projects
                  .filter((p) => byProject.has(p.id))
                  .sort(bySort)
                  .map((p) => {
                    const ch = c.projects.find((x) => x.key === p.id);
                    return <BarRow key={p.id} color={p.color} label={`${p.icon ? `${p.icon} ` : ""}${p.name}`} score={byProject.get(p.id)!.score} extra={ch?.delta != null ? `(${ch.delta >= 0 ? "+" : "−"}${Math.abs(Math.round(ch.delta))})` : undefined} />;
                  })}
              </ul>
            </section>
            <section className="m-card space-y-3 p-5">
              <h2 className="font-semibold">{t.reports.habits}</h2>
              {(best || weakest) && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {best && (
                    <p className="m-soft p-3 text-sm">
                      <span className="m-eyebrow block">{t.reports.bestHabit}</span>
                      <span className="font-semibold">{name(best[0])}</span> · <span className="m-num">{fmtPct(best[1].score)}</span>
                    </p>
                  )}
                  {weakest && (
                    <p className="m-soft p-3 text-sm">
                      <span className="m-eyebrow block">{t.reports.weakestHabit}</span>
                      <span className="font-semibold">{name(weakest[0])}</span> · <span className="m-num">{fmtPct(weakest[1].score)}</span>
                    </p>
                  )}
                </div>
              )}
              <ul className="space-y-3">
                {[...byHabit]
                  .sort((a, b) => (b[1].score ?? 0) - (a[1].score ?? 0))
                  .map(([id, sc]) => (
                    <BarRow key={id} color={habitColor(id)} label={name(id)} score={sc.score} href={`/mahdi/habits/${id}`} extra={`${sc.achieved}/${sc.required}`} />
                  ))}
              </ul>
            </section>
          </div>
          {c.scoreA.score !== null && (
            <p className="text-sm m-muted">
              {t.reports.vsPrevWeek}: <Delta a={c.scoreA.score} b={s.score} delta={c.delta} />
            </p>
          )}
        </>
      )}
    </div>
  );
}
