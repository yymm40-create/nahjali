"use client";

import Link from "next/link";
import { useState } from "react";
import type { ISODate } from "@/lib/mahdi/engine";
import { fmtDate, fmtPct, t, weekdayName } from "@/lib/mahdi/i18n";

export interface DayPoint {
  date: ISODate;
  score: number | null;
}

/**
 * One bar per day (single series, so no legend). Reads right-to-left like the week itself.
 * Days without goals show a short dashed stub, not a fake 0. Each bar opens that day.
 */
export default function DayBars({ points, today, height = 96 }: { points: DayPoint[]; today: ISODate; height?: number }) {
  const [hover, setHover] = useState<ISODate | null>(null);
  return (
    <figure>
      <div className="flex items-end gap-1.5" style={{ height }} onMouseLeave={() => setHover(null)}>
        {points.map((p) => {
          const pct = p.score === null ? null : Math.round(p.score * 100);
          const label = `${weekdayName(p.date)} ${fmtDate(p.date)}: ${pct === null ? t.home.noGoalsToday : `${pct}%`}`;
          return (
            <Link
              key={p.date}
              href={p.date === today ? "/mahdi" : `/mahdi/day/${p.date}`}
              className="group relative flex h-full flex-1 flex-col items-center justify-end rounded-md"
              aria-label={label}
              onMouseEnter={() => setHover(p.date)}
              onFocus={() => setHover(p.date)}
            >
              {hover === p.date && (
                <span className="m-num pointer-events-none absolute -top-7 z-10 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold" style={{ background: "var(--m-ink)", color: "var(--m-bg)" }}>
                  {pct === null ? "—" : `${pct}%`}
                </span>
              )}
              {pct === null ? (
                <span className="w-full max-w-7 rounded-[4px] border border-dashed" style={{ height: 6, borderColor: "var(--m-line)" }} />
              ) : (
                <span
                  className="w-full max-w-7 rounded-t-[4px] transition-[height] duration-500"
                  style={{
                    height: `${Math.max(pct, 3)}%`,
                    background: p.date === today ? "var(--m-gold)" : "color-mix(in srgb, var(--m-gold) 55%, var(--m-track))",
                  }}
                />
              )}
            </Link>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5" aria-hidden="true">
        {points.map((p) => (
          <span key={p.date} className={`flex-1 text-center text-[11px] ${p.date === today ? "m-gold font-semibold" : "m-muted"}`}>
            {t.weekdaysShort[new Date(`${p.date}T12:00:00Z`).getUTCDay()]}
          </span>
        ))}
      </div>
      <figcaption className="sr-only">
        <ul>
          {points.map((p) => (
            <li key={p.date}>
              {weekdayName(p.date)} {fmtDate(p.date)}: {fmtPct(p.score)}
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
