"use client";

import Link from "next/link";
import { useState } from "react";
import { addDays, addMonths, dayGoals, dayScore, daysInMonth, startOfMonth, weekday, type ISODate } from "@/lib/mahdi/engine";
import { fmtDateLong, fmtMonth, fmtNum, fmtPct, orderedWeekdays, t } from "@/lib/mahdi/i18n";
import { quantity } from "@/lib/mahdi/client/derive";
import Icon from "@/components/mahdi/Icon";
import { ProgressTabs } from "@/components/mahdi/Stats";
import { useMahdi } from "@/components/mahdi/Provider";

type Level = keyof typeof t.calendar.levels;

const levelOf = (s: number | null): Level => (s === null ? "none" : s >= 1 ? "full" : s >= 0.8 ? "high" : s >= 0.4 ? "partial" : "low");

/** Fill strength per level (one hue, light → strong) plus a shape, so the state never depends on colour alone. */
const STYLE: Record<Level, { mix: number; mark: string }> = {
  none: { mix: 0, mark: "" },
  low: { mix: 18, mark: "◔" },
  partial: { mix: 42, mark: "◑" },
  high: { mix: 68, mark: "◕" },
  full: { mix: 100, mark: "✓" },
};

/** Month calendar: each day shows how far its goals were reached. Tap a day for its details. */
export default function CalendarView({ month }: { month?: string }) {
  const { state, timeline, items } = useMahdi();
  const { snap, today } = state;
  const current = startOfMonth(today);
  const ms = month && /^\d{4}-\d{2}$/.test(month) && `${month}-01` <= current ? `${month}-01` : current;
  const [selected, setSelected] = useState<ISODate | null>(null);
  const ws = snap.profile.weekStart;
  const lead = (weekday(ms) - ws + 7) % 7;
  const cells: (ISODate | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth(ms) }, (_, k) => addDays(ms, k))];
  const ym = (d: string) => d.slice(0, 7);
  const sel = selected ? dayGoals(timeline, selected) : [];
  const habitById = new Map(snap.habits.map((h) => [h.id, h]));

  return (
    <div className="space-y-6">
      <h1 className="m-display text-3xl">{t.calendar.title}</h1>
      <ProgressTabs />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <section className="m-card space-y-4 p-4 sm:p-5">
          <nav className="flex items-center justify-between gap-2" aria-label={t.calendar.title}>
            <Link href={`/mahdi/progress/calendar?m=${ym(addMonths(ms, -1))}`} className="m-icon-btn" aria-label={t.reports.prev}>
              <Icon name="chevronRight" />
            </Link>
            <h2 className="font-semibold">{fmtMonth(ms)}</h2>
            {ms === current ? (
              <span className="w-11" />
            ) : (
              <Link href={`/mahdi/progress/calendar?m=${ym(addMonths(ms, 1))}`} className="m-icon-btn" aria-label={t.reports.next}>
                <Icon name="chevronLeft" />
              </Link>
            )}
          </nav>
          <div className="grid grid-cols-7 gap-1.5 text-center text-xs m-muted" aria-hidden="true">
            {orderedWeekdays(ws).map((d) => (
              <span key={d}>{t.weekdaysShort[d]}</span>
            ))}
          </div>
          <ol className="grid grid-cols-7 gap-1.5">
            {cells.map((d, i) => {
              if (!d) return <li key={`x${i}`} aria-hidden="true" />;
              const future = d > today;
              const s = future ? null : dayScore(timeline, d).score;
              const lvl = future ? "none" : levelOf(s);
              const st = STYLE[lvl];
              return (
                <li key={d}>
                  <button
                    type="button"
                    disabled={future}
                    onClick={() => setSelected(d)}
                    aria-pressed={selected === d}
                    aria-label={`${fmtDateLong(d)}: ${future ? "" : `${t.calendar.levels[lvl]}${s !== null ? ` ${fmtPct(s)}` : ""}`}`}
                    className="relative flex aspect-square w-full flex-col items-center justify-center rounded-xl text-sm transition disabled:opacity-35"
                    style={{
                      background: lvl === "none" ? "var(--m-surface-2)" : `color-mix(in srgb, var(--m-gold) ${st.mix}%, var(--m-track))`,
                      color: lvl === "full" || lvl === "high" ? "var(--m-gold-ink)" : "var(--m-ink)",
                      outline: d === today ? "2px solid var(--m-gold-text)" : selected === d ? "2px solid var(--m-ink)" : undefined,
                      outlineOffset: 1,
                    }}
                  >
                    <span className="m-num font-semibold">{Number(d.slice(8))}</span>
                    <span className="text-[10px] leading-none" aria-hidden="true">{st.mark}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs" aria-label={t.calendar.legend}>
            {(Object.keys(STYLE) as Level[]).map((l) => (
              <li key={l} className="flex items-center gap-1.5">
                <span className="grid size-5 place-items-center rounded-md text-[10px]" style={{ background: l === "none" ? "var(--m-surface-2)" : `color-mix(in srgb, var(--m-gold) ${STYLE[l].mix}%, var(--m-track))`, color: "var(--m-gold-ink)" }} aria-hidden="true">
                  {STYLE[l].mark}
                </span>
                {t.calendar.levels[l]}
              </li>
            ))}
          </ul>
        </section>

        <section className="m-card space-y-3 p-5" aria-live="polite">
          <h2 className="font-semibold">{t.calendar.dayDetails}</h2>
          {!selected ? (
            <p className="text-sm m-muted">{t.calendar.open}</p>
          ) : (
            <>
              <p className="text-sm">{fmtDateLong(selected)}</p>
              <p className="m-num m-gold text-2xl font-semibold">{fmtPct(dayScore(timeline, selected).score)}</p>
              {sel.length === 0 ? (
                <p className="text-sm m-muted">{t.home.noGoalsToday}</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {sel.map((i) => {
                    const h = habitById.get(i.itemId);
                    if (!h) return null;
                    return (
                      <li key={i.key} className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 truncate">
                          {i.progress >= 1 ? <Icon name="check" size={16} className="m-gold" /> : <span className="size-4" />}
                          {h.name}
                        </span>
                        <span className="m-num shrink-0 m-muted">
                          {i.measure === "check" ? (i.progress >= 1 ? t.home.done : "—") : `${fmtNum(i.value)} / ${quantity(i, i.target)}`}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {items.length > 0 && (
                <Link href={selected === today ? "/mahdi" : `/mahdi/day/${selected}`} className="m-btn m-btn-ghost w-full">
                  {t.calendar.open} <Icon name="chevronLeft" size={18} />
                </Link>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
