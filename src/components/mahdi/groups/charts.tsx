"use client";

// «إخوة الولاية» · comparing up to four members: the weeks as lines, each habit or project as grouped bars, the last
// 30 days as rows of cells, and each one's week as a ring. Identity is never colour alone: a legend with names, the
// names written at the lines' ends, and every value in a tooltip and in the table above the charts.

import { useState } from "react";
import { fmtDate, fmtPct } from "@/lib/mahdi/i18n";

/** Categorical slots 1–4 (validated: adjacent CVD ΔE ≥ 9, normal ≥ 22), stepped for dark themes in mahdi.css. */
export const SERIES = ["var(--m-s1)", "var(--m-s2)", "var(--m-s3)", "var(--m-s4)"];

export interface Series {
  key: string;
  name: string;
  color: string;
}

const pct = (v: number | null) => (v === null ? "—" : fmtPct(v));

/** Who is who: a swatch and a name each (always shown for two or more). */
export function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="المفتاح">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded-full" style={{ background: s.color }} aria-hidden="true" />
          {s.name}
        </li>
      ))}
    </ul>
  );
}

const W = 600;
const H = 200;
const PAD = { top: 16, bottom: 10, side: 16, label: 64 };

/**
 * The last weeks, a line each. Time runs right → left like the reading (the newest week on the left, where each
 * line's end carries its name). A gap where nothing was due. Hover or tap for the week's values.
 */
export function MultiLine({ series, points }: { series: Series[]; points: { label: string; values: (number | null)[] }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = points.length;
  const left = PAD.side + (series.length > 1 ? PAD.label : 0);
  const x = (i: number) => W - PAD.side - (i * (W - PAD.side - left)) / Math.max(1, n - 1);
  const y = (s: number) => PAD.top + (1 - s) * (H - PAD.top - PAD.bottom);
  const paths = series.map((_, k) => {
    const segs: string[] = [];
    let cur = "";
    points.forEach((p, i) => {
      const v = p.values[k];
      if (v === null || v === undefined) {
        if (cur) segs.push(cur);
        cur = "";
        return;
      }
      cur += `${cur ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    });
    if (cur) segs.push(cur);
    return segs;
  });
  const last = n - 1;
  // the names at the newest end, nudged apart so they never sit on each other
  const ends = series
    .map((s, k) => ({ s, v: points[last]?.values[k] }))
    .filter((e): e is { s: Series; v: number } => typeof e.v === "number")
    .sort((a, b) => b.v - a.v);
  let prev = -Infinity;
  const labelY = ends.map((e) => {
    const yy = Math.max(y(e.v), prev + 14);
    prev = yy;
    return { ...e, yy: Math.min(yy, H - 4) };
  });

  return (
    <figure className="space-y-2">
      <div
        className="relative"
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          let best = 0;
          for (let i = 1; i < n; i++) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
          setHover(best);
        }}
        onPointerLeave={() => setHover(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-52 w-full" preserveAspectRatio="none" role="img" aria-label={series.map((s, k) => `${s.name}: ${pct(points[last]?.values[k] ?? null)}`).join("، ")}>
          {[0, 0.5, 1].map((g) => (
            <line key={g} x1={left} x2={W - PAD.side} y1={y(g)} y2={y(g)} stroke="var(--m-line)" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray={g === 0 ? undefined : "3 4"} />
          ))}
          {paths.map((segs, k) => segs.map((d) => <path key={`${k}${d}`} d={d} fill="none" stroke={series[k].color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />))}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--m-muted)" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
        </svg>
        {/* the points as HTML so they stay round at any width, with a ring of the surface where lines cross */}
        {series.map((s, k) =>
          points.map((p, i) => {
            const v = p.values[k];
            if (v === null || v === undefined || (i !== last && i !== hover)) return null;
            return <span key={`${s.key}${i}`} className="pointer-events-none absolute block size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${(x(i) / W) * 100}%`, top: `${(y(v) / H) * 100}%`, background: s.color, boxShadow: "0 0 0 2px var(--m-surface-solid)" }} />;
          }),
        )}
        {series.length > 1 &&
          labelY.map((e) => (
            <span key={e.s.key} className="pointer-events-none absolute -translate-y-1/2 truncate text-[11px] font-semibold" style={{ left: 0, width: `${(PAD.label / W) * 100}%`, top: `${(e.yy / H) * 100}%` }}>
              {e.s.name}
            </span>
          ))}
        {hover !== null && points[hover] && (
          <div className="m-num pointer-events-none absolute top-0 z-10 min-w-36 -translate-x-1/2 rounded-lg px-2.5 py-1.5 text-xs shadow-lg" style={{ left: `${Math.min(80, Math.max(20, (x(hover) / W) * 100))}%`, background: "var(--m-surface-solid)", border: "1px solid var(--m-line)" }}>
            <p className="font-semibold">{points[hover].label}</p>
            {series.map((s, k) => (
              <p key={s.key} className="flex items-center gap-1.5">
                <span className="inline-block size-2 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                <span className="flex-1">{s.name}</span>
                <b>{pct(points[hover].values[k] ?? null)}</b>
              </p>
            ))}
          </div>
        )}
      </div>
      {/* right to left like the page: the oldest week on the right, the newest on the left */}
      <div className="flex justify-between text-[11px] m-muted" aria-hidden="true">
        <span>{points[0]?.label}</span>
        <span>{points[last]?.label}</span>
      </div>
    </figure>
  );
}

/** Each row (a habit or a project), one thin bar per member, side by side with a gap of the surface between them. */
export function GroupedBars({ series, rows }: { series: Series[]; rows: { key: string; label: string; values: (number | null)[] }[] }) {
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key} className="space-y-1">
          <p className="truncate text-sm font-semibold">{r.label}</p>
          <div className="space-y-0.5">
            {series.map((s, k) => {
              const v = r.values[k];
              return (
                <div key={s.key} className="flex items-center gap-2" title={`${s.name} · ${r.label}: ${pct(v ?? null)}`}>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--m-track)" }}>
                    {v !== null && v !== undefined && <span className="block h-full rounded-full" style={{ width: `${Math.max(2, v * 100)}%`, background: s.color }} />}
                  </span>
                  <span className="m-num w-11 text-end text-xs">{pct(v ?? null)}</span>
                  {series.length > 1 && <span className="w-16 truncate text-[11px] m-muted">{s.name}</span>}
                </div>
              );
            })}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** The last days as cells, a row per member: the darker, the more of the day's goals reached; empty where nothing was due. */
export function HeatRows({ rows }: { rows: { key: string; name: string; days: { date: string; score: number | null }[] }[] }) {
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-2">
          <span className="w-20 shrink-0 truncate text-xs font-semibold">{r.name}</span>
          <div className="grid flex-1 gap-[2px]" style={{ gridTemplateColumns: `repeat(${r.days.length}, minmax(0, 1fr))`, direction: "ltr" }}>
            {[...r.days].reverse().map((d) => (
              <span
                key={d.date}
                className="block aspect-square rounded-[3px]"
                title={`${r.name} · ${fmtDate(d.date)}: ${pct(d.score)}`}
                style={{ background: d.score === null ? "var(--m-track)" : `color-mix(in srgb, var(--m-gold) ${Math.round(15 + d.score * 85)}%, var(--m-track))` }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** A ring for one number (this week's commitment), its colour the member's, the value written inside. */
export function Ring({ value, color, size = 72 }: { value: number | null; color: string; size?: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 72 72" width={size} height={size} role="img" aria-label={pct(value)}>
      <circle cx="36" cy="36" r={r} fill="none" stroke="var(--m-track)" strokeWidth="6" />
      {value !== null && <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${c * value} ${c}`} transform="rotate(-90 36 36)" />}
      <text x="36" y="40" textAnchor="middle" fontSize="13" fontWeight="700" fill="currentColor">{pct(value)}</text>
    </svg>
  );
}
