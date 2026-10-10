"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SmartCoin from "@/components/SmartCoin";
import { fmtSar } from "@config/coins";

/** Fired by the studio whenever the server reports a new balance (after a charge or a refund). */
export const BALANCE_EVENT = "jawad:balance";
export const announceBalance = (balance: number | null | undefined) => {
  if (typeof balance === "number") window.dispatchEvent(new CustomEvent(BALANCE_EVENT, { detail: balance }));
};

/** «النقود الذكية» in the header; the owner has no limit. */
export default function CoinBalance({ initial, unlimited }: { initial: number | null; unlimited: boolean }) {
  const [balance, setBalance] = useState(initial);
  useEffect(() => {
    const on = (e: Event) => setBalance((e as CustomEvent<number>).detail);
    window.addEventListener(BALANCE_EVENT, on);
    return () => window.removeEventListener(BALANCE_EVENT, on);
  }, []);
  if (balance === null && !unlimited) return null;
  const text = unlimited ? "∞" : fmtSar(balance ?? 0);
  return (
    <span className="flex items-center gap-1">
      <Link
        href="/jawad-ai/coins"
        className="flex h-9 items-center gap-1.5 rounded-full border border-jw-line-strong bg-jw-surface-2 px-3 text-sm font-medium hover:bg-jw-surface-3"
        aria-label={`رصيدك: ${unlimited ? "بلا حد" : `${text} ريال`}`}
      >
        <SmartCoin size={18} />
        <span dir="ltr" className="tabular-nums">{text}</span>
      </Link>
      {/* «اشحن رصيدك»: the packages (bank transfer) */}
      {!unlimited && (
        <Link href="/jawad-ai/credits" className="grid h-9 min-w-9 place-items-center rounded-full bg-gradient-to-b from-amber-300 to-orange-500 px-2.5 text-sm font-bold text-[#2a1200] shadow-sm hover:brightness-105" aria-label="اشحن رصيدك" title="اشحن رصيدك">
          <span className="max-sm:hidden">+ اشحن</span>
          <span className="sm:hidden" aria-hidden>+</span>
        </Link>
      )}
    </span>
  );
}
