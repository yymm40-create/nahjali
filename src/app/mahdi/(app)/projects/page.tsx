"use client";

import Link from "next/link";
import { useState } from "react";
import { dayGoals, scoreBy, startOfWeek, summarize, weekGoals } from "@/lib/mahdi/engine";
import { fmtPct, t } from "@/lib/mahdi/i18n";
import { bySort } from "@/lib/mahdi/client/derive";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import Icon from "@/components/mahdi/Icon";
import ProjectForm from "@/components/mahdi/ProjectForm";
import { useMahdi } from "@/components/mahdi/Provider";

/** All projects with today's and this week's progress; reorder, and the archived ones at the end. */
export default function ProjectsPage() {
  const { state, store, timeline, toast } = useMahdi();
  const [creating, setCreating] = useState(false);
  const { snap, today } = state;
  const active = snap.projects.filter((p) => !p.archivedAt).sort(bySort);
  const archived = snap.projects.filter((p) => p.archivedAt).sort(bySort);
  const todayBy = scoreBy(dayGoals(timeline, today), (i) => i.projectId, "all");
  const weekBy = scoreBy(weekGoals(timeline, startOfWeek(today, snap.profile.weekStart)), (i) => i.projectId);
  const habitCount = (id: string) => snap.habits.filter((h) => h.projectId === id).length;

  async function move(index: number, delta: number) {
    const ids = active.map((p) => p.id);
    const [x] = ids.splice(index, 1);
    ids.splice(index + delta, 0, x);
    // Show the new order at once, then save it
    store.replaceSnapshot({ ...snap, logs: snap.logs, projects: snap.projects.map((p) => (ids.includes(p.id) ? { ...p, sortOrder: ids.indexOf(p.id) } : p)) });
    try {
      await mahdiFetch("/api/mahdi/projects/order", { method: "PUT", json: { ids } });
    } catch (e) {
      toast((e as Error).message);
      store.refresh(true);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="m-display text-3xl">{t.nav.projects}</h1>
        <button type="button" className="m-btn m-btn-primary m-btn-sm" onClick={() => setCreating(true)}>
          <Icon name="plus" size={18} /> {t.project.newTitle}
        </button>
      </header>

      {active.length === 0 && (
        <section className="m-card space-y-3 p-6 text-center">
          <p className="m-muted">{t.home.emptyProjectsHint}</p>
          <button type="button" className="m-btn m-btn-primary" onClick={() => setCreating(true)}>
            <Icon name="plus" /> {t.home.emptyProjects}
          </button>
        </section>
      )}

      <ul className="grid gap-3 md:grid-cols-2">
        {active.map((p, i) => {
          const day = todayBy.get(p.id);
          const week = weekBy.get(p.id) ?? summarize([]);
          return (
            <li key={p.id} className={`m-card p-${p.color} flex items-stretch gap-2 p-2`}>
              <Link href={`/mahdi/projects/${p.id}`} className="min-w-0 flex-1 space-y-2 rounded-2xl p-3">
                <span className="flex items-center gap-2">
                  <span className="m-dot" style={{ background: "var(--pc)" }} />
                  <span className="truncate text-lg font-semibold">
                    {p.icon && <span aria-hidden="true">{p.icon} </span>}
                    {p.name}
                  </span>
                </span>
                <span className="m-num block text-sm m-muted">
                  {t.units.habits(habitCount(p.id))} · {t.project.today} {fmtPct(day?.score ?? null)} · {t.project.week} {fmtPct(week.score)}
                </span>
                <span className="m-bar block" aria-hidden="true">
                  <span style={{ width: `${Math.round((week.score ?? 0) * 100)}%` }} />
                </span>
              </Link>
              <div className="flex flex-col justify-center">
                <button type="button" className="m-icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`${t.project.moveUp}: ${p.name}`}>
                  <Icon name="chevronUp" size={20} />
                </button>
                <button type="button" className="m-icon-btn" disabled={i === active.length - 1} onClick={() => move(i, 1)} aria-label={`${t.project.moveDown}: ${p.name}`}>
                  <Icon name="chevronDown" size={20} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {archived.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold m-muted">{t.project.archivedTitle}</h2>
          <ul className="grid gap-2 md:grid-cols-2">
            {archived.map((p) => (
              <li key={p.id}>
                <Link href={`/mahdi/projects/${p.id}`} className="m-soft flex items-center gap-2 p-3">
                  <Icon name="archive" size={18} />
                  <span className="flex-1 truncate">{p.name}</span>
                  <Icon name="chevronLeft" size={18} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <ProjectForm open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
