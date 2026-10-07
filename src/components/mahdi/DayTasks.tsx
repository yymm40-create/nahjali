"use client";

// «مهام اليوم» on the home screen: things to do today only (not habits, not a fixed schedule). A plain checklist, or
// tasks at a time (reminded by a notification then, and an hour later if still open). A task can count for one of the
// user's habits: ticking it fills that habit for the day.

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { dayGoals, versionAt } from "@/lib/mahdi/engine";
import { t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { habitStatus } from "@/lib/mahdi/client/derive";
import type { DayTask } from "@/lib/mahdi/types";
import Icon from "./Icon";
import { useMahdi } from "./Provider";

const byTime = (a: DayTask, b: DayTask) => (a.at && b.at ? a.at.localeCompare(b.at) : a.at ? -1 : b.at ? 1 : a.sortOrder - b.sortOrder);
/** Minutes since the day began (6:00), so 01:00 is later than 23:00. */
const dayMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  const v = h * 60 + m;
  return v < 360 ? v + 1440 : v;
};
const nowHHMM = () => new Date().toTimeString().slice(0, 5);
const noSubscribe = () => () => {};
const permission = () => (typeof Notification === "undefined" ? "unsupported" : Notification.permission);

export default function DayTasks() {
  const { state, store, timeline, toast } = useMahdi();
  const { snap, today } = state;
  const tasks = useMemo(() => [...snap.tasks].filter((x) => x.date === today).sort(byTime), [snap.tasks, today]);
  const habits = useMemo(() => snap.habits.filter((h) => habitStatus(h, today) !== "paused"), [snap.habits, today]);
  const [title, setTitle] = useState("");
  const [timed, setTimed] = useState(false);
  const [at, setAt] = useState("");
  const [habitId, setHabitId] = useState("");
  const [busy, setBusy] = useState(false);
  const notif = useSyncExternalStore(noSubscribe, permission, () => "granted");

  if (!snap.tasksReady) return null;

  const save = (next: DayTask[]) => store.setSnapPart({ tasks: next });
  const call = async (method: "POST" | "PATCH" | "DELETE", json: Record<string, unknown>) => {
    const r = await mahdiFetch<{ tasks: DayTask[] }>("/api/mahdi/tasks", { method, json });
    save(r.tasks);
  };
  const fail = (e: unknown) => toast(e instanceof Error ? e.message : t.common.syncFailed);

  const add = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      await call("POST", { title: title.trim(), at: timed && at ? at : null, habitId: habitId || null });
      setTitle("");
      setAt("");
      setHabitId("");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  /** Ticks (or unticks) at once on the screen; a linked habit is filled for today. */
  const tick = async (task: DayTask) => {
    const done = !task.doneAt;
    save(snap.tasks.map((x) => (x.id === task.id ? { ...x, doneAt: done ? new Date().toISOString() : null } : x)));
    try {
      navigator.vibrate?.(8);
    } catch {}
    const h = task.habitId ? snap.habits.find((x) => x.id === task.habitId) : null;
    if (h && done) {
      const v = versionAt({ ...h, logs: {} }, today);
      const now = state.logs[h.id]?.[today] ?? 0;
      const inst = dayGoals(timeline, today).find((i) => i.itemId === h.id && i.kind === "day");
      const want = v?.measure === "check" ? 1 : inst ? inst.target : null;
      if (want !== null && now < want) {
        const prev = store.setLog(h.id, today, want);
        toast(t.habit.logged(h.name), { label: t.habit.undo, run: () => store.setLog(h.id, today, prev) }, h.id);
      }
    }
    try {
      await call("PATCH", { id: task.id, done });
    } catch (e) {
      save(snap.tasks);
      fail(e);
    }
  };

  const remove = async (task: DayTask) => {
    save(snap.tasks.filter((x) => x.id !== task.id));
    try {
      await call("DELETE", { id: task.id });
    } catch (e) {
      save(snap.tasks);
      fail(e);
    }
  };

  const doneCount = tasks.filter((x) => x.doneAt).length;
  const now = dayMin(nowHHMM());
  const hasTimed = tasks.some((x) => x.at && !x.doneAt);

  return (
    <section className="m-card space-y-3 p-4" aria-labelledby="day-tasks">
      <div className="flex items-center gap-2">
        <Icon name="check" size={20} className="m-gold" />
        <h2 id="day-tasks" className="flex-1 font-semibold">
          {t.tasks.title}
        </h2>
        {tasks.length > 0 && <span className="m-num text-sm m-muted">{t.tasks.done(doneCount, tasks.length)}</span>}
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm m-muted">{t.tasks.empty}</p>
      ) : doneCount === tasks.length ? (
        <p className="m-chip m-chip-success">{t.tasks.allDone}</p>
      ) : null}

      {tasks.length > 0 && (
        <ul className="divide-y" style={{ borderColor: "var(--m-line)" }}>
          {tasks.map((task) => {
            const late = !task.doneAt && task.at && dayMin(task.at) < now;
            const habit = task.habitId ? snap.habits.find((h) => h.id === task.habitId) : null;
            return (
              <li key={task.id} className="flex items-center gap-3 py-2">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={!!task.doneAt}
                  aria-label={task.title}
                  onClick={() => void tick(task)}
                  className="grid size-8 shrink-0 place-items-center rounded-full border-2 transition-colors"
                  style={{ borderColor: task.doneAt ? "var(--m-gold)" : "var(--m-line)", background: task.doneAt ? "var(--m-gold)" : "transparent", color: "var(--m-bg, #fff)" }}
                >
                  {task.doneAt && <Icon name="check" size={16} />}
                </button>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate ${task.doneAt ? "line-through m-muted" : "font-semibold"}`}>{task.title}</span>
                  {(task.at || habit) && (
                    <span className="m-num block text-xs m-muted">
                      {task.at && (
                        <>
                          🕒 {task.at}
                          {late && <span className="m-gold"> · {t.tasks.late}</span>}
                        </>
                      )}
                      {task.at && habit && " · "}
                      {habit && <>↺ {habit.name}</>}
                    </span>
                  )}
                </span>
                <button type="button" className="m-icon-btn m-btn-ghost" aria-label={t.tasks.remove} onClick={() => void remove(task)}>
                  <Icon name="trash" size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <div className="flex gap-2">
          <input className="m-field min-w-0 flex-1" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder={t.tasks.placeholder} aria-label={t.tasks.add} />
          <button type="submit" className="m-btn m-btn-primary shrink-0" disabled={!title.trim() || busy} aria-label={t.tasks.add}>
            <Icon name="plus" />
          </button>
        </div>
        {title.trim() && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <button type="button" className={`m-option min-h-9 px-3 text-sm ${!timed ? "font-semibold" : ""}`} aria-pressed={!timed} onClick={() => setTimed(false)}>
              {t.tasks.noTime}
            </button>
            <button
              type="button"
              className={`m-option min-h-9 px-3 text-sm ${timed ? "font-semibold" : ""}`}
              aria-pressed={timed}
              onClick={() => {
                setTimed(true);
                if (!at) setAt(nowHHMM());
              }}
            >
              🕒 {t.tasks.atTime}
            </button>
            {timed && <input type="time" className="m-field m-num !w-auto !py-1.5" value={at} onChange={(e) => setAt(e.target.value)} aria-label={t.tasks.atTime} />}
            {habits.length > 0 && (
              <select className="m-field !w-auto !py-1.5 text-sm" value={habitId} onChange={(e) => setHabitId(e.target.value)} aria-label={t.tasks.linkHabit}>
                <option value="">↺ {t.tasks.noHabit}</option>
                {habits.map((h) => (
                  <option key={h.id} value={h.id}>
                    ↺ {h.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
        {title.trim() && (timed || habitId) && <p className="m-hint">{[timed ? t.tasks.remindHint : "", habitId ? t.tasks.habitHint : ""].filter(Boolean).join(" ")}</p>}
      </form>

      {(hasTimed || (timed && title.trim())) && notif !== "granted" && notif !== "unsupported" && (
        <Link href="/mahdi/more/notifications" className="m-note flex items-center gap-2 text-sm font-semibold">
          <Icon name="bell" size={16} /> {t.tasks.enableNotify}
        </Link>
      )}
    </section>
  );
}
