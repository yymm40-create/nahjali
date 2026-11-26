"use client";

// «لامحدود · UNLIMITED» (config/jawad/unlimited.ts): a slim electric-cobalt bar over every page of JAWAD AI while the offer is on
// sale, with a running count-down to its end and one tap to the offer. It has no close button (the owner: «عداد فوق مستمر»)
// and goes by itself when the 72 hours end.

import Riyal from "@/components/Riyal";
import Link from "next/link";
import { useEffect, useState } from "react";

const two = (n: number) => String(n).padStart(2, "0");

export default function UnlimitedBar({ href, endsAt, serverNow, from }: { href: string; endsAt: number; serverNow: number; from: number }) {
  const [skew] = useState(() => serverNow - Date.now());
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const tick = () => setNow(Date.now() + skew);
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [skew]);
  const left = Math.max(0, endsAt - now);
  if (left <= 0) return null;
  const h = Math.floor(left / 3600_000);
  const m = Math.floor((left % 3600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  return (
    <Link href={href} className="ul-bar" role="region" aria-label="عرض لامحدود">
      <span className="ul-bar-glow" aria-hidden />
      <span className="ul-bar-tag" dir="ltr">⚡ UNLIMITED</span>
      <span className="ul-bar-txt">
        <b>لامحدود</b> فيديو وصور يوم كامل · من <Riyal halalas={from * 100} size={14} className="ul-bar-p" />
      </span>
      <span className="ul-bar-clock" dir="ltr" role="timer" aria-label={`باقي ${h} ساعة و${m} دقيقة`}>
        <b>{two(h)}</b>:<b>{two(m)}</b>:<b>{two(s)}</b>
      </span>
      <span className="ul-bar-go">اشترك ←</span>
    </Link>
  );
}
