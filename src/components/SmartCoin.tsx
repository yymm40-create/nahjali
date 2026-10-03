/** «النقود الذكية»: a sky-blue coin (inline SVG, so it works in both themes). */
export default function SmartCoin({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id="smart-coin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#bae6fd" />
          <stop offset="0.5" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#0284c7" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill="url(#smart-coin)" stroke="#0369a1" strokeWidth="1" />
      <circle cx="12" cy="12" r="8" fill="none" stroke="#e0f2fe" strokeWidth="1" opacity="0.8" />
      <path d="M12 6.5l1.5 3.6 3.9.3-3 2.5.9 3.8L12 14.7l-3.3 2 .9-3.8-3-2.5 3.9-.3z" fill="#f0f9ff" />
    </svg>
  );
}
