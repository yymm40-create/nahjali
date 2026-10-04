"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { addDays, dayGoals, daySeries, dayScore, dayStreak, daysSinceLastActivity, periodGoalsOn, startOfWeek, weekScore, type ISODate, type Instance } from "@/lib/mahdi/engine";
import { fmtDateLong, fmtHijri, fmtPct, fmtRelativeDay, t } from "@/lib/mahdi/i18n";
import { bySort, CHALLENGE_GROUP, habitStatus, pickPhrase } from "@/lib/mahdi/client/derive";
import type { Project } from "@/lib/mahdi/types";
import { CONSISTENCY_THRESHOLD } from "@config/mahdi";
import ReadingCard from "./ReadingCard";
import DayBars from "./DayBars";
import HabitForm from "./HabitForm";
import HabitRow from "./HabitRow";
import Icon from "./Icon";
import ProgressRing from "./ProgressRing";
import ProjectForm from "./ProjectForm";
import { useMahdi } from "./Provider";
import { useLook } from "./ThemeRoot";

/** The daily screen: today on the home page, or any earlier day (clearly marked) at /mahdi/day/[date]. */
export default function DayView({ date: requested, home = false }: { date?: ISODate; home?: boolean }) {
  const { state, items, allHabits, timeline } = useMahdi();
  const { theme, shrine } = useLook();
  const { today, snap } = state;
  const date = requested && requested < today ? requested : today;
  const isToday = date === today;
  const { profile } = snap;
  const [newProject, setNewProject] = useState(false);
  const [newHabitIn, setNewHabitIn] = useState<string | null>(null);

  const projects = useMemo(() => snap.projects.filter((p) => !p.archivedAt).sort(bySort), [snap.projects]);
  const habitById = useMemo(() => new Map(allHabits.map((h) => [h.id, h])), [allHabits]);
  const day = dayGoals(timeline, date);
  const periods = periodGoalsOn(timeline, date);
  const score = dayScore(timeline, date);
  const doneCount = day.filter((i) => i.progress >= 1).length;
  const streak = dayStreak(timeline, CONSISTENCY_THRESHOLD);
  const week = weekScore(timeline, startOfWeek(today, profile.weekStart));
  const last7 = daySeries(timeline, today, 7);
  const paused = snap.habits.filter((h) => habitStatus(h, today) === "paused").length;
  const away = daysSinceLastActivity(items, today);
  const allDone = score.required > 0 && doneCount === score.required;
  const phrase = pickPhrase(snap.phrases, allDone ? "day_complete" : away !== null && away >= 3 ? "comeback" : "home", date + profile.userId);

  const challengeGroup: Project = { id: CHALLENGE_GROUP, name: t.challenges.title, icon: "🕌", color: "gold", sortOrder: 9999, archivedAt: null };
  const hasChallenges = allHabits.some((h) => h.projectId === CHALLENGE_GROUP);
  const groups = [...projects, ...(hasChallenges ? [challengeGroup] : [])]
    .map((p) => ({
      project: p,
      day: day.filter((i) => i.projectId === p.id).sort((a, b) => habitById.get(a.itemId)!.sortOrder - habitById.get(b.itemId)!.sortOrder),
      periods: periods.filter((i) => i.projectId === p.id),
      hasHabits: allHabits.some((h) => h.projectId === p.id),
    }))
    .filter((g) => g.day.length || g.periods.length || !g.hasHabits);

  const row = (i: Instance) => {
    const h = habitById.get(i.itemId);
    return h ? <HabitRow key={i.key} habit={h} inst={i} date={date} project={projects.find((p) => p.id === h.projectId) ?? challengeGroup} /> : null;
  };

  return (
    <div className="space-y-6">
      {/* Greeting / date header */}
      <header className={home && theme !== "minimal" ? "flex min-h-[28vh] flex-col justify-end pt-6 lg:min-h-[30vh]" : ""}>
        {home && theme === "minimal" && shrine?.imageUrl && (
          <div className="relative mb-5 h-44 overflow-hidden rounded-3xl sm:h-56">
            <Image src={shrine.imageUrl} alt={shrine.imageAlt} fill sizes="(min-width: 1024px) 820px, 100vw" className="object-cover" style={{ objectPosition: shrine.imagePosition }} />
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 45%, rgba(250,246,238,0.85))" }} />
          </div>
        )}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="m-num m-shadow-text text-sm m-muted">
              {fmtDateLong(date)}
              {profile.showHijri && <> · {fmtHijri(date, profile.hijriOffset)}</>}
            </p>
            {home ? (
              <>
                <h1 className="m-display m-shadow-text text-[1.75rem] sm:text-4xl">{t.greeting}</h1>
                <p className="m-shadow-text font-semibold m-gold">{t.mawla(profile.displayName)}</p>
              </>
            ) : (
              <h1 className="m-display text-3xl">{fmtRelativeDay(date, today)}</h1>
            )}
          </div>
        </div>
        <nav className="mt-3 flex items-center gap-2" aria-label={t.home.otherDays}>
          <Link href={`/mahdi/day/${addDays(date, -1)}`} className="m-btn m-btn-ghost m-btn-sm" aria-label={t.common.previousDay}>
            <Icon name="chevronRight" size={18} /> {t.common.previousDay}
          </Link>
          {!isToday && (
            <>
              <Link href={addDays(date, 1) === today ? "/mahdi" : `/mahdi/day/${addDays(date, 1)}`} className="m-btn m-btn-ghost m-btn-sm">
                {t.common.nextDay} <Icon name="chevronLeft" size={18} />
              </Link>
              <Link href="/mahdi" className="m-btn m-btn-quiet m-btn-sm">{t.home.backToToday}</Link>
            </>
          )}
        </nav>
      </header>

      {!isToday && (
        <p className="m-note flex items-center gap-2 font-semibold" role="status">
          <Icon name="calendar" size={18} /> {t.home.editingPast(fmtRelativeDay(date, today))}
        </p>
      )}

      {home && <ReadingCard />}

      {projects.length === 0 ? (
        <section className="m-card space-y-3 p-6 text-center">
          <p className="m-muted">{t.home.emptyProjectsHint}</p>
          <button type="button" className="m-btn m-btn-primary" onClick={() => setNewProject(true)}>
            <Icon name="plus" /> {t.home.emptyProjects}
          </button>
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <div className="space-y-5">
            {/* Today's progress */}
            <section className="m-card flex items-center gap-5 p-5" aria-label={t.home.todayProgress}>
              <ProgressRing value={score.score ?? 0} size={104} stroke={9} label={`${t.home.todayProgress}: ${fmtPct(score.score)}`}>
                <span className="m-num text-2xl font-semibold">{fmtPct(score.score)}</span>
              </ProgressRing>
              <div className="min-w-0 space-y-1.5">
                <p className="m-eyebrow">{isToday ? t.home.todayProgress : fmtRelativeDay(date, today)}</p>
                {score.required ? (
                  <p className="m-num font-semibold">
                    {t.home.done} {doneCount} · {t.home.left} {score.required - doneCount}
                  </p>
                ) : (
                  <p className="m-muted">{t.home.noGoalsToday}</p>
                )}
                {allDone && <p className="m-chip m-chip-success"><Icon name="check" size={14} /> {t.home.allDone}</p>}
                {isToday && phrase && <p className="text-sm m-muted">{phrase.text}</p>}
              </div>
            </section>

            {/* Habits by project */}
            {groups.map(({ project: p, day: d, periods: pr, hasHabits }) => (
              <section key={p.id} className={`m-card p-${p.color} px-4 py-3 ${profile.viewMode === "compact" ? "m-compact" : ""}`} aria-labelledby={`g-${p.id}`}>
                <div className="flex items-center gap-2">
                  <span className="m-dot" style={{ background: "var(--pc)" }} />
                  <h2 id={`g-${p.id}`} className="flex-1 truncate font-semibold">
                    <Link href={p.id === CHALLENGE_GROUP ? "/mahdi/challenges" : `/mahdi/projects/${p.id}`}>{p.icon && <span aria-hidden="true">{p.icon} </span>}{p.name}</Link>
                  </h2>
                  {p.id !== CHALLENGE_GROUP && (
                    <button type="button" className="m-icon-btn" aria-label={t.add.habitIn(p.name)} onClick={() => setNewHabitIn(p.id)}>
                      <Icon name="plus" size={20} />
                    </button>
                  )}
                </div>
                {!hasHabits && (
                  <button type="button" className="m-btn m-btn-ghost mt-2 w-full" onClick={() => setNewHabitIn(p.id)}>
                    <Icon name="plus" /> {t.home.emptyHabits}
                  </button>
                )}
                {d.length > 0 && <ul className="divide-y" style={{ borderColor: "var(--m-line)" }}>{d.map(row)}</ul>}
                {pr.length > 0 && (
                  <>
                    <p className="m-eyebrow mt-2">{t.home.periodGoals}</p>
                    <ul>{pr.map(row)}</ul>
                  </>
                )}
              </section>
            ))}
            {paused > 0 && <p className="text-sm m-muted">{t.home.hiddenPaused(paused)} · <Link href="/mahdi/projects" className="underline">{t.nav.projects}</Link></p>}
          </div>

          {/* Side: streak and the week */}
          <aside className="space-y-5">
            <section className="m-card space-y-3 p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{t.home.weekSoFar}</h2>
                <span className="m-num text-xl font-semibold m-gold">{fmtPct(week.score)}</span>
              </div>
              <DayBars points={last7} today={today} />
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5">
                  <Icon name="streak" size={18} className="m-gold" /> {t.home.streak}: {t.units.days(streak.current)}
                </span>
                <Link href="/mahdi/progress" className="m-gold font-semibold">{t.home.seeProgress}</Link>
              </div>
            </section>
          </aside>
        </div>
      )}

      <ProjectForm open={newProject} onClose={() => setNewProject(false)} />
      <HabitForm open={newHabitIn !== null} onClose={() => setNewHabitIn(null)} projectId={newHabitIn ?? undefined} />
    </div>
  );
}
