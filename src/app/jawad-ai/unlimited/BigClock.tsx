"use client";

import { useEffect, useState } from "react";

const two = (n: number) => String(n).padStart(2, "0");

/** «لامحدود»'s big count-down: hours (all of them, up to 72), minutes, seconds. Empty until the browser takes over. */
export default function BigClock({ to, label }: { to: number; label: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  const left = now == null ? null : Math.max(0, to - now);
  const cell = (v: string, u: string) => (
    <span className="ul-clock-c">
      <b>{v}</b>
      <small>{u}</small>
    </span>
  );
  return (
    <div className="ul-clock" aria-live="off">
      <span className="ul-clock-l">{label}</span>
      <div className="ul-clock-n" dir="ltr">
        {cell(left == null ? "--" : two(Math.floor(left / 3600_000)), "ساعة")}
        <i>:</i>
        {cell(left == null ? "--" : two(Math.floor((left % 3600_000) / 60_000)), "دقيقة")}
        <i>:</i>
        {cell(left == null ? "--" : two(Math.floor((left % 60_000) / 1000)), "ثانية")}
      </div>
    </div>
  );
}
