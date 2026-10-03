"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { CONSISTENCY_THRESHOLD } from "@config/mahdi";
import { buildTimeline, dayScore, dayStreak, startOfWeek, summarize, weekGoals } from "@/lib/mahdi/engine";
import { fmtPct, t } from "@/lib/mahdi/i18n";
import { bySort, currentVersion, describeGoal, habitStatus } from "@/lib/mahdi/client/derive";
import ConfirmSheet from "@/components/mahdi/ConfirmSheet";
import DayBars from "@/components/mahdi/DayBars";
import HabitForm from "@/components/mahdi/HabitForm";
import Icon from "@/components/mahdi/Icon";
import ProjectForm from "@/components/mahdi/ProjectForm";
import { useMahdi } from "@/components/mahdi/Provider";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { daySeries } from "@/lib/mahdi/engine";

/** One project: its own progress, streak and habits, plus edit / archive / delete. */
export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { state, store, items, toast } = useMahdi();
  const { snap, today } = state;
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const project = snap.projects.find((p) => p.id === id);

  if (!project) {
    return (
      <div className="m-card space-y-4 p-6 text-center">
        <p>{t.errors.notFound}</p>
        <Link href="/mahdi/projects" className="m-btn m-btn-ghost">{t.nav.projects}</Link>
      </div>
    );
  }

  const habits = snap.habits.filter((h) => h.projectId === id).sort(bySort);
  const ctx = { asOf: today, weekStart: snap.profile.weekStart };
  // This project's own timeline: its scores and streak count only its habits
  const tl = buildTimeline(items.filter((i) => i.projectId === id), snap.logsFrom, today, ctx);
  const todayScore = dayScore(tl, today);
  const week = summarize(weekGoals(tl, startOfWeek(today, snap.profile.weekStart)));
  const streak = dayStreak(tl, CONSISTENCY_THRESHOLD);
  const groups = {
    active: habits.filter((h) => ["active", "future"].includes(habitStatus(h, today))),
    paused: habits.filter((h) => habitStatus(h, today) === "paused"),
    archived: habits.filter((h) => habitStatus(h, today) === "archived"),
  };
  const archived = Boolean(project.archivedAt);

  async function setArchived(value: boolean) {
    setBusy(true);
    try {
      await store.mutate(`/api/mahdi/projects/${id}`, "PATCH", { archived: value });
      toast(t.common.saved);
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  }

  async function move(index: number, delta: number) {
    const ids = groups.active.map((h) => h.id);
    const [x] = ids.splice(index, 1);
    ids.splice(index + delta, 0, x);
    store.replaceSnapshot({ ...snap, habits: snap.habits.map((h) => (ids.includes(h.id) ? { ...h, sortOrder: ids.indexOf(h.id) } : h)) });
    try {
      await mahdiFetch("/api/mahdi/habits/order", { method: "PUT", json: { ids } });
    } catch (e) {
      toast((e as Error).message);
      store.refresh(true);
    }
  }

  const habitLine = (h: (typeof habits)[number], index?: number) => {
    const v = currentVersion(h, today);
    return (
      <li key={h.id} className="flex items-center gap-2 py-2">
        <Link href={`/mahdi/habits/${h.id}`} className="min-w-0 flex-1 rounded-xl p-1">
          <span className="block truncate font-semibold">
            {h.icon && <span aria-hidden="true">{h.icon} </span>}
            {h.name}
          </span>
          <span className="block truncate text-sm m-muted">{v ? describeGoal(v, snap.profile.weekStart) : ""}</span>
        </Link>
        {index !== undefined && (
          <>
            <button type="button" className="m-icon-btn" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`${t.project.moveUp}: ${h.name}`}>
              <Icon name="chevronUp" size={20} />
            </button>
            <button type="button" className="m-icon-btn" disabled={index === groups.active.length - 1} onClick={() => move(index, 1)} aria-label={`${t.project.moveDown}: ${h.name}`}>
              <Icon name="chevronDown" size={20} />
            </button>
          </>
        )}
      </li>
    );
  };

  return (
    <div className={`p-${project.color} space-y-6`}>
      <header className="space-y-2">
        <Link href="/mahdi/projects" className="m-btn m-btn-quiet m-btn-sm -ms-3">
          <Icon name="chevronRight" size={18} /> {t.nav.projects}
        </Link>
        <div className="flex items-center gap-3">
          <span className="m-dot size-3" style={{ background: "var(--pc)" }} />
          <h1 className="m-display flex-1 truncate text-3xl">
            {project.icon && <span aria-hidden="true">{project.icon} </span>}
            {project.name}
          </h1>
          <button type="button" className="m-icon-btn" onClick={() => setEditing(true)} aria-label={t.project.editTitle}>
            <Icon name="edit" />
          </button>
        </div>
        {archived && <p className="m-note text-sm">{t.project.archivedNote}</p>}
      </header>

      <section className="grid gap-3 sm:grid-cols-3" aria-label={t.project.stats}>
        {[
          [t.project.today, fmtPct(todayScore.score)],
          [t.project.week, fmtPct(week.score)],
          [t.project.streak, t.units.days(streak.current)],
        ].map(([label, value]) => (
          <div key={label} className="m-card p-4">
            <p className="m-eyebrow">{label}</p>
            <p className="m-num text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="m-card space-y-2 p-5">
        <h2 className="font-semibold">{t.home.last7}</h2>
        <DayBars points={daySeries(tl, today, 7)} today={today} />
      </section>

      <section className="m-card px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t.project.habits}</h2>
          {!archived && (
            <button type="button" className="m-btn m-btn-ghost m-btn-sm" onClick={() => setAdding(true)}>
              <Icon name="plus" size={18} /> {t.project.addHabit}
            </button>
          )}
        </div>
        {habits.length === 0 && (
          <button type="button" className="m-btn m-btn-primary my-3 w-full" onClick={() => setAdding(true)} disabled={archived}>
            <Icon name="plus" /> {t.home.emptyHabits}
          </button>
        )}
        <ul className="divide-y" style={{ borderColor: "var(--m-line)" }}>{groups.active.map((h, i) => habitLine(h, archived ? undefined : i))}</ul>
        {groups.paused.length > 0 && (
          <>
            <p className="m-eyebrow mt-3">{t.project.pausedHabits}</p>
            <ul>{groups.paused.map((h) => habitLine(h))}</ul>
          </>
        )}
        {groups.archived.length > 0 && (
          <>
            <p className="m-eyebrow mt-3">{t.project.archivedHabits}</p>
            <ul className="opacity-75">{groups.archived.map((h) => habitLine(h))}</ul>
          </>
        )}
      </section>

      <section className="flex flex-wrap gap-3">
        <button type="button" className="m-btn m-btn-ghost" disabled={busy} onClick={() => setArchived(!archived)}>
          <Icon name="archive" /> {archived ? t.project.unarchive : t.project.archive}
        </button>
        <button type="button" className="m-btn m-btn-danger" onClick={() => setDeleting(true)}>
          <Icon name="trash" /> {t.common.delete}
        </button>
      </section>

      <ProjectForm open={editing} onClose={() => setEditing(false)} project={project} />
      <HabitForm open={adding} onClose={() => setAdding(false)} projectId={project.id} />
      <ConfirmSheet
        open={deleting}
        onClose={() => setDeleting(false)}
        title={t.project.deleteTitle(project.name)}
        body={t.project.deleteBody}
        onConfirm={async () => {
          await store.mutate(`/api/mahdi/projects/${id}`, "DELETE");
          router.replace("/mahdi/projects");
        }}
      />
    </div>
  );
}
