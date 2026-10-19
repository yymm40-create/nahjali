"use client";

import { useAtCost } from "@/components/usePerks";

/**
 * «النقود الذكية» — the riyal mark: a rounded coin in sky-blue with the Saudi riyal symbol (the two strokes and the
 * curve of the official 2025 symbol, drawn as paths so it shows in every font and both themes). Keeps its name, so
 * every place that showed a coin now shows the riyal.
 *
 * ORANGE for whoever entered a code that prices everything at the tool's cost (the owner's «الأكواد»): their coin is
 * orange everywhere, and nobody else ever sees it. `tone` forces one (the dashboard shows both).
 */
export default function SmartCoin({ size = 20, className = "", tone }: { size?: number; className?: string; tone?: "sky" | "orange" }) {
  const own = useAtCost();
  const orange = tone ? tone === "orange" : own;
  const id = orange ? "smart-riyal-orange" : "smart-riyal";
  const stops = orange ? ["#fed7aa", "#fb923c", "#ea580c"] : ["#bae6fd", "#38bdf8", "#0284c7"];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden data-coin={orange ? "orange" : "sky"}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={stops[0]} />
          <stop offset="0.5" stopColor={stops[1]} />
          <stop offset="1" stopColor={stops[2]} />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="22" height="22" rx="7" fill={`url(#${id})`} stroke={orange ? "#c2410c" : "#0369a1"} strokeWidth="1" />
      {/* the riyal symbol: the tall stroke with its curl, and the two slanted bars */}
      <path d="M9.2 5.2v9.6c0 1.9 1.3 3.1 3.1 3.1h.6" fill="none" stroke="#fff7ed" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.4 5.2v8.2" fill="none" stroke="#fff7ed" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M6 12.8l10.6-2.4M6.4 16.9l10.2-2.3" fill="none" stroke="#fff7ed" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
