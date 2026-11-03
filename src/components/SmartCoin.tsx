"use client";

import { useCoinTone, type CoinTone } from "@/components/usePerks";

/**
 * «النقود الذكية» — the riyal mark: a rounded coin in sky-blue with the Saudi riyal symbol (the two strokes and the
 * curve of the official 2025 symbol, drawn as paths so it shows in every font and both themes). Keeps its name, so
 * every place that showed a coin now shows the riyal.
 *
 * ORANGE for whoever entered a code that prices everything at the tool's cost (the owner's «الأكواد»): their coin is
 * orange everywhere, and nobody else ever sees it. RED for an e-mail on the owner's «🔴 النقود الحمراء» list (/admin/access:
 * the platform's own price, no profit, no rounding). `tone` forces one (the dashboard shows them).
 */
const LOOK: Record<CoinTone, { id: string; stops: [string, string, string]; edge: string }> = {
  sky: { id: "smart-riyal", stops: ["#bae6fd", "#38bdf8", "#0284c7"], edge: "#0369a1" },
  orange: { id: "smart-riyal-orange", stops: ["#fed7aa", "#fb923c", "#ea580c"], edge: "#c2410c" },
  red: { id: "smart-riyal-red", stops: ["#fecaca", "#f87171", "#dc2626"], edge: "#b91c1c" },
};

export default function SmartCoin({ size = 20, className = "", tone }: { size?: number; className?: string; tone?: CoinTone }) {
  // the person's own colour: their codes (orange) and the owner's red list
  const own = useCoinTone();
  const look = LOOK[tone ?? own];
  const { id, stops } = look;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden data-coin={tone ?? own}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={stops[0]} />
          <stop offset="0.5" stopColor={stops[1]} />
          <stop offset="1" stopColor={stops[2]} />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="22" height="22" rx="7" fill={`url(#${id})`} stroke={look.edge} strokeWidth="1" />
      {/* the riyal symbol: the tall stroke with its curl, and the two slanted bars */}
      <path d="M9.2 5.2v9.6c0 1.9 1.3 3.1 3.1 3.1h.6" fill="none" stroke="#fff7ed" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.4 5.2v8.2" fill="none" stroke="#fff7ed" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M6 12.8l10.6-2.4M6.4 16.9l10.2-2.3" fill="none" stroke="#fff7ed" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
