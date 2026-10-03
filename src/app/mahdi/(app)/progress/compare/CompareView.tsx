"use client";

import { useState } from "react";
import { compare, recentPeriods, type Period, type PeriodKind } from "@/lib/mahdi/engine";
import { fmtDate, fmtMonth, fmtNum, fmtPct, fmtPoints, fmtRelativeDay, t } from "@/lib/mahdi/i18n";
import { bySort } from "@/lib/mahdi/client/derive";
import Icon from "@/components/mahdi/Icon";
import { Delta, ProgressTabs } from "@/components/mahdi/Stats";
import { useMahdi } from "@/components/mahdi/Provider";

const COUNT: Record<PeriodKind, number> = { day: 14, week: 12, month: 12 };

/** Two periods side by side, picked from lists (no typing): the overall change, projects and habits. */
export default function CompareView() {
  const { state, timeline } = useMahdi();
  const { snap, today } = state;
  const ws = snap.profile.weekStart;
  const [kind, setKind] = useState<PeriodKind>("week");
  const periods = recentPeriods(kind, today, ws, COUNT[kind]);
  const [ia, setIa] = useState(1);
  const [ib, setIb] = useState(0);
  const a = periods[Math.min(ia, periods.length - 1)];
  const b = periods[Math.min(ib, periods.length - 1)];
  const c = compare(timeline, a, b);

  const label = (p: Period) =>
    p.kind === "day" ? fmtRelativeDay(p.start, today) : p.kind === "week" ? (p.start === periods[0].start ? t.compare.thisWeek : t.reports.weekOf(fmtDate(p.start))) : p.start === periods[0].start ? t.compare.thisMonth : fmtMonth(p.start);
  const habitName = (id: string) => snap.habits.find((h) => h.id === id)?.name ?? "";
  const projects = snap.projects.filter((p) => c.projects.some((x) => x.key === p.id)).sort(bySort);
  const enough = c.delta !== null;

  const pick = (value: number, set: (n: number) => void, title: string) => (
    <label className="block flex-1">
      <span className="m-label">{title}</span>
      <select className="m-field" value={value} onChange={(e) => set(Number(e.target.value))}>
        {periods.map((p, i) => (
          <option key={p.start} value={i}>
            {label(p)}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="space-y-6">
      <h1 className="m-display text-3xl">{t.compare.title}</h1>
      <ProgressTabs />

      <section className="m-card space-y-4 p-5">
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t.compare.title}>
          {(["day", "week", "month"] as PeriodKind[]).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              className="m-option min-h-11 font-semibold"
              onClick={() => {
                setKind(k);
                setIa(1);
                setIb(0);
              }}
            >
              {t.compare.modes[k]}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          {pick(ia, setIa, t.compare.first)}
          {pick(ib, setIb, t.compare.second)}
        </div>
        <button
          type="button"
          className="m-btn m-btn-ghost m-btn-sm"
          onClick={() => {
            setIa(1);
            setIb(0);
          }}
        >
          <Icon name="undo" size={16} /> {t.compare.quick[kind]}
        </button>
      </section>

      {!enough ? (
        <p className="m-card p-6 text-center m-muted">{t.compare.notEnough}</p>
      ) : (
        <>
          <section className="m-card space-y-2 p-5 text-center">
            <p className="text-sm m-muted">
              {label(a)} ← {label(b)}
            </p>
            <p className="m-num text-4xl font-semibold">
              {fmtPct(c.scoreA.score)} <span className="m-muted" aria-hidden="true">←</span> <span className="m-gold">{fmtPct(c.scoreB.score)}</span>
            </p>
            <p className="font-semibold" style={{ color: c.delta! >= 1 ? "var(--m-success)" : c.delta! <= -1 ? "var(--m-warning)" : "var(--m-muted)" }}>
              {Math.round(c.delta!) > 0 ? t.compare.improved(fmtPoints(c.delta!)) : Math.round(c.delta!) < 0 ? t.compare.declined(String(Math.abs(Math.round(c.delta!)))) : t.compare.same}
            </p>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <div className="m-card p-4">
              <p className="m-eyebrow">{t.compare.goalsReached}</p>
              <p className="m-num text-xl font-semibold">
                {fmtNum(c.scoreA.achieved)}/{fmtNum(c.scoreA.required)} ← {fmtNum(c.scoreB.achieved)}/{fmtNum(c.scoreB.required)}
              </p>
            </div>
            <div className="m-card p-4">
              <p className="m-eyebrow">{t.compare.extra}</p>
              <p className="m-num text-xl font-semibold">
                {fmtNum(c.scoreA.overCount)} ← {fmtNum(c.scoreB.overCount)}
              </p>
            </div>
            {c.mostImproved && (
              <div className="m-card p-4">
                <p className="m-eyebrow">{t.compare.mostImproved}</p>
                <p className="font-semibold">{habitName(c.mostImproved.key)}</p>
                <Delta a={c.mostImproved.a} b={c.mostImproved.b} delta={c.mostImproved.delta} />
              </div>
            )}
            {c.mostDeclined && (
              <div className="m-card p-4">
                <p className="m-eyebrow">{t.compare.mostDeclined}</p>
                <p className="font-semibold">{habitName(c.mostDeclined.key)}</p>
                <Delta a={c.mostDeclined.a} b={c.mostDeclined.b} delta={c.mostDeclined.delta} />
              </div>
            )}
          </section>

          <section className="m-card space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">{t.compare.byProject}</h2>
              <ul className="flex gap-4 text-xs" aria-label={t.calendar.legend}>
                <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm" style={{ background: "var(--m-muted)" }} /> {label(a)}</li>
                <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm" style={{ background: "var(--m-gold)" }} /> {label(b)}</li>
              </ul>
            </div>
            <ul className="space-y-4">
              {projects.map((p) => {
                const ch = c.projects.find((x) => x.key === p.id)!;
                return (
                  <li key={p.id} className="space-y-1.5">
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="truncate">{p.icon ? `${p.icon} ` : ""}{p.name}</span>
                      <Delta a={ch.a} b={ch.b} delta={ch.delta} />
                    </div>
                    <div className="space-y-1" aria-hidden="true">
                      <div className="m-bar h-2"><span style={{ width: `${Math.round((ch.a ?? 0) * 100)}%`, background: "var(--m-muted)" }} /></div>
                      <div className="m-bar h-2"><span style={{ width: `${Math.round((ch.b ?? 0) * 100)}%`, background: "var(--m-gold)" }} /></div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="m-card space-y-3 p-5">
            <h2 className="font-semibold">{t.compare.byHabit}</h2>
            <div className="-mx-2 overflow-x-auto px-2">
              <table className="w-full text-sm">
                <thead className="m-muted">
                  <tr>
                    <th className="py-2 text-start font-normal">{t.reports.habits}</th>
                    <th className="text-center font-normal">{label(a)}</th>
                    <th className="text-center font-normal">{label(b)}</th>
                    <th className="text-center font-normal">±</th>
                  </tr>
                </thead>
                <tbody>
                  {c.items
                    .filter((x) => habitName(x.key))
                    .sort((x, y) => (y.delta ?? -999) - (x.delta ?? -999))
                    .map((x) => (
                      <tr key={x.key} className="border-t" style={{ borderColor: "var(--m-line)" }}>
                        <td className="py-2">{habitName(x.key)}</td>
                        <td className="m-num text-center">{fmtPct(x.a)}</td>
                        <td className="m-num text-center">{fmtPct(x.b)}</td>
                        <td className="m-num text-center font-semibold">{x.delta === null ? "—" : fmtPoints(x.delta)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
