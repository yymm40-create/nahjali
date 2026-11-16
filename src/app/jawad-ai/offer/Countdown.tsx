"use client";

import { useEffect, useState } from "react";

const two = (n: number) => String(n).padStart(2, "0");

/** Hours, minutes and seconds left until `to` (ms). Empty until the browser takes over, so the server and the page agree. */
export default function Countdown({ to, label }: { to: number; label: string }) {
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
  const h = left == null ? "--" : two(Math.floor(left / 3600_000));
  const m = left == null ? "--" : two(Math.floor((left % 3600_000) / 60_000));
  const s = left == null ? "--" : two(Math.floor((left % 60_000) / 1000));
  return (
    <div className="ox-cd" aria-live="off">
      <span className="ox-cd-l">{label}</span>
      <div className="ox-cd-n" dir="ltr">
        <b>{h}</b><i>:</i><b>{m}</b><i>:</i><b>{s}</b>
      </div>
      <div className="ox-cd-u"><span>ثانية</span><span>دقيقة</span><span>ساعة</span></div>
    </div>
  );
}
