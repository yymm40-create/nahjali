// The robots' faces: every assistant of the site is drawn as a ROBOT (never a person), each its own — a head shape,
// eyes, an antenna and a small sign of what it does (صادق's graduation cap, كاظم's beret, سجاد's clapperboard…).
// Plain SVG, no client code: it can be used anywhere, at any size.

type Head = "round" | "square" | "capsule" | "hex" | "tv";
type Eyes = "dots" | "visor" | "big" | "screen" | "lens";
type Antenna = "single" | "double" | "dish" | "none" | "bolt";
type Extra = "cap" | "beret" | "hood" | "headphones" | "clapper" | "bow" | "crescent" | "scissors" | "spark" | "glasses" | "camera" | "pen" | "joystick" | "book" | "dumbbell" | "none";

interface Look {
  a: string;
  b: string;
  head: Head;
  eyes: Eyes;
  antenna: Antenna;
  extra: Extra;
}

export const ROBOT_LOOKS: Record<string, Look> = {
  // deep, muted metals — never candy colours: each robot is one dark hue lit from above, with a gold trim
  salman: { a: "#5b4b9a", b: "#2e2466", head: "round", eyes: "big", antenna: "single", extra: "none" },
  jawad: { a: "#3a6ea5", b: "#1b3a63", head: "capsule", eyes: "visor", antenna: "bolt", extra: "none" },
  sajjad: { a: "#86661f", b: "#4a340d", head: "square", eyes: "dots", antenna: "double", extra: "clapper" },
  haidara: { a: "#4d7c4f", b: "#243f2a", head: "tv", eyes: "screen", antenna: "single", extra: "scissors" },
  sadiq: { a: "#4a5aa8", b: "#232c63", head: "round", eyes: "big", antenna: "none", extra: "cap" },
  islamic: { a: "#2f7a62", b: "#12423a", head: "capsule", eyes: "dots", antenna: "none", extra: "crescent" },
  qanbar: { a: "#3b7a7a", b: "#1a3f4a", head: "hex", eyes: "screen", antenna: "double", extra: "joystick" },
  baqir: { a: "#8e4668", b: "#4a1f36", head: "square", eyes: "big", antenna: "single", extra: "pen" },
  kazim: { a: "#6b52a0", b: "#33245c", head: "round", eyes: "dots", antenna: "none", extra: "beret" },
  zahraa: { a: "#a04a58", b: "#521f2c", head: "capsule", eyes: "lens", antenna: "single", extra: "camera" },
  kharq: { a: "#8a6a24", b: "#4a3410", head: "hex", eyes: "visor", antenna: "bolt", extra: "none" },
  abbas: { a: "#3d6d9e", b: "#1b3556", head: "square", eyes: "big", antenna: "single", extra: "book" },
  zainab: { a: "#7a4f98", b: "#3a2255", head: "round", eyes: "big", antenna: "none", extra: "hood" },
  booklet: { a: "#3d7ab0", b: "#1d3f6a", head: "capsule", eyes: "big", antenna: "double", extra: "book" },
  // «عباس سبع القنطرة»: the coach of «الصحة العلوية» in «لأجل المهدي» — dark iron, a dumbbell in hand
  sabaa: { a: "#74822f", b: "#3d4619", head: "square", eyes: "visor", antenna: "bolt", extra: "dumbbell" },
};

const INK = "#0b0a14";
/** The trim on every face, and the steady light of its eyes: aged gold and a warm pale glow. */
const GOLD = "#d4b46a";
const GLOW = "#f1dc9f";

/**
 * The heads are heavy and squared off, none of them a ball: a chamfered plate, a tall helm, a broad screen. They all sit
 * between y 14 and y 50, above the collar.
 */
function head(h: Head, fill: string) {
  switch (h) {
    case "square":
      return <path d="M18 14h28l6 6v24l-6 6H18l-6-6V20z" fill={fill} />;
    case "capsule":
      return <path d="M20 14h24a8 8 0 0 1 8 8v20a8 8 0 0 1-8 8H20a8 8 0 0 1-8-8V22a8 8 0 0 1 8-8z" fill={fill} />;
    case "hex":
      return <path d="M32 12 51 22v20L32 52 13 42V22z" fill={fill} />;
    case "tv":
      return <rect x="10" y="16" width="44" height="34" rx="6" fill={fill} />;
    default:
      // "round": a domed helm with a flat jaw, not a circle
      return <path d="M12 50V32C12 21 21 13 32 13s20 8 20 19v18z" fill={fill} />;
  }
}

/** Calm, level, unblinking: a steady glow behind dark glass, never white eyes with pupils. */
function eyes(e: Eyes) {
  switch (e) {
    case "visor":
      return (
        <>
          <rect x="16" y="28" width="32" height="9" rx="3" fill={INK} />
          <rect x="20" y="31.2" width="24" height="2.6" rx="1.3" fill={GLOW} />
        </>
      );
    case "screen":
      return (
        <>
          <rect x="16" y="25" width="32" height="18" rx="3" fill={INK} />
          <rect x="21" y="32" width="8" height="3.2" rx="1.6" fill={GLOW} />
          <rect x="35" y="32" width="8" height="3.2" rx="1.6" fill={GLOW} />
        </>
      );
    case "lens":
      return (
        <>
          <rect x="16" y="27" width="32" height="12" rx="4" fill={INK} />
          <circle cx="32" cy="33" r="4.2" fill="none" stroke={GLOW} strokeWidth="1.6" />
          <circle cx="32" cy="33" r="1.5" fill={GLOW} />
        </>
      );
    case "dots":
      return (
        <>
          <rect x="17" y="28" width="30" height="10" rx="4" fill={INK} />
          <circle cx="25" cy="33" r="2.4" fill={GLOW} />
          <circle cx="39" cy="33" r="2.4" fill={GLOW} />
        </>
      );
    default:
      // "big": two tall, narrow lights under a heavy brow
      return (
        <>
          <rect x="16" y="26" width="32" height="13" rx="4" fill={INK} />
          <rect x="22" y="29" width="5" height="7" rx="2.5" fill={GLOW} />
          <rect x="37" y="29" width="5" height="7" rx="2.5" fill={GLOW} />
        </>
      );
  }
}

/** Short and upright: a mast with a small gold cap. Nothing waves, nothing is a lightning bolt. */
function antenna(a: Antenna) {
  switch (a) {
    case "single":
      return (
        <>
          <rect x="31.2" y="6" width="1.6" height="8" fill={INK} />
          <rect x="29.6" y="3.5" width="4.8" height="3.5" rx="1" fill={GOLD} />
        </>
      );
    case "double":
      return (
        <>
          <rect x="21.2" y="7" width="1.6" height="7" fill={INK} />
          <rect x="41.2" y="7" width="1.6" height="7" fill={INK} />
          <rect x="19.8" y="4.6" width="4.4" height="3" rx="1" fill={GOLD} />
          <rect x="39.8" y="4.6" width="4.4" height="3" rx="1" fill={GOLD} />
        </>
      );
    case "dish":
      return <path d="M25 13a7 7 0 0 1 14 0z" fill={INK} />;
    case "bolt":
      // a small gold finial, like the top of a standard
      return (
        <>
          <rect x="31.2" y="7" width="1.6" height="7" fill={INK} />
          <path d="M32 1.5 35 5.5 32 9.5 29 5.5z" fill={GOLD} stroke={INK} strokeWidth="0.8" />
        </>
      );
    default:
      return null;
  }
}

/** One small sign of what the robot does, drawn in dark metal and gold. */
function extra(x: Extra, b: string) {
  switch (x) {
    case "cap":
      return (
        <>
          <path d="M15 14 32 7.5 49 14 32 20.5z" fill={INK} />
          <path d="M46 15.5v7" stroke={GOLD} strokeWidth="1.6" />
          <rect x="44.6" y="22" width="2.8" height="3.4" rx="1" fill={GOLD} />
        </>
      );
    case "beret":
      return <path d="M13 17c0-5 8-8 19-8s19 3 19 8c0 1.5-1 2.4-3 2.4H16c-2 0-3-.9-3-2.4z" fill="#5a1f2e" stroke={INK} strokeWidth="0.8" />;
    case "hood":
      // a plain hood around the head, modest and heavy
      return <path d="M8 44C8 22 19 10 32 10s24 12 24 34v14c0 3-2 5-5 5H13c-3 0-5-2-5-5z" fill={b} opacity="0.95" />;
    case "headphones":
      return <path d="M10 36a22 22 0 0 1 44 0" fill="none" stroke={INK} strokeWidth="3" />;
    case "clapper":
      return (
        <g transform="translate(43 49)">
          <rect x="0" y="5" width="14" height="9" rx="1.2" fill={INK} />
          <path d="M0 5 13.5 1.4l.8 3.2L.8 8.2z" fill={GOLD} stroke={INK} strokeWidth="0.8" />
        </g>
      );
    case "crescent":
      return <path d="M50 7a6.4 6.4 0 1 0 5.4 10 5 5 0 1 1-5.4-10z" fill={GOLD} />;
    case "scissors":
      return (
        <g stroke={GOLD} strokeWidth="1.5" fill="none" transform="translate(-2 4)">
          <circle cx="47" cy="49" r="2.6" />
          <circle cx="53" cy="49" r="2.6" />
          <path d="M48 46.5 55 38M52 46.5 45 38" />
        </g>
      );
    case "spark":
      // no sparkle: the mark of the one that makes things is a small gold seal on the brow
      return <path d="M32 15.5 34.2 19 32 22.5 29.8 19z" fill={GOLD} stroke={INK} strokeWidth="0.7" />;
    case "glasses":
      return <path d="M17 33h12m6 0h12" stroke={INK} strokeWidth="2" />;
    case "camera":
      return (
        <g transform="translate(43 49)">
          <rect x="0" y="3" width="14" height="9" rx="2" fill={INK} />
          <circle cx="7" cy="7.5" r="2.4" fill="none" stroke={GOLD} strokeWidth="1.3" />
        </g>
      );
    case "pen":
      return <path d="m46 58 8-8 2.4 2.4-8 8-3.4 1z" fill={GOLD} stroke={INK} strokeWidth="1" />;
    case "joystick":
      return (
        <g transform="translate(43 49)">
          <rect x="0" y="6" width="14" height="7" rx="2.4" fill={INK} />
          <rect x="6.2" y="1" width="1.6" height="6" fill={INK} />
          <circle cx="7" cy="1" r="2.2" fill={GOLD} />
        </g>
      );
    case "book":
      return (
        <g transform="translate(43 49)">
          <path d="M0 2h6a2 2 0 0 1 2 2v9a2 2 0 0 0-2-2H0zM16 2h-6a2 2 0 0 0-2 2v9a2 2 0 0 1 2-2h6z" fill={GOLD} stroke={INK} strokeWidth="0.9" />
        </g>
      );
    case "dumbbell":
      return (
        <g transform="translate(41 50)">
          <rect x="3" y="5.2" width="12" height="2.6" rx="1" fill={INK} />
          <rect x="0" y="1.5" width="4" height="10" rx="1.2" fill={GOLD} stroke={INK} strokeWidth="0.8" />
          <rect x="14" y="1.5" width="4" height="10" rx="1.2" fill={GOLD} stroke={INK} strokeWidth="0.8" />
        </g>
      );
    default:
      return null;
  }
}

/**
 * A robot's face — sober and weighty, never comic: a heavy squared head in one deep metal with a gold trim, level glowing
 * eyes behind dark glass, a flat mouth-groove (not a smile), and a broad collar under it.
 * `id`: salman · jawad · sajjad · haidara · sadiq · islamic · qanbar · baqir · kazim · zahraa · kharq · abbas · zainab · booklet · sabaa.
 */
export default function RobotFace({ id, size = 40, className = "", title }: { id: string; size?: number; className?: string; title?: string }) {
  const l = ROBOT_LOOKS[id] ?? ROBOT_LOOKS.salman;
  const g = `rf-${id}`;
  const body = `${g}-body`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title} style={{ display: "inline-block", verticalAlign: "middle", flex: "none" }}>
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={l.a} />
          <stop offset="1" stopColor={l.b} />
        </linearGradient>
        <linearGradient id={body} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={l.a} stopOpacity="0.75" />
          <stop offset="1" stopColor={l.b} />
        </linearGradient>
      </defs>
      {l.extra === "hood" && extra("hood", l.b)}
      {antenna(l.antenna)}
      {/* the shoulders: a broad collar under the head, with a gold line, so the face has weight to sit on */}
      <path d="M6 63c0-6 5-10 12-11l14-1 14 1c7 1 12 5 12 11z" fill={`url(#${body})`} />
      <path d="M20 52.5 32 54l12-1.5" stroke={GOLD} strokeWidth="1.2" fill="none" opacity="0.8" />
      <rect x="26" y="49" width="12" height="5" rx="1.5" fill={INK} />
      {/* ear plates on the sides */}
      <rect x="7" y="27" width="5" height="12" rx="1.6" fill={INK} />
      <rect x="52" y="27" width="5" height="12" rx="1.6" fill={INK} />
      {head(l.head, `url(#${g})`)}
      {/* the gold trim, and a light from above along the top edge */}
      <g fill="none" stroke={GOLD} strokeOpacity="0.55" strokeWidth="1.1" style={{ mixBlendMode: "normal" }}>
        {head(l.head, "none")}
      </g>
      {/* a flat groove for a mouth: calm, level */}
      <rect x="24" y="43" width="16" height="1.8" rx="0.9" fill={INK} opacity="0.7" />
      {eyes(l.eyes)}
      {l.extra !== "hood" && extra(l.extra, l.b)}
    </svg>
  );
}
