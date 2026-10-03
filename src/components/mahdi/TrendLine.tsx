"use client";

import { useState } from "react";
import { fmtPct } from "@/lib/mahdi/i18n";

export interface TrendPoint {
  key: string;
  label: string;
  score: number | null;
}

const W = 600;
const H = 180;
const PAD = { top: 14, bottom: 8, side: 14 };

/**
 * Score over time, one series (the title names it, so no legend). Time runs right → left, like the reading
 * direction; periods with nothing to measure leave a gap. Hover or focus a point for its value.
 */
export default function TrendLine({ points }: { points: TrendPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = points.length;
  const x = (i: number) => W - PAD.side - (i * (W - 2 * PAD.side)) / Math.max(1, n - 1);
  const y = (s: number) => PAD.top + (1 - s) * (H - PAD.top - PAD.bottom);

  // Line segments between consecutive measured points
  const segs: string[] = [];
  let cur = "";
  points.forEach((p, i) => {
    if (p.score === null) {
      if (cur) segs.push(cur);
      cur = "";
      return;
    }
    cur += `${cur ? "L" : "M"}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`;
  });
  if (cur) segs.push(cur);

  return (
    <figure>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-44 w-full" preserveAspectRatio="none" aria-hidden="true">
          {[0, 0.5, 1].map((g) => (
            <line key={g} x1={PAD.side} x2={W - PAD.side} y1={y(g)} y2={y(g)} stroke="var(--m-line)" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray={g === 0 ? undefined : "3 4"} />
          ))}
          {segs.map((d) => (
            <path key={d} d={d} fill="none" stroke="var(--m-gold)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {hover !== null && points[hover] && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--m-muted)" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
        </svg>
        {/* Points and hit areas as HTML so they stay round and focusable at any width */}
        {points.map((p, i) =>
          p.score === null ? null : (
            <button
              key={p.key}
              type="button"
              className="absolute grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center"
              style={{ left: `${(x(i) / W) * 100}%`, top: `${(y(p.score) / H) * 100}%` }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`${p.label}: ${fmtPct(p.score)}`}
            >
              <span className="block size-2.5 rounded-full" style={{ background: "var(--m-gold)", boxShadow: "0 0 0 2px var(--m-surface-solid)" }} />
            </button>
          ),
        )}
        {hover !== null && points[hover]?.score !== null && (
          <span
            className="m-num pointer-events-none absolute -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold"
            style={{ left: `${(x(hover) / W) * 100}%`, top: 0, background: "var(--m-ink)", color: "var(--m-bg)" }}
          >
            {points[hover].label}: {fmtPct(points[hover].score)}
          </span>
        )}
      </div>
      <div className="mt-1 flex justify-between text-[11px] m-muted" aria-hidden="true">
        <span>{points[0]?.label}</span>
        <span>{points[n - 1]?.label}</span>
      </div>
      <figcaption className="sr-only">
        <ul>
          {points.map((p) => (
            <li key={p.key}>
              {p.label}: {fmtPct(p.score)}
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
