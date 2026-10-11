// The robots' faces: every assistant of the site is drawn as a ROBOT (never a person), each its own — a head shape,
// eyes, an antenna and a small sign of what it does (صادق's graduation cap, كاظم's beret, سجاد's clapperboard…).
// Plain SVG, no client code: it can be used anywhere, at any size.

type Head = "round" | "square" | "capsule" | "hex" | "tv";
type Eyes = "dots" | "visor" | "big" | "screen" | "lens";
type Antenna = "single" | "double" | "dish" | "none" | "bolt";
type Extra = "cap" | "beret" | "hood" | "headphones" | "clapper" | "bow" | "crescent" | "scissors" | "spark" | "glasses" | "camera" | "pen" | "joystick" | "book" | "none";

interface Look {
  a: string;
  b: string;
  head: Head;
  eyes: Eyes;
  antenna: Antenna;
  extra: Extra;
}

export const ROBOT_LOOKS: Record<string, Look> = {
  salman: { a: "#7c3aed", b: "#ec4899", head: "round", eyes: "big", antenna: "single", extra: "none" },
  jawad: { a: "#f97316", b: "#22d3ee", head: "capsule", eyes: "visor", antenna: "bolt", extra: "spark" },
  sajjad: { a: "#e9b546", b: "#b45309", head: "square", eyes: "dots", antenna: "double", extra: "clapper" },
  haidara: { a: "#84cc16", b: "#15803d", head: "tv", eyes: "screen", antenna: "single", extra: "scissors" },
  sadiq: { a: "#6366f1", b: "#0ea5e9", head: "round", eyes: "big", antenna: "none", extra: "cap" },
  islamic: { a: "#10b981", b: "#065f46", head: "capsule", eyes: "dots", antenna: "none", extra: "crescent" },
  qanbar: { a: "#34d399", b: "#0891b2", head: "hex", eyes: "screen", antenna: "double", extra: "joystick" },
  baqir: { a: "#f472b6", b: "#be185d", head: "square", eyes: "big", antenna: "single", extra: "pen" },
  kazim: { a: "#a78bfa", b: "#6d28d9", head: "round", eyes: "dots", antenna: "none", extra: "beret" },
  zahraa: { a: "#fb7185", b: "#e11d48", head: "capsule", eyes: "lens", antenna: "single", extra: "camera" },
  kharq: { a: "#facc15", b: "#ea580c", head: "hex", eyes: "visor", antenna: "bolt", extra: "spark" },
  abbas: { a: "#38bdf8", b: "#1d4ed8", head: "square", eyes: "big", antenna: "single", extra: "book" },
  zainab: { a: "#c084fc", b: "#7e22ce", head: "round", eyes: "big", antenna: "none", extra: "hood" },
  booklet: { a: "#38bdf8", b: "#2563eb", head: "capsule", eyes: "big", antenna: "double", extra: "book" },
};

const INK = "#0f0b1e";

function head(h: Head, fill: string) {
  switch (h) {
    case "square":
      return <rect x="12" y="16" width="40" height="36" rx="8" fill={fill} />;
    case "capsule":
      return <rect x="11" y="15" width="42" height="38" rx="19" fill={fill} />;
    case "hex":
      return <path d="M32 13 52 24v22L32 57 12 46V24z" fill={fill} />;
    case "tv":
      return <rect x="10" y="18" width="44" height="34" rx="5" fill={fill} />;
    default:
      return <circle cx="32" cy="35" r="20" fill={fill} />;
  }
}

function eyes(e: Eyes) {
  switch (e) {
    case "visor":
      return (
        <>
          <rect x="17" y="28" width="30" height="10" rx="5" fill={INK} />
          <rect x="21" y="31" width="22" height="4" rx="2" fill="#7df9ff" />
        </>
      );
    case "screen":
      return (
        <>
          <rect x="17" y="25" width="30" height="20" rx="4" fill={INK} />
          <circle cx="26" cy="34" r="3" fill="#a3ff7a" />
          <circle cx="38" cy="34" r="3" fill="#a3ff7a" />
        </>
      );
    case "lens":
      return (
        <>
          <circle cx="25" cy="33" r="6.5" fill={INK} />
          <circle cx="25" cy="33" r="3.2" fill="#ffd1dc" />
          <circle cx="40" cy="33" r="4" fill={INK} />
          <circle cx="41" cy="32" r="1.4" fill="#fff" />
        </>
      );
    case "dots":
      return (
        <>
          <circle cx="25" cy="33" r="3.2" fill={INK} />
          <circle cx="39" cy="33" r="3.2" fill={INK} />
        </>
      );
    default:
      return (
        <>
          <circle cx="25" cy="33" r="5.5" fill="#fff" />
          <circle cx="39" cy="33" r="5.5" fill="#fff" />
          <circle cx="26" cy="34" r="2.6" fill={INK} />
          <circle cx="40" cy="34" r="2.6" fill={INK} />
        </>
      );
  }
}

function antenna(a: Antenna, b: string) {
  switch (a) {
    case "single":
      return (
        <>
          <rect x="31" y="6" width="2" height="10" fill={INK} />
          <circle cx="32" cy="6" r="3" fill={b} stroke={INK} strokeWidth="1.2" />
        </>
      );
    case "double":
      return (
        <>
          <path d="M24 16 20 6M40 16l4-10" stroke={INK} strokeWidth="2" strokeLinecap="round" />
          <circle cx="20" cy="6" r="2.6" fill={b} />
          <circle cx="44" cy="6" r="2.6" fill={b} />
        </>
      );
    case "dish":
      return <path d="M24 10a8 8 0 0 0 16 0z" fill={INK} />;
    case "bolt":
      return <path d="M33 2 26 12h5l-2 6 8-11h-5z" fill="#ffe14d" stroke={INK} strokeWidth="1" />;
    default:
      return null;
  }
}

function extra(x: Extra, b: string) {
  switch (x) {
    case "cap":
      return (
        <>
          <path d="M14 15 32 8l18 7-18 7z" fill={INK} />
          <path d="M48 16v7" stroke="#fbbf24" strokeWidth="2" />
          <circle cx="48" cy="24" r="1.8" fill="#fbbf24" />
        </>
      );
    case "beret":
      return <ellipse cx="30" cy="15" rx="17" ry="6" fill="#ef4444" />;
    case "hood":
      // a soft rounded hood around the head (a robot, modestly covered)
      return <path d="M8 40C8 20 20 10 32 10s24 10 24 30v14H50V38C50 26 42 18 32 18S14 26 14 38v16H8z" fill={b} opacity="0.95" />;
    case "headphones":
      return <path d="M10 36a22 22 0 0 1 44 0" fill="none" stroke={INK} strokeWidth="3" />;
    case "clapper":
      return (
        <g transform="translate(40 40)">
          <rect x="0" y="6" width="18" height="12" rx="1.5" fill={INK} />
          <path d="M0 6 17 1l1 4L1 10z" fill="#fff" stroke={INK} strokeWidth="1" />
        </g>
      );
    case "crescent":
      return <path d="M50 8a7 7 0 1 0 6 11 5.5 5.5 0 1 1-6-11z" fill="#fde68a" />;
    case "scissors":
      return (
        <g stroke={INK} strokeWidth="1.6" fill="none">
          <circle cx="47" cy="49" r="3" />
          <circle cx="54" cy="49" r="3" />
          <path d="M48 46 56 36M53 46 45 36" />
        </g>
      );
    case "spark":
      return <path d="M52 6l1.6 4.4L58 12l-4.4 1.6L52 18l-1.6-4.4L46 12l4.4-1.6z" fill="#fff59d" />;
    case "glasses":
      return <path d="M17 33h12m6 0h12" stroke={INK} strokeWidth="2" />;
    case "camera":
      return (
        <g transform="translate(42 42)">
          <rect x="0" y="3" width="16" height="11" rx="2.5" fill={INK} />
          <circle cx="8" cy="8.5" r="3" fill="#fda4af" />
        </g>
      );
    case "pen":
      return <path d="m44 56 12-12 3 3-12 12-4 1z" fill="#fff" stroke={INK} strokeWidth="1.2" />;
    case "joystick":
      return (
        <g transform="translate(42 44)">
          <rect x="0" y="6" width="16" height="9" rx="3" fill={INK} />
          <rect x="7" y="0" width="2" height="7" fill={INK} />
          <circle cx="8" cy="0" r="2.6" fill="#ef4444" />
        </g>
      );
    case "book":
      return (
        <g transform="translate(42 44)">
          <path d="M0 2h7a2 2 0 0 1 2 2v11a2 2 0 0 0-2-2H0zM18 2h-7a2 2 0 0 0-2 2v11a2 2 0 0 1 2-2h7z" fill="#fff" stroke={INK} strokeWidth="1.1" />
        </g>
      );
    default:
      return null;
  }
}

/** A robot's face. `id`: salman · jawad · sajjad · haidara · sadiq · islamic · qanbar · baqir · kazim · zahraa · kharq · abbas · zainab · booklet. */
export default function RobotFace({ id, size = 40, className = "", title }: { id: string; size?: number; className?: string; title?: string }) {
  const l = ROBOT_LOOKS[id] ?? ROBOT_LOOKS.salman;
  const g = `rf-${id}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title} style={{ display: "inline-block", verticalAlign: "middle", flex: "none" }}>
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={l.a} />
          <stop offset="1" stopColor={l.b} />
        </linearGradient>
      </defs>
      {l.extra === "hood" && extra("hood", l.b)}
      {antenna(l.antenna, l.a)}
      {/* ears / bolts on the sides: every face reads as a machine */}
      <rect x="6" y="30" width="6" height="10" rx="2" fill={INK} />
      <rect x="52" y="30" width="6" height="10" rx="2" fill={INK} />
      {head(l.head, `url(#${g})`)}
      <rect x="22" y="45" width="20" height="4" rx="2" fill={INK} opacity="0.8" />
      <rect x="25" y="46" width="2" height="2" fill="#fff" />
      <rect x="31" y="46" width="2" height="2" fill="#fff" />
      <rect x="37" y="46" width="2" height="2" fill="#fff" />
      {eyes(l.eyes)}
      {l.extra !== "hood" && extra(l.extra, l.b)}
    </svg>
  );
}
