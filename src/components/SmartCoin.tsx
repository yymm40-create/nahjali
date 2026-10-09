/**
 * «النقود الذكية» — the riyal mark: a rounded coin in sky-blue with the Saudi riyal symbol (the two strokes and the
 * curve of the official 2025 symbol, drawn as paths so it shows in every font and both themes). Keeps its name, so
 * every place that showed a coin now shows the riyal.
 */
export default function SmartCoin({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id="smart-riyal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#bae6fd" />
          <stop offset="0.5" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#0284c7" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="22" height="22" rx="7" fill="url(#smart-riyal)" stroke="#0369a1" strokeWidth="1" />
      {/* the riyal symbol: the tall stroke with its curl, and the two slanted bars */}
      <path d="M9.2 5.2v9.6c0 1.9 1.3 3.1 3.1 3.1h.6" fill="none" stroke="#f0f9ff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.4 5.2v8.2" fill="none" stroke="#f0f9ff" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M6 12.8l10.6-2.4M6.4 16.9l10.2-2.3" fill="none" stroke="#f0f9ff" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
