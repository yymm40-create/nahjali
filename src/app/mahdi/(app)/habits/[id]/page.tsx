"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { addDays, buildTimeline, itemStreak, startOfWeek, summarize, weekGoals, type HabitState } from "@/lib/mahdi/engine";
import { fmtDate, fmtNum, fmtPct, t, weekdayName } from "@/lib/mahdi/i18n";
import { currentVersion, describeGoal, habitStatus } from "@/lib/mahdi/client/derive";
import ConfirmSheet from "@/components/mahdi/ConfirmSheet";
import HabitForm from "@/components/mahdi/HabitForm";
import Icon from "@/components/mahdi/Icon";
import { useMahdi } from "@/components/mahdi/Provider";

/** One habit: goal, streaks, the last 30 days, the history of its goals, and every control. */
export default function HabitPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { state, store, items, toast } = useMahdi();
  const { snap, today } = state;
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const habit = snap.habits.find((h) => h.id === id);
  const item = items.find((i) => i.id === id);

  if (!habit || !item) {
    return (
      <div className="m-card space-y-4 p-6 text-center">
        <p>{t.errors.notFound}</p>
        <Link href="/mahdi/projects" className="m-btn m-btn-ghost">{t.nav.projects}</Link>
      </div>
    );
  }

  const project = snap.projects.find((p) => p.id === habit.projectId);
  const status = habitStatus(habit, today);
  const v = currentVersion(habit, today)!;
  const tl = buildTimeline([item], snap.logsFrom, today, { asOf: today, weekStart: snap.profile.weekStart });
  const streak = itemStreak(tl, id);
  const week = summarize(weekGoals(tl, startOfWeek(today, snap.profile.weekStart)));
  const unit = (n: number) => (streak.unit === "week" ? t.units.weeks(n) : streak.unit === "month" ? t.units.months(n) : t.units.days(n));
  const days30 = Array.from({ length: 30 }, (_, k) => addDays(today, k - 29));
  const projectArchived = Boolean(project?.archivedAt);

  async function setState(s: HabitState) {
    setBusy(true);
    try {
      await store.mutate(`/api/mahdi/habits/${id}`, "PATCH", { state: s });
      toast(t.common.saved);
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <div className={`p-${project?.color ?? "gold"} space-y-6`}>
      <header className="space-y-2">
        <Link href={project ? `/mahdi/projects/${project.id}` : "/mahdi/projects"} className="m-btn m-btn-quiet m-btn-sm -ms-3">
          <Icon name="chevronRight" size={18} /> {project?.name ?? t.nav.projects}
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="m-display flex-1 text-3xl">
            {habit.icon && <span aria-hidden="true">{habit.icon} </span>}
            {habit.name}
          </h1>
          <button type="button" className="m-icon-btn" onClick={() => setEditing(true)} aria-label={t.habit.editTitle}>
            <Icon name="edit" />
          </button>
        </div>
        <p className="m-muted">{describeGoal(v, snap.profile.weekStart)}</p>
        <div className="flex flex-wrap gap-2">
          {status === "paused" && <span className="m-chip"><Icon name="pause" size={14} /> {t.habit.paused}</span>}
          {status === "archived" && <span className="m-chip"><Icon name="archive" size={14} /> {t.habit.archived}</span>}
          {status === "future" && <span className="m-chip">{t.habit.startsOn(fmtDate(habit.versions[0].effectiveFrom))}</span>}
          {habit.category && <span className="m-chip">{habit.category}</span>}
        </div>
        {habit.notes && <p className="m-soft whitespace-pre-line p-3 text-sm">{habit.notes}</p>}
      </header>

      <section className="grid grid-cols-3 gap-3">
        {[
          [t.habit.streak, unit(streak.current)],
          [t.habit.bestStreak, unit(streak.best)],
          [t.habit.thisWeekScore, fmtPct(week.score)],
        ].map(([label, value]) => (
          <div key={label} className="m-card p-4">
            <p className="m-eyebrow">{label}</p>
            <p className="m-num text-xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="m-card space-y-3 p-5">
        <h2 className="font-semibold">{t.habit.last30}</h2>
        <ol className="grid grid-cols-10 gap-1.5">
          {days30.map((d) => {
            const inst = tl.byDay.get(d)?.[0];
            const value = item.logs[d] ?? 0;
            const label = `${weekdayName(d)} ${fmtDate(d)}: ${inst ? fmtPct(inst.progress) : value ? fmtNum(value) : "—"}`;
            return (
              <li key={d}>
                <Link
                  href={d === today ? "/mahdi" : `/mahdi/day/${d}`}
                  title={label}
                  aria-label={label}
                  className="grid aspect-square place-items-center rounded-lg text-[10px] font-semibold"
                  style={{
                    background: inst ? `color-mix(in srgb, var(--pc) ${Math.round(inst.progress * 85) + 8}%, var(--m-track))` : value ? "color-mix(in srgb, var(--pc) 35%, var(--m-track))" : "var(--m-surface-2)",
                    outline: d === today ? "2px solid var(--m-gold)" : undefined,
                    color: inst && inst.progress >= 1 ? "#fff" : "var(--m-muted)",
                  }}
                >
                  {inst && inst.progress >= 1 ? <Icon name="check" size={12} strokeWidth={3} /> : !inst && !value ? "·" : ""}
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="m-card space-y-2 p-5">
        <h2 className="font-semibold">{t.habit.versions}</h2>
        <ol className="space-y-2 text-sm">
          {[...habit.versions].reverse().map((ver) => (
            <li key={ver.effectiveFrom} className="m-soft flex flex-wrap items-center justify-between gap-2 p-3">
              <span>{describeGoal(ver, snap.profile.weekStart)}</span>
              <span className="m-muted">
                {t.habit.versionFrom(fmtDate(ver.effectiveFrom))}
                {ver.state === "paused" ? ` · ${t.habit.paused}` : ver.state === "archived" ? ` · ${t.habit.archived}` : ""}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-wrap gap-3">
        {!projectArchived && status !== "archived" && (
          <button type="button" className="m-btn m-btn-ghost" disabled={busy} onClick={() => setState(status === "paused" ? "active" : "paused")}>
            <Icon name={status === "paused" ? "play" : "pause"} /> {status === "paused" ? t.habit.actions.resume : t.habit.actions.pause}
          </button>
        )}
        {!projectArchived && (
          <button type="button" className="m-btn m-btn-ghost" disabled={busy} onClick={() => setState(status === "archived" ? "active" : "archived")}>
            <Icon name="archive" /> {status === "archived" ? t.habit.actions.unarchive : t.habit.actions.archive}
          </button>
        )}
        <button type="button" className="m-btn m-btn-danger" onClick={() => setDeleting(true)}>
          <Icon name="trash" /> {t.habit.actions.delete}
        </button>
      </section>
      {projectArchived && <p className="m-note text-sm">{t.errors.archivedProject}</p>}

      <HabitForm open={editing} onClose={() => setEditing(false)} habit={habit} />
      <ConfirmSheet
        open={deleting}
        onClose={() => setDeleting(false)}
        title={t.habit.deleteTitle(habit.name)}
        body={t.habit.deleteBody}
        onConfirm={async () => {
          await store.mutate(`/api/mahdi/habits/${id}`, "DELETE");
          router.replace(project ? `/mahdi/projects/${project.id}` : "/mahdi/projects");
        }}
      />
    </div>
  );
}
