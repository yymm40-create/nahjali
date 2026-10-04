"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SmartCoin from "@/components/SmartCoin";

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
  const text = unlimited ? "∞" : (balance ?? 0).toLocaleString("en");
  return (
    <Link
      href="/jawad-ai/coins"
      className="flex h-9 items-center gap-1.5 rounded-full border border-jw-line-strong bg-jw-surface-2 px-3 text-sm font-medium hover:bg-jw-surface-3"
      aria-label={`رصيدك من النقود الذكية: ${unlimited ? "بلا حد" : text}`}
    >
      <SmartCoin size={18} />
      <span dir="ltr" className="tabular-nums">{text}</span>
    </Link>
  );
}
