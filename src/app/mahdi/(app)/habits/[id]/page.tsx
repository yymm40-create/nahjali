"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { addDays, buildTimeline, itemStreak, periodGoalsOn, startOfWeek, summarize, weekGoals, type HabitState } from "@/lib/mahdi/engine";
import { fmtDate, fmtNum, fmtPct, t, weekdayName } from "@/lib/mahdi/i18n";
import { currentVersion, describeGoal, habitStatus, habitTint } from "@/lib/mahdi/client/derive";
import ConfirmSheet from "@/components/mahdi/ConfirmSheet";
import EmergencySetup from "@/components/mahdi/EmergencySetup";
import HabitForm from "@/components/mahdi/HabitForm";
import Icon from "@/components/mahdi/Icon";
import LogSheet from "@/components/mahdi/LogSheet";
import { useMahdi } from "@/components/mahdi/Provider";
import Sheet from "@/components/mahdi/Sheet";

/**
 * One habit («تفاصيل» of the redesign): a clear header with ONE action, «سجّل اليوم»; the numbers; a quiet calendar of the last 30
 * days (a missed day soft orange, an excused day lighter, never red); the history of its goals. Edit, emergency, pause, archive
 * and delete live inside ⋯.
 */
export default function HabitPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { state, store, items, toast, timeline } = useMahdi();
  const { snap, today } = state;
  const [menu, setMenu] = useState(false);
  const [logging, setLogging] = useState(false);
  const [editing, setEditing] = useState(false);
  const [emergency, setEmergency] = useState(false);
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
  const excused = timeline.ctx.excused;
  const tl = buildTimeline([item], snap.logsFrom, today, { asOf: today, weekStart: snap.profile.weekStart, excused });
  const streak = itemStreak(tl, id);
  const week = summarize(weekGoals(tl, startOfWeek(today, snap.profile.weekStart)));
  const unit = (n: number) => (streak.unit === "week" ? t.units.weeks(n) : streak.unit === "month" ? t.units.months(n) : t.units.days(n));
  const days30 = Array.from({ length: 30 }, (_, k) => addDays(today, k - 29));
  const projectArchived = Boolean(project?.archivedAt);
  // today's goal (or this week's / month's for a habit counted per period): what «سجّل اليوم» fills
  const todayInst = tl.byDay.get(today)?.[0] ?? periodGoalsOn(tl, today)[0] ?? null;
  const dayValue = state.logs[habit.id]?.[today] ?? 0;
  const doneToday = Boolean(todayInst && todayInst.progress >= 1);
  const commit = (value: number) => {
    const prev = store.setLog(habit.id, today, value);
    try {
      navigator.vibrate?.(8);
    } catch {}
    toast(t.habit.logged(habit.name), { label: t.habit.undo, run: () => store.setLog(habit.id, today, prev) }, habit.id);
  };
  const logToday = () => {
    if (v.measure === "check") commit(dayValue >= 1 ? 0 : 1);
    else if (v.measure === "count") commit(dayValue + 1);
    else setLogging(true);
  };

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
    <div className={`p-${project?.color ?? "gold"} space-y-6`} style={habitTint(habit)}>
      <header className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <h1 className="m-display text-3xl">
              {habit.icon && <span aria-hidden="true">{habit.icon} </span>}
              {habit.name}
            </h1>
            <p className="m-muted">
              {describeGoal(v, snap.profile.weekStart)}
              {project && <> · {project.name}</>}
            </p>
          </div>
          <button type="button" className="m-menu-btn" onClick={() => setMenu(true)} aria-label="خيارات العادة" aria-haspopup="dialog">
            <Icon name="more" size={24} strokeWidth={2.6} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {status === "paused" && <span className="m-chip"><Icon name="pause" size={14} /> {t.habit.paused}</span>}
          {status === "archived" && <span className="m-chip"><Icon name="archive" size={14} /> {t.habit.archived}</span>}
          {status === "future" && <span className="m-chip">{t.habit.startsOn(fmtDate(habit.versions[0].effectiveFrom))}</span>}
          {habit.category && <span className="m-chip">{habit.category}</span>}
          {habit.emergencyTarget && v.measure !== "check" && (
            <span className="m-emergency-chip">
              <Icon name="shield" size={13} /> الطوارئ: {fmtNum(habit.emergencyTarget)} {v.measure === "amount" ? v.unit : "مرة"}
            </span>
          )}
        </div>
        {habit.notes && <p className="m-soft whitespace-pre-line p-3 text-sm">{habit.notes}</p>}
        {/* the one action of this screen */}
        {todayInst && status === "active" && (
          <button type="button" className={`m-btn w-full text-lg ${doneToday && v.measure === "check" ? "m-btn-ghost" : "m-btn-primary"}`} onClick={logToday}>
            <Icon name={doneToday && v.measure === "check" ? "undo" : v.measure === "check" ? "check" : "plus"} />
            {v.measure === "check" ? (doneToday ? "تراجع عن اليوم" : "سجّلها اليوم") : v.measure === "count" ? `سجّل مرة (${fmtNum(dayValue)} اليوم)` : `سجّل اليوم (${fmtNum(dayValue)} ${v.unit})`}
          </button>
        )}
        {status === "paused" && !projectArchived && (
          <button type="button" className="m-btn m-btn-primary w-full" disabled={busy} onClick={() => setState("active")}>
            <Icon name="play" /> {t.habit.actions.resume}
          </button>
        )}
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
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">{t.habit.last30}</h2>
          <Link href="/mahdi/progress/calendar" className="text-sm font-semibold m-gold">
            التقويم <Icon name="chevronLeft" size={14} />
          </Link>
        </div>
        {/* a quiet calendar: one cell a day, nothing to mis-tap; a missed day soft orange, an excused day lighter, never red */}
        <ol className="grid grid-cols-10 gap-1.5">
          {days30.map((d) => {
            const inst = tl.byDay.get(d)?.[0];
            const value = item.logs[d] ?? 0;
            const isExcused = Boolean(excused?.has(d)) && !(inst && inst.progress >= 1);
            const missed = !isExcused && inst && inst.progress < 1 && d < today;
            const label = `${weekdayName(d)} ${fmtDate(d)}: ${isExcused ? "يوم عذر" : inst ? fmtPct(inst.progress) : value ? fmtNum(value) : "—"}`;
            return (
              <li
                key={d}
                title={label}
                aria-label={label}
                className="grid aspect-square place-items-center rounded-lg text-[10px] font-semibold"
                style={{
                  background: isExcused
                    ? "var(--m-excuse)"
                    : missed && inst?.progress === 0
                      ? "var(--m-missed)"
                      : inst
                        ? `color-mix(in srgb, var(--pc) ${Math.round(inst.progress * 85) + 8}%, var(--m-track))`
                        : value
                          ? "color-mix(in srgb, var(--pc) 35%, var(--m-track))"
                          : "var(--m-surface-2)",
                  outline: d === today ? "2px solid var(--m-gold)" : undefined,
                  color: inst && inst.progress >= 1 ? "#fff" : "var(--m-muted)",
                }}
              >
                {inst && inst.progress >= 1 ? <Icon name="check" size={12} strokeWidth={3} /> : !inst && !value ? "·" : ""}
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

      <Sheet open={menu} onClose={() => setMenu(false)} title={habit.name}>
        <div className="m-card m-rows">
          {[
            { icon: "edit" as const, label: t.habit.editTitle, go: () => setEditing(true), on: true, danger: false },
            { icon: "shield" as const, label: habit.emergencyTarget ? "خانة الطوارئ" : "أضف خانة الطوارئ", go: () => setEmergency(true), on: v.measure !== "check" && status !== "archived", danger: false },
            {
              icon: status === "paused" ? ("play" as const) : ("pause" as const),
              label: status === "paused" ? t.habit.actions.resume : t.habit.actions.pause,
              go: () => setState(status === "paused" ? "active" : "paused"),
              on: !projectArchived && status !== "archived",
              danger: false,
            },
            { icon: "archive" as const, label: status === "archived" ? t.habit.actions.unarchive : t.habit.actions.archive, go: () => setState(status === "archived" ? "active" : "archived"), on: !projectArchived, danger: false },
            { icon: "trash" as const, label: t.habit.actions.delete, go: () => setDeleting(true), on: true, danger: true },
          ]
            .filter((o) => o.on)
            .map((o) => (
              <button
                key={o.label}
                type="button"
                className="m-row w-full text-start"
                disabled={busy}
                style={o.danger ? { color: "var(--m-error)" } : undefined}
                onClick={() => {
                  setMenu(false);
                  o.go();
                }}
              >
                <span className="m-row-ic" style={o.danger ? { color: "var(--m-error)" } : undefined}>
                  <Icon name={o.icon} size={20} />
                </span>
                <span className="flex-1">{o.label}</span>
              </button>
            ))}
        </div>
      </Sheet>
      {projectArchived && <p className="m-note text-sm">{t.errors.archivedProject}</p>}

      <HabitForm open={editing} onClose={() => setEditing(false)} habit={habit} />
      {todayInst && <LogSheet open={logging} onClose={() => setLogging(false)} habit={habit} version={v} inst={todayInst} date={today} commit={commit} dayValue={dayValue} />}
      {emergency && <EmergencySetup open onClose={() => setEmergency(false)} habitId={habit.id} />}
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
