"use client";

// «العداد»: the ring with the scene's number, and every piece being made now with a number that ticks every second
// against the time it usually takes (the real finish arrives from the server by itself).

import { useEffect, useState } from "react";
import { runningPercent, type Running } from "@/lib/film/progress-math";

export default function Meter({ percent, busy, large }: { percent: number; busy?: boolean; large?: boolean }) {
  // the number climbs to its value instead of jumping
  const [shown, setShown] = useState(percent);
  useEffect(() => {
    if (shown === percent) return;
    const t = setTimeout(() => setShown((s) => (s < percent ? Math.min(percent, s + 1) : Math.max(percent, s - 1))), 18);
    return () => clearTimeout(t);
  }, [shown, percent]);
  return (
    <div className={`fs-ring ${large ? "lg" : ""}`} style={{ ["--p" as string]: shown }} data-busy={busy || undefined} role="meter" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="اكتمال المشهد">
      <span>{shown}%</span>
    </div>
  );
}

const fmt = (sec: number) => (sec <= 0 ? "لحظات" : sec < 60 ? `${sec} ث` : `${Math.floor(sec / 60)} د ${sec % 60} ث`);

/** The pieces being made now: each with its own number and the time left, ticking. */
export function RunningList({ items }: { items: Running[] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!items.length) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [items.length]);
  if (!items.length) return null;
  return (
    <div className="grid gap-2" aria-live="polite">
      {items.map((r) => {
        const p = runningPercent(r.startedAt, r.kind, now);
        return (
          <div key={r.key} className="fs-run">
            <div className="row">
              <span className="truncate">{r.label}…</span>
              <span className="pct">{p.percent}%</span>
            </div>
            <div className="bar"><i style={{ width: `${p.percent}%` }} /></div>
            <div className="row"><span className="eta">المتوقع يخلص خلال {fmt(p.etaSec)}</span></div>
          </div>
        );
      })}
    </div>
  );
}
