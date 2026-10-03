"use client";

import { useState } from "react";
import { versionAt, type ISODate, type Instance } from "@/lib/mahdi/engine";
import { fmtNum, t } from "@/lib/mahdi/i18n";
import { describeGoal, quantity } from "@/lib/mahdi/client/derive";
import type { Habit, Project } from "@/lib/mahdi/types";
import Icon from "./Icon";
import LogSheet from "./LogSheet";
import ProgressRing from "./ProgressRing";
import { useMahdi } from "./Provider";

/**
 * One habit on a day. The round button logs in one tap (done ↔ not done, or +1); amounts open a number pad.
 * The ring shows the goal's progress (the day's, or the week's / month's for "X per week" habits).
 */
export default function HabitRow({ habit, inst, date, project }: { habit: Habit; inst: Instance; date: ISODate; project?: Project }) {
  const { store, state, toast } = useMahdi();
  const [open, setOpen] = useState(false);
  const [bump, setBump] = useState(0);
  const v = versionAt({ ...habit, logs: {} }, date);
  if (!v) return null;

  const dayValue = state.logs[habit.id]?.[date] ?? 0;
  const done = inst.progress >= 1;
  const todayDone = v.measure === "check" && dayValue >= 1;
  const color = `var(--p-${project?.color ?? "gold"})`;
  const weekly = inst.kind !== "day";
  const periodLabel = inst.kind === "week" ? t.home.thisWeek : inst.kind === "month" ? t.home.thisMonth : "";

  const commit = (value: number) => {
    const prev = store.setLog(habit.id, date, value);
    try {
      navigator.vibrate?.(8);
    } catch {}
    toast(t.habit.logged(habit.name), { label: t.habit.undo, run: () => store.setLog(habit.id, date, prev) }, habit.id);
  };

  const tap = () => {
    if (v.measure === "check") commit(dayValue >= 1 ? 0 : 1);
    else if (v.measure === "count") {
      commit(dayValue + 1);
      setBump((b) => b + 1);
    } else setOpen(true);
  };

  const progressText =
    v.measure === "check" && !weekly
      ? done
        ? t.home.done
        : describeGoal(v, state.snap.profile.weekStart)
      : `${fmtNum(inst.value)} / ${v.measure === "check" ? t.units.days(inst.target) : quantity(v, inst.target)}${periodLabel ? ` · ${periodLabel}` : ""}`;

  const tapLabel =
    v.measure === "check"
      ? todayDone
        ? t.habit.markUndone(habit.name)
        : t.habit.markDone(habit.name)
      : v.measure === "count"
        ? `${t.habit.plusOne}: ${habit.name}`
        : `${t.habit.addAmount}: ${habit.name}`;

  return (
    <li className={`p-${project?.color ?? "gold"} flex items-center gap-3 py-2.5`}>
      <button type="button" onClick={tap} className="m-tap" data-done={done || todayDone} aria-label={tapLabel} aria-pressed={v.measure === "check" ? todayDone : undefined}>
        <ProgressRing value={inst.progress} size={52} stroke={4} color={color}>
          {done || todayDone ? (
            <span className="m-tap-check grid size-9 place-items-center rounded-full" style={{ background: color, color: "#fff" }}>
              <Icon name="check" size={20} strokeWidth={2.6} />
            </span>
          ) : v.measure === "check" ? (
            <span className="block size-9 rounded-full border-2" style={{ borderColor: "var(--m-line)" }} />
          ) : (
            <span className="grid size-9 place-items-center rounded-full" style={{ background: "var(--m-surface-2)", color: "var(--m-ink)" }}>
              <Icon name="plus" size={18} strokeWidth={2.2} />
            </span>
          )}
        </ProgressRing>
      </button>

      <button type="button" className="min-w-0 flex-1 text-start" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span className="flex items-center gap-1.5">
          {habit.icon && <span aria-hidden="true">{habit.icon}</span>}
          <span className={`truncate font-semibold ${done ? "opacity-80" : ""}`}>{habit.name}</span>
        </span>
        <span key={bump} className={`m-num block truncate text-sm m-muted ${bump ? "m-bump" : ""}`}>
          {progressText}
        </span>
        {inst.over > 0 && (
          <span className="m-chip m-chip-success mt-1" title={t.habit.overachieved}>
            <Icon name="sparkle" size={14} /> {t.habit.overachieved}
            <span className="m-num">(+{fmtNum(inst.over)})</span>
          </span>
        )}
      </button>

      <LogSheet open={open} onClose={() => setOpen(false)} habit={habit} version={v} inst={inst} date={date} commit={commit} dayValue={dayValue} />
    </li>
  );
}
