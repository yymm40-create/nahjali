"use client";

import Link from "next/link";
import { useState } from "react";
import { goalProgress, type ReadingGoals, type ReadingMetric } from "@/lib/mahdi/engine";
import { fmtNum, t, weekdayName } from "@/lib/mahdi/i18n";
import { bySort, habitStatus, parseNumberInput } from "@/lib/mahdi/client/derive";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { duration } from "@/lib/mahdi/client/reading";
import type { ReadingData } from "@/lib/mahdi/types";
import Icon from "@/components/mahdi/Icon";
import { useMahdi } from "@/components/mahdi/Provider";
import { useReading } from "@/components/mahdi/useReading";

type GoalForm = { on: boolean; metric: ReadingMetric; target: string };
const unitName = (m: ReadingMetric) => (m === "minutes" ? t.reading.unitMinutes : m === "narrations" ? t.reading.unitNarrations : t.reading.unitPages);
const toForm = (g: ReadingGoals["daily"]): GoalForm => ({ on: Boolean(g), metric: g?.metric ?? "minutes", target: g ? String(g.target) : "" });

/** Daily and weekly reading goals, the habit filled by each session, and the reading stats. */
export default function ReadingGoalsPage() {
  const { state, store, toast } = useMahdi();
  const { reading, summary } = useReading();
  const [daily, setDaily] = useState(() => toForm(reading.goals.daily));
  const [weekly, setWeekly] = useState(() => toForm(reading.goals.weekly));
  const [habitId, setHabitId] = useState(reading.goals.habitId ?? "");
  const [habitMetric, setHabitMetric] = useState<ReadingMetric>(reading.goals.habitMetric);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const habits = state.snap.habits.filter((h) => habitStatus(h, state.today) !== "archived").sort(bySort);

  const pack = (g: GoalForm) => {
    if (!g.on) return null;
    const target = Math.round(parseNumberInput(g.target));
    return target >= 1 ? { metric: g.metric, target } : undefined;
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const d = pack(daily);
    const w = pack(weekly);
    if (d === undefined || w === undefined) return setError(t.errors.invalid);
    setBusy(true);
    setError("");
    try {
      const { reading: fresh } = await mahdiFetch<{ reading: ReadingData }>("/api/mahdi/reading/goals", { method: "PUT", json: { daily: d, weekly: w, habitId: habitId || null, habitMetric } });
      store.setSnapPart({ reading: fresh });
      toast(t.reading.goalsSaved);
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  const goalRow = (label: string, g: GoalForm, set: (g: GoalForm) => void) => (
    <fieldset className="space-y-2">
      <legend className="m-label">{label}</legend>
      <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label={label}>
        {(
          [
            ["off", t.reading.goalOff],
            ["minutes", t.reading.metricMinutes],
            ["pages", t.reading.metricPages],
            ["narrations", t.reading.metricNarrations],
          ] as const
        ).map(([k, l]) => {
          const on = k === "off" ? !g.on : g.on && g.metric === k;
          return (
            <button key={k} type="button" role="radio" aria-checked={on} className="m-option min-h-11 px-2 text-sm font-semibold" onClick={() => set(k === "off" ? { ...g, on: false } : { ...g, on: true, metric: k })}>
              {l}
            </button>
          );
        })}
      </div>
      {g.on && (
        <label className="flex items-center gap-2">
          <input className="m-field m-num w-28" inputMode="numeric" required value={g.target} onChange={(e) => set({ ...g, target: e.target.value })} aria-label={`${label}: ${t.reading.goalValue}`} />
          <span className="m-muted">{unitName(g.metric)}</span>
        </label>
      )}
    </fieldset>
  );

  const finished = reading.library.filter((e) => e.state === "finished").length;
  const max = Math.max(1, ...summary.last7.map((d) => d.seconds));
  const dg = goalProgress(reading.goals.daily, summary.today);
  const wg = goalProgress(reading.goals.weekly, summary.week);

  return (
    <div className="space-y-6">
      <Link href="/mahdi/reading" className="m-btn m-btn-quiet m-btn-sm -ms-3">
        <Icon name="chevronRight" size={18} /> {t.reading.title}
      </Link>
      <h1 className="m-display text-3xl">{t.reading.goalsTitle}</h1>

      <section className="m-card space-y-4 p-5" aria-labelledby="stats">
        <h2 id="stats" className="font-semibold">{t.reading.stats}</h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              [t.reading.totalTime, duration(summary.month.seconds), t.reading.month],
              summary.month.narrations > 0
                ? [t.reading.statPages, `${fmtNum(summary.month.pages)} · ${t.reading.narrations(summary.month.narrations)}`, t.reading.month]
                : [t.reading.statPages, fmtNum(summary.month.pages), t.reading.month],
              [t.reading.sessionsCount, fmtNum(summary.month.sessions), t.reading.month],
              [t.reading.booksFinished, fmtNum(finished), ""],
            ] as const
          ).map(([label, value, sub]) => (
            <div key={label} className="m-soft p-3 text-center">
              <dt className="text-sm m-muted">{label}</dt>
              <dd className="m-num text-xl font-semibold">{value}</dd>
              {sub && <dd className="text-xs m-muted">{sub}</dd>}
            </div>
          ))}
        </dl>
        {(dg || wg) && (
          <p className="m-num text-sm m-muted">
            {dg && `${t.reading.dailyGoal}: ${t.reading.goalDone(dg.done, dg.target, unitName(dg.metric))}`}
            {dg && wg && " · "}
            {wg && `${t.reading.weeklyGoal}: ${t.reading.goalDone(wg.done, wg.target, unitName(wg.metric))}`}
          </p>
        )}
        <div>
          <p className="m-eyebrow mb-2">{t.reading.last7}</p>
          <ul className="flex h-28 items-end gap-2" aria-label={t.reading.last7}>
            {summary.last7.map((d) => (
              <li key={d.date} className="flex flex-1 flex-col items-center gap-1" aria-label={`${weekdayName(d.date)}: ${duration(d.seconds)}`}>
                <span className="w-full rounded-t-md" style={{ height: `${Math.max(4, (d.seconds / max) * 80)}px`, background: d.seconds ? "var(--m-gold)" : "var(--m-track)" }} />
                <span className="text-[0.7rem] m-muted">{t.weekdaysShort[new Date(`${d.date}T00:00:00Z`).getUTCDay()]}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <form className="m-card space-y-5 p-5" onSubmit={save}>
        {goalRow(t.reading.dailyGoal, daily, setDaily)}
        {goalRow(t.reading.weeklyGoal, weekly, setWeekly)}

        <fieldset className="space-y-2">
          <legend className="m-label">{t.reading.linkHabit}</legend>
          <p className="m-hint">{t.reading.linkHabitHint}</p>
          <select className="m-field" value={habitId} onChange={(e) => setHabitId(e.target.value)}>
            <option value="">{t.reading.noHabit}</option>
            {habits.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
          {habitId && (
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t.reading.habitMetric}>
              {(["minutes", "pages", "narrations"] as const).map((m) => (
                <button key={m} type="button" role="radio" aria-checked={habitMetric === m} className="m-option min-h-11 px-2 text-sm font-semibold" onClick={() => setHabitMetric(m)}>
                  {m === "minutes" ? t.reading.metricMinutes : m === "narrations" ? t.reading.metricNarrations : t.reading.metricPages}
                </button>
              ))}
            </div>
          )}
        </fieldset>

        {error && <p className="m-error" role="alert">{error}</p>}
        <button className="m-btn m-btn-primary w-full" disabled={busy}>{busy ? t.common.saving : t.common.save}</button>
      </form>
    </div>
  );
}
