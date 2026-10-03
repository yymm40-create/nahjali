"use client";

import Link from "next/link";
import { useState } from "react";
import type { ISODate, Instance, Version } from "@/lib/mahdi/engine";
import { fmtNum, fmtRelativeDay, t } from "@/lib/mahdi/i18n";
import { describeGoal, itemHref, parseNumberInput, quantity } from "@/lib/mahdi/client/derive";
import type { Habit } from "@/lib/mahdi/types";
import Icon from "./Icon";
import { useMahdi } from "./Provider";
import Sheet from "./Sheet";

/** Logging a habit for one day in detail: toggle, − / +, or type an amount (the unit is already known). */
export default function LogSheet({
  open,
  onClose,
  habit,
  version: v,
  inst,
  date,
  dayValue,
  commit,
}: {
  open: boolean;
  onClose: () => void;
  habit: Habit;
  version: Version;
  inst: Instance;
  date: ISODate;
  dayValue: number;
  commit: (value: number) => void;
}) {
  const { state } = useMahdi();
  const today = state.today;
  const [amount, setAmount] = useState("");
  const [total, setTotal] = useState<string | null>(null);
  const isPast = date < today;

  const add = (n: number) => {
    if (!(n > 0)) return;
    commit(dayValue + n);
    setAmount("");
    onClose();
  };

  const quick = v.measure === "amount" ? [...new Set([v.target / 4, v.target / 2, v.target].map((x) => Math.max(1, Math.round(x))))] : [];

  return (
    <Sheet open={open} onClose={onClose} title={habit.name}>
      <div className="space-y-5">
        <p className="m-muted text-sm">
          {fmtRelativeDay(date, today)} · {describeGoal(v, state.snap.profile.weekStart)}
        </p>
        {isPast && <p className="m-note text-sm font-semibold">{t.home.editingPast(fmtRelativeDay(date, today))}</p>}

        {v.measure === "check" && (
          <button type="button" className={`m-btn w-full text-lg ${dayValue >= 1 ? "m-btn-ghost" : "m-btn-primary"}`} onClick={() => (commit(dayValue >= 1 ? 0 : 1), onClose())}>
            <Icon name={dayValue >= 1 ? "undo" : "check"} />
            {dayValue >= 1 ? t.habit.markUndone(habit.name) : t.habit.markDone(habit.name)}
          </button>
        )}

        {v.measure === "count" && (
          <div className="flex items-center justify-center gap-6">
            <button type="button" className="m-icon-btn m-btn-ghost size-14 rounded-2xl" onClick={() => commit(Math.max(0, dayValue - 1))} disabled={dayValue <= 0} aria-label={t.habit.minusOne}>
              <Icon name="minus" size={26} />
            </button>
            <output className="m-num min-w-20 text-center text-5xl font-semibold" aria-live="polite">
              {fmtNum(dayValue)}
            </output>
            <button type="button" className="m-icon-btn m-btn-primary size-14 rounded-2xl" onClick={() => commit(dayValue + 1)} aria-label={t.habit.plusOne}>
              <Icon name="plus" size={26} />
            </button>
          </div>
        )}

        {v.measure === "amount" && (
          <div className="space-y-3">
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                add(parseNumberInput(amount));
              }}
            >
              <label className="flex-1">
                <span className="m-label">
                  {t.habit.addAmount} ({v.unit})
                </span>
                <input className="m-field m-num text-lg" inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
              </label>
              <button className="m-btn m-btn-primary" disabled={!(parseNumberInput(amount) > 0)}>
                {t.habit.add}
              </button>
            </form>
            <div className="flex flex-wrap gap-2">
              {quick.map((n) => (
                <button key={n} type="button" className="m-chip m-num min-h-10 px-4" onClick={() => add(n)}>
                  +{fmtNum(n)} {v.unit}
                </button>
              ))}
            </div>
            <div className="m-soft flex items-center justify-between gap-3 p-3">
              <span className="text-sm font-semibold">{t.habit.setTotal}</span>
              {total === null ? (
                <button type="button" className="m-btn m-btn-quiet m-btn-sm m-num" onClick={() => setTotal(String(dayValue))}>
                  {fmtNum(dayValue)} {v.unit} <Icon name="edit" size={16} />
                </button>
              ) : (
                <form
                  className="flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const n = parseNumberInput(total);
                    if (Number.isFinite(n) && n >= 0) commit(n);
                    setTotal(null);
                  }}
                >
                  <input className="m-field m-num w-28" inputMode="decimal" autoFocus value={total} onChange={(e) => setTotal(e.target.value)} aria-label={t.habit.setTotal} />
                  <button className="m-btn m-btn-ghost m-btn-sm">{t.common.save}</button>
                </form>
              )}
            </div>
          </div>
        )}

        <div className="m-soft space-y-1 p-3 text-sm">
          <p className="m-num font-semibold">
            {inst.kind === "week" ? t.home.thisWeek : inst.kind === "month" ? t.home.thisMonth : date === today ? t.home.todayProgress : fmtRelativeDay(date, today)}
            {": "}
            {fmtNum(inst.value)} / {v.measure === "check" && inst.kind !== "day" ? t.units.days(inst.target) : quantity(v, inst.target)}
          </p>
          {inst.progress >= 1 && <p className="font-semibold" style={{ color: "var(--m-success)" }}>{inst.over > 0 ? `${t.habit.overachieved} (+${fmtNum(inst.over)})` : t.habit.goalReached}</p>}
          {inst.partial && <p className="m-muted">{inst.kind === "week" ? t.habit.partialWeek : t.habit.partialMonth}</p>}
        </div>

        <Link href={itemHref(habit.id)} className="m-btn m-btn-quiet w-full" onClick={onClose}>
          {t.habit.actions.open} <Icon name="chevronLeft" size={18} />
        </Link>
      </div>
    </Sheet>
  );
}
