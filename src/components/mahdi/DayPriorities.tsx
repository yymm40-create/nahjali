"use client";

// «أولويات اليوم» on the home screen, above «مهام اليوم»: the few things that matter most today. An item is either one
// of the user's habits (picked from «من عاداتي») — tied to it both ways: ticked here, the habit is filled for the day;
// filled from the habits, it shows ticked here — or anything new, simply ticked. Kept with the day's tasks (priority).

import { useMemo, useState } from "react";
import { dayGoals, versionAt } from "@/lib/mahdi/engine";
import { t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { habitStatus } from "@/lib/mahdi/client/derive";
import type { DayTask, Habit } from "@/lib/mahdi/types";
import Icon from "./Icon";
import { useMahdi } from "./Provider";

export default function DayPriorities() {
  const { state, store, timeline, toast } = useMahdi();
  const { snap, today } = state;
  const items = useMemo(() => snap.tasks.filter((x) => x.date === today && x.priority).sort((a, b) => a.sortOrder - b.sortOrder), [snap.tasks, today]);
  const habits = useMemo(() => snap.habits.filter((h) => habitStatus(h, today) !== "paused"), [snap.habits, today]);
  const [title, setTitle] = useState("");
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!snap.tasksReady) return null;

  /** What fills a habit today (a tick, or its day target), or null when it can't be told. */
  const want = (h: Habit) => {
    const v = versionAt({ ...h, logs: {} }, today);
    const inst = dayGoals(timeline, today).find((i) => i.itemId === h.id && i.kind === "day");
    return v?.measure === "check" ? 1 : inst ? inst.target : null;
  };
  const habitOf = (x: DayTask) => (x.habitId ? snap.habits.find((h) => h.id === x.habitId) ?? null : null);
  /** Ticked here, or (for a habit) filled from the habits. */
  const isDone = (x: DayTask) => {
    if (x.doneAt) return true;
    const h = habitOf(x);
    if (!h) return false;
    const w = want(h);
    return w !== null && (state.logs[h.id]?.[today] ?? 0) >= w;
  };

  const save = (next: DayTask[]) => store.setSnapPart({ tasks: next });
  const call = async (method: "POST" | "PATCH" | "DELETE", json: Record<string, unknown>) => {
    const r = await mahdiFetch<{ tasks: DayTask[] }>("/api/mahdi/tasks", { method, json });
    save(r.tasks);
  };
  const fail = (e: unknown) => toast(e instanceof Error ? e.message : t.common.syncFailed);

  const add = async (name: string, habitId: string | null) => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await call("POST", { title: name.trim(), habitId, priority: true });
      setTitle("");
      setPicking(false);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  /** Ticks or unticks at once; a habit is filled (or emptied) for today with it, with an undo. */
  const tick = async (x: DayTask) => {
    const done = !isDone(x);
    save(snap.tasks.map((y) => (y.id === x.id ? { ...y, doneAt: done ? new Date().toISOString() : null } : y)));
    try {
      navigator.vibrate?.(8);
    } catch {}
    const h = habitOf(x);
    if (h) {
      const w = want(h);
      const now = state.logs[h.id]?.[today] ?? 0;
      if (done && w !== null && now < w) {
        const prev = store.setLog(h.id, today, w);
        toast(t.habit.logged(h.name), { label: t.habit.undo, run: () => store.setLog(h.id, today, prev) }, h.id);
      } else if (!done && now > 0) {
        const prev = store.setLog(h.id, today, 0);
        toast(t.habit.logged(h.name), { label: t.habit.undo, run: () => store.setLog(h.id, today, prev) }, h.id);
      }
    }
    try {
      await call("PATCH", { id: x.id, done });
    } catch (e) {
      save(snap.tasks);
      fail(e);
    }
  };

  const remove = async (x: DayTask) => {
    save(snap.tasks.filter((y) => y.id !== x.id));
    try {
      await call("DELETE", { id: x.id });
    } catch (e) {
      save(snap.tasks);
      fail(e);
    }
  };

  const doneCount = items.filter(isDone).length;
  const free = habits.filter((h) => !items.some((x) => x.habitId === h.id));

  return (
    <section className="m-card space-y-3 p-4" aria-labelledby="day-priorities">
      <div className="flex items-center gap-2">
        <Icon name="sparkle" size={20} className="m-gold" />
        <h2 id="day-priorities" className="flex-1 font-semibold">
          {t.priorities.title}
        </h2>
        {items.length > 0 && <span className="m-num text-sm m-muted">{t.priorities.done(doneCount, items.length)}</span>}
      </div>
      {items.length === 0 ? (
        <p className="text-sm m-muted">{t.priorities.empty}</p>
      ) : doneCount === items.length ? (
        <p className="m-chip m-chip-success">{t.priorities.allDone}</p>
      ) : null}

      {items.length > 0 && (
        <ul className="divide-y" style={{ borderColor: "var(--m-line)" }}>
          {items.map((x) => {
            const done = isDone(x);
            const h = habitOf(x);
            return (
              <li key={x.id} className="flex items-center gap-3 py-2">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={done}
                  aria-label={x.title}
                  onClick={() => void tick(x)}
                  className="grid size-8 shrink-0 place-items-center rounded-full border-2 transition-colors"
                  style={{ borderColor: done ? "var(--m-gold)" : "var(--m-line)", background: done ? "var(--m-gold)" : "transparent", color: "var(--m-bg, #fff)" }}
                >
                  {done && <Icon name="check" size={16} />}
                </button>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate ${done ? "line-through m-muted" : "font-semibold"}`}>{x.title}</span>
                  {h && <span className="block text-xs m-muted">↺ {h.name}</span>}
                </span>
                <button type="button" className="m-icon-btn m-btn-ghost" aria-label={t.priorities.remove} onClick={() => void remove(x)}>
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
          void add(title, null);
        }}
      >
        <div className="flex gap-2">
          <input className="m-field min-w-0 flex-1" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder={t.priorities.placeholder} aria-label={t.priorities.add} />
          <button type="submit" className="m-btn m-btn-primary shrink-0" disabled={!title.trim() || busy} aria-label={t.priorities.add}>
            <Icon name="plus" />
          </button>
        </div>
        {free.length > 0 && (
          <button type="button" className={`m-option min-h-9 px-3 text-sm ${picking ? "font-semibold" : ""}`} aria-expanded={picking} onClick={() => setPicking((v) => !v)}>
            ↺ {t.priorities.fromHabits}
          </button>
        )}
        {picking && (
          <>
            <div className="flex flex-wrap gap-2">
              {free.map((h) => (
                <button key={h.id} type="button" className="m-option min-h-9 px-3 text-sm" disabled={busy} onClick={() => void add(h.name, h.id)}>
                  + {h.name}
                </button>
              ))}
            </div>
            <p className="m-hint">{t.priorities.habitLinked}</p>
          </>
        )}
      </form>
    </section>
  );
}
