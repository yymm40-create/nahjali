// The cartoon things floating in the back of «حولني الى الستايل الكرتوني»: a smiling sun, clouds with faces, stars, a
// balloon, a rocket, a fish, hearts and a flower, all drawn here in code (outline + flat colour, like the pictures the
// page makes). Decoration only: hidden from screen readers, never takes a tap.

const INK = "#2a2350";
const stroke = { stroke: INK, strokeWidth: 4, strokeLinejoin: "round", strokeLinecap: "round" } as const;

const Face = ({ x, y }: { x: number; y: number }) => (
  <g fill={INK}>
    <circle cx={x - 9} cy={y} r={3.2} />
    <circle cx={x + 9} cy={y} r={3.2} />
    <path d={`M${x - 7},${y + 8} Q${x},${y + 15} ${x + 7},${y + 8}`} fill="none" {...stroke} strokeWidth={3} />
  </g>
);

const Cloud = ({ className, fill = "#fff" }: { className: string; fill?: string }) => (
  <svg className={className} viewBox="0 0 120 80">
    <path d="M28,64 Q8,64 10,46 Q12,32 30,34 Q34,14 56,16 Q76,14 82,32 Q104,28 108,48 Q110,64 92,64 Z" fill={fill} {...stroke} />
    <Face x={60} y={44} />
  </svg>
);

const Star = ({ className, fill }: { className: string; fill: string }) => (
  <svg className={className} viewBox="0 0 60 60">
    <path d="M30,5 L37,22 L55,23 L41,35 L46,53 L30,43 L14,53 L19,35 L5,23 L23,22 Z" fill={fill} {...stroke} />
    <Face x={30} y={32} />
  </svg>
);

const Heart = ({ className, fill }: { className: string; fill: string }) => (
  <svg className={className} viewBox="0 0 60 56">
    <path d="M30,52 C6,34 4,14 18,9 C25,7 29,11 30,16 C31,11 35,7 42,9 C56,14 54,34 30,52 Z" fill={fill} {...stroke} />
  </svg>
);

export default function Doodles() {
  return (
    <div className="ct-sky" aria-hidden="true">
      {/* a smiling sun */}
      <svg className="d1" viewBox="0 0 120 120">
        {Array.from({ length: 10 }, (_, i) => (
          <line key={i} x1="60" y1="8" x2="60" y2="22" transform={`rotate(${i * 36} 60 60)`} {...stroke} />
        ))}
        <circle cx="60" cy="60" r="32" fill="#ffd23f" {...stroke} />
        <circle cx="48" cy="55" r="4" fill={INK} />
        <circle cx="72" cy="55" r="4" fill={INK} />
        <path d="M46,68 Q60,82 74,68" fill="none" {...stroke} strokeWidth={4} />
        <circle cx="40" cy="66" r="5" fill="#ff8fb1" opacity=".7" />
        <circle cx="80" cy="66" r="5" fill="#ff8fb1" opacity=".7" />
      </svg>
      <Cloud className="d2" />
      {/* a balloon */}
      <svg className="d3" viewBox="0 0 60 110">
        <path d="M30,6 C52,6 56,34 44,52 C40,58 36,60 30,62 C24,60 20,58 16,52 C4,34 8,6 30,6 Z" fill="#ff6fb1" {...stroke} />
        <path d="M30,62 L26,70 L34,70 Z" fill="#ff6fb1" {...stroke} strokeWidth={3} />
        <path d="M30,70 Q22,86 32,100" fill="none" {...stroke} strokeWidth={3} />
        <path d="M18,22 Q20,14 28,12" fill="none" stroke="#fff" strokeWidth={4} strokeLinecap="round" opacity=".8" />
      </svg>
      <Star className="d4" fill="#ffd23f" />
      {/* a rocket */}
      <svg className="d5" viewBox="0 0 80 120">
        <path d="M40,6 C58,24 60,56 54,84 L26,84 C20,56 22,24 40,6 Z" fill="#fff" {...stroke} />
        <circle cx="40" cy="44" r="11" fill="#4cc3ff" {...stroke} />
        <path d="M26,66 L8,92 L26,86 Z M54,66 L72,92 L54,86 Z" fill="#ff6fb1" {...stroke} />
        <path d="M32,86 Q40,112 48,86 Z" fill="#ff9a3c" {...stroke} />
      </svg>
      <Heart className="d6" fill="#ff6fb1" />
      {/* a fish */}
      <svg className="d7" viewBox="0 0 100 64">
        <path d="M8,32 C24,6 62,6 78,32 C62,58 24,58 8,32 Z" fill="#4cc3ff" {...stroke} />
        <path d="M76,32 L96,14 L96,50 Z" fill="#38d9a0" {...stroke} />
        <circle cx="30" cy="27" r="4" fill={INK} />
        <path d="M22,38 Q30,44 38,38" fill="none" {...stroke} strokeWidth={3} />
      </svg>
      {/* a flower */}
      <svg className="d8" viewBox="0 0 110 110">
        {Array.from({ length: 6 }, (_, i) => (
          <ellipse key={i} cx="55" cy="26" rx="14" ry="20" transform={`rotate(${i * 60} 55 55)`} fill={i % 2 ? "#ff6fb1" : "#ff9a3c"} {...stroke} strokeWidth={3} />
        ))}
        <circle cx="55" cy="55" r="16" fill="#ffd23f" {...stroke} />
        <circle cx="50" cy="52" r="2.6" fill={INK} />
        <circle cx="60" cy="52" r="2.6" fill={INK} />
        <path d="M49,60 Q55,66 61,60" fill="none" {...stroke} strokeWidth={3} />
      </svg>
      <Star className="d9" fill="#38d9a0" />
      <Cloud className="d10" fill="#fff6e0" />
    </div>
  );
}
