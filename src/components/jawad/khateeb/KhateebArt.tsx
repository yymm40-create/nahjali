// «الخطيب الذكي»'s pictures: the Husseini minbar under a mihrab arch, a black banner, lanterns and a carpet, with «الشيخ»
// (a robot in a white turban, like every assistant of the site — never a person) on its seat; and the two turbans of the
// pulpit's preachers, the white of the sheikh and the black of the sayyid. Plain SVG, no client code.
import RobotFace from "@/components/RobotFace";

const GOLD = "#c9a04a";
const WOOD = "#7a4a22";
const WOOD_DARK = "#4e2d12";

/** A turban seen from the front: `sayyid` black (the Prophet's descendants), otherwise white (a sheikh). */
export function Turban({ sayyid = false, size = 22 }: { sayyid?: boolean; size?: number }) {
  const fill = sayyid ? "#16151a" : "#f6f2e7";
  const wrap = sayyid ? "#3d3b46" : "#c9c0a6";
  const band = sayyid ? "#25232b" : "#e9e2cf";
  return (
    <svg width={size} height={size * 0.56} viewBox="7 0 50 28" aria-hidden style={{ display: "inline-block", verticalAlign: "middle", flex: "none" }}>
      <path d="M8.5 24C6.5 13 16 2.5 32 1.8S57.5 13 55.5 24c-.3 2-1.8 3.2-3.8 3.2H12.3c-2 0-3.5-1.2-3.8-3.2z" fill={fill} stroke="#1b1a14" strokeWidth="0.9" />
      <g fill="none" stroke={wrap} strokeWidth="1.3" strokeLinecap="round">
        <path d="M11 20.5C17 10 30 5.5 45 6.8" />
        <path d="M12 24.2C19 14 33 9.5 50 11.8" />
        <path d="M53 20.5C47 10.5 36 6 22 6.5" />
        <path d="M47 25.4C42 17 32 12.5 15 13.5" />
      </g>
      <path d="M9.3 22.6C20 20 44 20 54.7 22.6l-.4 3.6C44 23.8 20 23.8 9.7 26.2z" fill={band} stroke="#1b1a14" strokeWidth="0.6" />
    </svg>
  );
}

/** The hero picture: a mihrab arch, a black banner «يا حسين», two lanterns, the minbar's steps and seat, and «الشيخ». */
export function MinbarScene({ className = "" }: { className?: string }) {
  const steps = [0, 1, 2, 3, 4, 5];
  return (
    <svg viewBox="0 0 400 360" className={className} role="img" aria-label="منبر حسيني تحت قوس المحراب، وعليه الشيخ">
      <defs>
        <linearGradient id="kh-arch" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#13684a" />
          <stop offset="1" stopColor="#0a3b2a" />
        </linearGradient>
        <linearGradient id="kh-wood" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9a6331" />
          <stop offset="1" stopColor={WOOD_DARK} />
        </linearGradient>
        <radialGradient id="kh-lamp-glow">
          <stop offset="0" stopColor="#ffe6a3" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffe6a3" stopOpacity="0" />
        </radialGradient>
        <pattern id="kh-lattice" width="12" height="12" patternUnits="userSpaceOnUse">
          <path d="M6 0 12 6 6 12 0 6z" fill="none" stroke={GOLD} strokeWidth="0.9" opacity="0.7" />
        </pattern>
        <clipPath id="kh-side">
          <path d="M128 318 252 182V318z" />
        </clipPath>
      </defs>

      {/* the mihrab arch, green, with a gold frame and a band of stars */}
      <path d="M70 320V160C70 92 128 48 200 26c72 22 130 66 130 134v160z" fill="url(#kh-arch)" />
      <path d="M70 320V160C70 92 128 48 200 26c72 22 130 66 130 134v160" fill="none" stroke={GOLD} strokeWidth="4" />
      <path d="M86 320V164c0-60 50-98 114-118 64 20 114 58 114 118v156" fill="none" stroke={GOLD} strokeWidth="1.2" opacity="0.6" />
      <g fill={GOLD} opacity="0.4">
        {[104, 140, 176, 212].map((x) => (
          <path key={x} d={`M${x} 150l3 7 7 3-7 3-3 7-3-7-7-3 7-3z`} />
        ))}
      </g>

      {/* the black banner hung across the arch */}
      <path d="M96 98h208v34c-26-8-52-12-104-12S122 124 96 132z" fill="#121116" />
      <path d="M96 98h208" stroke={GOLD} strokeWidth="2" />
      <text x="200" y="118" textAnchor="middle" fontSize="20" fontWeight="700" fill="#e8cf8a" style={{ fontFamily: "var(--font-amiri), serif" }}>
        يا حسين
      </text>

      {/* two lanterns on chains */}
      {[124, 232].map((x, i) => (
        <g key={x} className="kh-lamp" style={{ animationDelay: `${-i * 2.5}s` }}>
          <path d={`M${x} 34v14`} stroke="#2a2418" strokeWidth="1.2" />
          <circle className="kh-glow" cx={x} cy="64" r="22" fill="url(#kh-lamp-glow)" />
          <path d={`M${x - 8} 48h16l-3 6h-10z`} fill={GOLD} />
          <path d={`M${x - 9} 54h18l-2 18h-14z`} fill="#f3d27a" stroke={GOLD} strokeWidth="1.2" />
          <path d={`M${x - 7} 72h14l-3 6h-8z`} fill={GOLD} />
          <path d={`M${x} 56v14`} stroke="#b07a25" strokeWidth="0.8" />
        </g>
      ))}

      {/* the carpet */}
      <rect x="18" y="318" width="364" height="34" rx="3" fill="#7d1d22" />
      <rect x="24" y="323" width="352" height="24" rx="2" fill="none" stroke={GOLD} strokeWidth="1.2" opacity="0.8" />
      <g fill={GOLD} opacity="0.7">
        {[60, 130, 200, 270, 340].map((x) => (
          <path key={x} d={`M${x} 328l7 7-7 7-7-7z`} />
        ))}
      </g>

      {/* the minbar: the steps rise to the seat under a small dome */}
      <path d="M128 318 252 182V318z" fill="url(#kh-wood)" />
      <rect x="128" y="182" width="124" height="136" fill="url(#kh-lattice)" clipPath="url(#kh-side)" />
      <path d="M128 318 252 182" stroke={WOOD_DARK} strokeWidth="5" strokeLinecap="round" />
      <path d="M128 318 252 182" stroke={GOLD} strokeWidth="1.2" />
      {steps.map((i) => (
        <rect key={i} x={138 + i * 19} y={300 - i * 21} width="20" height="5" fill={WOOD_DARK} opacity="0.85" />
      ))}
      {/* the gate at the foot of the steps */}
      <rect x="112" y="250" width="10" height="70" fill={WOOD} />
      <rect x="140" y="250" width="10" height="70" fill={WOOD} />
      <path d="M110 252c0-18 8-28 21-34 13 6 21 16 21 34z" fill={WOOD} stroke={GOLD} strokeWidth="1.2" />
      <circle cx="131" cy="214" r="2.6" fill={GOLD} />

      {/* the seat and its canopy */}
      <rect x="252" y="182" width="62" height="136" fill={WOOD} />
      <rect x="258" y="196" width="50" height="116" fill="url(#kh-lattice)" opacity="0.8" />
      <rect x="252" y="176" width="62" height="10" rx="2" fill={WOOD_DARK} />
      <rect x="254" y="104" width="7" height="74" fill={WOOD} />
      <rect x="305" y="104" width="7" height="74" fill={WOOD} />
      <path d="M250 106c0-22 14-36 33-44 19 8 33 22 33 44z" fill={WOOD} stroke={GOLD} strokeWidth="1.4" />
      <path d="M283 62v-10" stroke={GOLD} strokeWidth="2" />
      <path d="M283 44a5 5 0 1 0 4 8 4 4 0 1 1-4-8z" fill={GOLD} />

      {/* «الشيخ» on the seat */}
      <g transform="translate(257 116)">
        <RobotFace id="sheikh" size={52} />
      </g>
    </svg>
  );
}
