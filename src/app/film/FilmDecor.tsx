"use client";

/**
 * «الفيلم السينمائي»'s stage: two film reels turning slowly, a strip of film running across, a clapperboard and a
 * spotlight — in the logo's navy, blue and gold, faint behind the work (never in the way: no pointer, no motion when
 * the device asks for less). Its sounds (a projector's click, a reel's whirr) are
 * the site's own (components/UiSounds.tsx).
 */
export default function FilmDecor() {
  return (
    <div className="film-decor" aria-hidden>
      <div className="spot" />
      <Reel className="reel a" />
      <Reel className="reel b" />
      <svg className="strip" viewBox="0 0 1200 120" preserveAspectRatio="none">
        <rect width="1200" height="120" fill="#0b1d47" />
        <g className="strip-holes" fill="#ffffff">
          {Array.from({ length: 70 }, (_, i) => (
            <g key={i}>
              <rect x={i * 20 + 4} y="8" width="10" height="12" rx="2" />
              <rect x={i * 20 + 4} y="100" width="10" height="12" rx="2" />
            </g>
          ))}
        </g>
        {Array.from({ length: 8 }, (_, i) => (
          <rect key={i} x={i * 150 + 12} y="30" width="126" height="60" rx="4" fill={i % 2 ? "#1f63f0" : "#e2a72c"} opacity="0.55" />
        ))}
      </svg>
      <svg className="clap" viewBox="0 0 100 90">
        <g transform="rotate(-12 10 30)">
          <rect x="6" y="20" width="88" height="16" rx="3" fill="#0b1d47" />
          {[0, 1, 2, 3].map((i) => <polygon key={i} points={`${14 + i * 21},20 ${26 + i * 21},20 ${18 + i * 21},36 ${6 + i * 21},36`} fill="#ffffff" />)}
        </g>
        <rect x="6" y="38" width="88" height="48" rx="4" fill="#0b1d47" />
        <rect x="14" y="48" width="72" height="4" rx="2" fill="#e2a72c" />
        <rect x="14" y="60" width="50" height="4" rx="2" fill="#3b8cff" />
        <rect x="14" y="72" width="60" height="4" rx="2" fill="#ffffff" opacity="0.7" />
      </svg>
    </div>
  );
}

/** A film reel: a navy disc with five windows around a dark hub, a gold rim. */
function Reel({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 200 200">
      <circle cx="100" cy="100" r="96" fill="#0b1d47" stroke="#e2a72c" strokeWidth="5" />
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i * 72 * Math.PI) / 180;
        return <circle key={i} cx={Math.round((100 + Math.cos(a) * 52) * 100) / 100} cy={Math.round((100 + Math.sin(a) * 52) * 100) / 100} r="25" fill="#f4f7ff" />;
      })}
      <circle cx="100" cy="100" r="16" fill="#1f63f0" />
      <circle cx="100" cy="100" r="6" fill="#050b1c" />
    </svg>
  );
}
