"use client";

// The limited course price, told to everyone who comes in: a slim bar over the header with the price, the usual price struck, a count
// down and a button to the course page. It follows the owner's price clock (see saleBarAt), so it goes by itself when the price ends.

import Link from "next/link";
import { useEffect, useState } from "react";
import Riyal from "@/components/Riyal";
import { countdown } from "@config/course";

const KEY = "jw-offer-bar";

export default function OfferBar({ href, price, was, endsAt, serverNow, until, name }: { href: string; price: number; was: number; endsAt: number; serverNow: number; until: string; name: string }) {
  const [skew] = useState(() => serverNow - Date.now());
  const [now, setNow] = useState(serverNow);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    // the clock and the «closed for this visit» mark are read in a callback (the first one right away), never in the effect body
    const tick = () => {
      setNow(Date.now() + skew);
      try {
        setHidden(sessionStorage.getItem(KEY) === String(endsAt));
      } catch {
        /* private mode: the bar just shows */
      }
    };
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [skew, endsAt]);
  const left = endsAt - now;
  if (hidden || left <= 0) return null;
  const hal = (sar: number) => Math.round(sar * 100);
  return (
    <div className="relative z-40 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-[linear-gradient(110deg,#7c4dff,#ff4f8b_55%,#ff8a3d)] px-10 py-2 text-center text-[13px] font-semibold leading-6 text-white sm:text-sm" role="region" aria-label="عرض خاص">
      <span>⏳ خصم خاص على «{name}» لين {until}:</span>
      <Riyal halalas={hal(price)} was={was > price ? hal(was) : null} size={16} className="text-base font-bold" />
      <span dir="ltr" className="rounded-full bg-black/25 px-2 tabular-nums" role="timer" aria-label={`الوقت المتبقي ${countdown(left)}`}>{countdown(left)}</span>
      <Link href={href} className="rounded-full bg-white px-3 py-0.5 text-[#5b2bd6] no-underline">سجّل الحين ←</Link>
      <button
        type="button"
        aria-label="إخفاء"
        className="absolute inset-y-0 end-2 px-2 text-lg leading-none text-white/80"
        onClick={() => {
          setHidden(true);
          try {
            sessionStorage.setItem(KEY, String(endsAt));
          } catch {
            /* nothing to remember */
          }
        }}
      >
        ✕
      </button>
    </div>
  );
}
