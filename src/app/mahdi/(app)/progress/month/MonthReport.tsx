"use client";

import Link from "next/link";
import { CONSISTENCY_THRESHOLD } from "@config/mahdi";
import { addDays, addMonths, compare, dayScore, eachDay, endOfMonth, minDate, periodOf, previousPeriod, scoreBy, startOfMonth, startOfWeek, weekScore } from "@/lib/mahdi/engine";
import { fmtDate, fmtMonth, fmtNum, fmtPct, fmtPoints, t } from "@/lib/mahdi/i18n";
import { bySort, itemHref, pickPhrase } from "@/lib/mahdi/client/derive";
import { monthInsight } from "@/lib/mahdi/client/insights";
import Icon from "@/components/mahdi/Icon";
import { BarRow, Delta, Insights, ProgressTabs, Tile } from "@/components/mahdi/Stats";
import { useMahdi } from "@/components/mahdi/Provider";
import { periodGoals } from "@/lib/mahdi/engine";

/** One month, top to bottom: the score, weeks, projects, habits, goals, extra work and the previous month. */
export default function MonthReport({ month }: { month?: string }) {
  const { state, timeline } = useMahdi();
  const { snap, today } = state;
  const wsDay = snap.profile.weekStart;
  const current = startOfMonth(today);
  const ms = month && /^\d{4}-\d{2}$/.test(month) && `${month}-01` <= current ? `${month}-01` : current;
  const period = periodOf("month", ms, wsDay);
  const c = compare(timeline, previousPeriod(period, wsDay), period);
  const s = c.scoreB;
  const goals = periodGoals(timeline, period);
  const isCurrent = ms === current;
  const name = (id: string) => snap.habits.find((h) => h.id === id)?.name ?? "";
  const byProject = scoreBy(goals, (i) => i.projectId);
  const byHabit = scoreBy(goals, (i) => i.itemId);

  // Weeks that touch this month
  const weeks: string[] = [];
  for (let w = startOfWeek(ms, wsDay); w <= endOfMonth(ms); w = addDays(w, 7)) weeks.push(w);

  // Consistency: days with goals, and how many reached the threshold
  let withGoals = 0;
  let steady = 0;
  for (const d of eachDay(ms, minDate(endOfMonth(ms), today))) {
    const sc = dayScore(timeline, d).score;
    if (sc === null) continue;
    withGoals++;
    if (sc >= CONSISTENCY_THRESHOLD) steady++;
  }
  const phrase = pickPhrase(snap.phrases, "monthly", ms + snap.profile.userId);
  const insight = isCurrent ? monthInsight(timeline) : null;
  const ym = (d: string) => d.slice(0, 7);

  return (
    <div className="space-y-6">
      <h1 className="m-display text-3xl">{t.reports.month}</h1>
      <ProgressTabs />

      <nav className="flex items-center justify-between gap-2" aria-label={t.reports.month}>
        <Link href={`/mahdi/progress/month?m=${ym(addMonths(ms, -1))}`} className="m-btn m-btn-ghost m-btn-sm">
          <Icon name="chevronRight" size={18} /> {t.reports.prev}
        </Link>
        <span className="font-semibold">{fmtMonth(ms)}</span>
        {isCurrent ? (
          <span className="w-20" />
        ) : (
          <Link href={`/mahdi/progress/month?m=${ym(addMonths(ms, 1))}`} className="m-btn m-btn-ghost m-btn-sm">
            {t.reports.next} <Icon name="chevronLeft" size={18} />
          </Link>
        )}
      </nav>

      {s.required === 0 ? (
        <p className="m-card p-6 text-center m-muted">{t.reports.noData}</p>
      ) : (
        <>
          <section className="m-card flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <p className="m-eyebrow">
                {t.reports.monthTotal}
                {isCurrent && ` (${t.reports.soFar})`}
              </p>
              <p className="m-num m-gold text-4xl font-semibold">{fmtPct(s.score)}</p>
            </div>
            {c.scoreA.score !== null && (
              <p className="text-sm">
                {t.reports.vsPrevMonth}: <Delta a={c.scoreA.score} b={s.score} delta={c.delta} />
              </p>
            )}
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label={t.reports.requiredVsDone} value={t.reports.reached(s.achieved, s.required)} />
            <Tile label={t.progress.dayStreak} value={withGoals ? t.reports.consistentDays(steady, withGoals) : "—"} />
            <Tile label={t.reports.extra} value={fmtNum(s.overCount)} sub={s.overCount ? t.reports.extraTimes(s.overCount) : undefined} />
            <Tile label={t.reports.vsPrevMonth} value={c.delta === null ? "—" : fmtPoints(c.delta)} />
          </section>

          {insight && <Insights lines={[insight]} />}
          {phrase && <p className="text-center m-muted">{phrase.text}</p>}

          <section className="m-card space-y-3 p-5">
            <h2 className="font-semibold">{t.reports.weeks}</h2>
            <ul className="space-y-3">
              {weeks.map((w) => (
                <BarRow key={w} label={t.reports.weekOf(fmtDate(w))} score={w > today ? null : weekScore(timeline, w).score} href={`/mahdi/progress/week?start=${w}`} />
              ))}
            </ul>
          </section>

          {(c.mostImproved || c.mostDeclined) && (
            <section className="grid gap-3 sm:grid-cols-2">
              {c.mostImproved && (
                <div className="m-card p-4">
                  <p className="m-eyebrow">{t.reports.improved}</p>
                  <p className="font-semibold">{name(c.mostImproved.key)}</p>
                  <Delta a={c.mostImproved.a} b={c.mostImproved.b} delta={c.mostImproved.delta} />
                </div>
              )}
              {c.mostDeclined && (
                <div className="m-card p-4">
                  <p className="m-eyebrow">{t.reports.declined}</p>
                  <p className="font-semibold">{name(c.mostDeclined.key)}</p>
                  <Delta a={c.mostDeclined.a} b={c.mostDeclined.b} delta={c.mostDeclined.delta} />
                </div>
              )}
            </section>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="m-card space-y-3 p-5">
              <h2 className="font-semibold">{t.reports.projects}</h2>
              <ul className="space-y-3">
                {snap.projects
                  .filter((p) => byProject.has(p.id))
                  .sort(bySort)
                  .map((p) => (
                    <BarRow key={p.id} color={p.color} label={`${p.icon ? `${p.icon} ` : ""}${p.name}`} score={byProject.get(p.id)!.score} />
                  ))}
              </ul>
            </section>
            <section className="m-card space-y-3 p-5">
              <h2 className="font-semibold">{t.reports.habits}</h2>
              <ul className="space-y-3">
                {[...byHabit]
                  .sort((a, b) => (b[1].score ?? 0) - (a[1].score ?? 0))
                  .map(([id, sc]) => (
                    <BarRow key={id} label={name(id)} score={sc.score} href={itemHref(id)} extra={`${sc.achieved}/${sc.required}`} />
                  ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
