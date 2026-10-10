// «موشن على كلامه» — the looks («ستايلات») a talking reel's graphics take: the panel the person's words land on (a
// notebook page, a comic panel, a neon grid, a blueprint, a chalkboard…), its colours (changing from one moment to the
// next), the fonts of its titles, how the words sit on it, and the entrances that bring each one in (never the same
// twice in a row; never a bounce or a growth from nothing — the house rule). What talking-reel editors do: the frame changes every 3–7 s (a split screen, the person in a
// corner, a box, a punch-in), every key word lands on its own designed card, and one look holds the whole reel so the
// variety reads as design, not noise. Pure: the panels are SVG strings the server turns into pictures.

import type { AnimKind } from "./model";

export type TalkStyleId =
  | "notebook"
  | "comic"
  | "neon"
  | "blueprint"
  | "chalk"
  | "paper"
  | "glass"
  | "retro"
  | "news"
  | "sticker"
  | "minimal"
  | "gradient"
  | "doodle"
  | "grain";

export interface TalkStyle {
  id: TalkStyleId;
  ar: string;
  icon: string;
  /** what it looks like, for حيدرة and the person */
  hint: string;
  /** the panels' colours, used in turn (each moment a different one) */
  panels: string[];
  /** the words' colour on a panel, and the highlight colour (numbers, the word's card) */
  ink: string;
  accent: string;
  /** the card under a key word: a filled pill, a sticker (white with a dark edge), a marker stroke, or none */
  card: "pill" | "sticker" | "marker" | "none";
  /** the titles' font and the small words' font (ids of fonts.ts) */
  title: string;
  body: string;
  /** the entrances the words use in turn, and the panel's own */
  enter: AnimKind[];
  panelIn: AnimKind;
}

export const TALK_STYLES: TalkStyle[] = [
  { id: "notebook", ar: "دفتر", icon: "📓", hint: "ورقة دفتر بسطور زرقاء وهامش أحمر، خط يد، تحديد بالقلم الفسفوري وخربشات", panels: ["#fffdf5", "#fff8e1", "#f6fbff"], ink: "#1f2a44", accent: "#e11d48", card: "marker", title: "playpen-sans-arabic", body: "playpen-sans-arabic", enter: ["wipe", "whip", "settle", "rise"], panelIn: "rise" },
  { id: "comic", ar: "كوميك", icon: "💥", hint: "لوحة كوميكس: نقاط هالفتون، حدود سوداء سميكة، انفجار ألوان وكلمات تضرب", panels: ["#ffd60a", "#ff4d6d", "#4cc9f0", "#80ed99"], ink: "#111111", accent: "#ffffff", card: "sticker", title: "lalezar", body: "baloo-bhaijaan-2", enter: ["punch", "shake", "whip", "settle"], panelIn: "punch" },
  { id: "neon", ar: "نيون", icon: "🌃", hint: "ليل وشبكة نيون متوهجة، ألوان سيان ووردي، دخول قلتش وفلاش", panels: ["#0b0620", "#05121f", "#140024"], ink: "#e0fbff", accent: "#ff2bd6", card: "none", title: "handjet", body: "readex-pro", enter: ["glitch", "flash", "blur", "whip"], panelIn: "glitch" },
  { id: "blueprint", ar: "مخطط هندسي", icon: "📐", hint: "ورق أزرق بشبكة ومقاسات وخطوط هندسية، كتابة واضحة", panels: ["#0f3d7a", "#123c69", "#0b2e59"], ink: "#e8f1ff", accent: "#ffd166", card: "none", title: "ibm-plex-sans-arabic", body: "ibm-plex-sans-arabic", enter: ["wipe", "fromRight", "fade", "settle"], panelIn: "wipe" },
  { id: "chalk", ar: "سبورة", icon: "🧑‍🏫", hint: "سبورة خضراء أو سوداء بآثار طباشير وكتابة يدوية", panels: ["#1e3a2f", "#232b2b", "#20332a"], ink: "#f5f5f0", accent: "#ffe66d", card: "none", title: "aref-ruqaa", body: "playpen-sans-arabic", enter: ["wipe", "fade", "rise", "settle"], panelIn: "fade" },
  { id: "paper", ar: "ورق مقصوص", icon: "✂️", hint: "طبقات ورق مقصوص بظلال ناعمة وحواف ممزقة", panels: ["#f4a261", "#2a9d8f", "#e9c46a", "#e76f51"], ink: "#1d1d1d", accent: "#ffffff", card: "sticker", title: "marhey", body: "tajawal", enter: ["whip", "flip", "settle", "fromLeft"], panelIn: "whip" },
  { id: "glass", ar: "زجاج", icon: "🫧", hint: "زجاج شفاف ضبابي فوق بقع ألوان ناعمة، عصري ونظيف", panels: ["#1b1f3b", "#0f172a", "#1e1b4b"], ink: "#ffffff", accent: "#a5f3fc", card: "pill", title: "alexandria", body: "alexandria", enter: ["blur", "rise", "settle", "fade"], panelIn: "blur" },
  { id: "retro", ar: "ريترو الثمانينات", icon: "🌅", hint: "شمس مخططة وغروب وشبكة أفق، ألوان الثمانينات", panels: ["#2b1055", "#3d0c5c", "#1a0b3b"], ink: "#fff1d6", accent: "#ff9e00", card: "pill", title: "rakkas", body: "changa", enter: ["whip", "fromRight", "punch", "rise"], panelIn: "whip" },
  { id: "news", ar: "جريدة", icon: "📰", hint: "ورق جرايد بأعمدة وعنوان عريض وشريط عاجل", panels: ["#f2efe6", "#ebe6d6", "#f7f4ea"], ink: "#111111", accent: "#c1121f", card: "pill", title: "el-messiri", body: "amiri", enter: ["flash", "settle", "fromLeft", "wipe"], panelIn: "flash" },
  { id: "sticker", ar: "ستيكرات", icon: "🏷️", hint: "ألوان حلوة وستيكرات بحواف بيضاء ونجوم وقلوب", panels: ["#ffafcc", "#bde0fe", "#caffbf", "#ffd6a5"], ink: "#1d1d1d", accent: "#ffffff", card: "sticker", title: "lemonada", body: "baloo-bhaijaan-2", enter: ["punch", "flip", "whip", "punch"], panelIn: "punch" },
  { id: "minimal", ar: "مينيمال جريء", icon: "⬛", hint: "لونين بس، مساحة فاضية، عناوين ضخمة وقطع حاد", panels: ["#111111", "#f5f5f5", "#ff3b30"], ink: "#ffffff", accent: "#ff3b30", card: "none", title: "cairo", body: "cairo", enter: ["punch", "fromRight", "whip", "settle"], panelIn: "fromRight" },
  { id: "gradient", ar: "تدرجات", icon: "🌈", hint: "بقع ألوان متدرجة ناعمة وكروت مستديرة، ستايل التطبيقات", panels: ["#6d28d9", "#0ea5e9", "#db2777", "#059669"], ink: "#ffffff", accent: "#fde047", card: "pill", title: "rubik", body: "readex-pro", enter: ["rise", "settle", "blur", "punch"], panelIn: "rise" },
  { id: "doodle", ar: "خربشة كرتون", icon: "🖍️", hint: "كرتون مرسوم باليد: خطوط متعرجة ونجوم وأسهم بألوان كرايون", panels: ["#fff4e6", "#e7f5ff", "#fff0f6", "#ebfbee"], ink: "#212529", accent: "#f03e3e", card: "marker", title: "reem-kufi-fun", body: "playpen-sans-arabic", enter: ["whip", "shake", "punch", "wipe"], panelIn: "whip" },
  { id: "grain", ar: "فيلم قديم", icon: "🎞️", hint: "حبيبات فيلم ولون دافئ باهت وإطار فيلم، رصين وسينمائي", panels: ["#2b2118", "#3a2c20", "#1f1a14"], ink: "#f2e6d0", accent: "#e9a23b", card: "none", title: "el-messiri", body: "markazi-text", enter: ["fade", "blur", "settle", "kashida"], panelIn: "fade" },
];

export const talkStyleOf = (id: unknown): TalkStyle | null => TALK_STYLES.find((s) => s.id === id) ?? null;

/** The style named in the person's words («ستايل دفتر», «كوميك», «نيون»…), or null. */
export function talkStyleInText(text: string): TalkStyle | null {
  const t = text.toLowerCase();
  const words: Record<TalkStyleId, RegExp> = {
    notebook: /دفتر|نوت ?بوك|notebook|كراس/,
    comic: /كوميك|comic|كوميكس/,
    neon: /نيون|neon/,
    blueprint: /مخطط|بلوبرنت|blueprint|هندسي/,
    chalk: /سبور|طباشير|chalk/,
    paper: /ورق مقصوص|قص ورق|paper ?cut/,
    glass: /زجاج|glass/,
    retro: /ريترو|retro|ثمانين/,
    news: /جريد|صحيف|news/,
    sticker: /ستيكر|ملصق|sticker/,
    minimal: /مينيمال|minimal|بسيط جري/,
    gradient: /تدرج|قريدينت|gradient/,
    doodle: /خربش|كرتون|كرايون|doodle|cartoon/,
    grain: /فيلم قديم|حبيبات|grain|سينمائي قديم/,
  };
  return TALK_STYLES.find((s) => words[s.id].test(t)) ?? null;
}

/** The style for a plan: the one named, else one picked from the reel's own words (stable for the same reel). */
export function pickTalkStyle(id: unknown, seed: string): TalkStyle {
  const named = talkStyleOf(id);
  if (named) return named;
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TALK_STYLES[h % TALK_STYLES.length];
}

// ───────── colours ─────────

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const lum = (hex: string) => {
  const [r, g, b] = rgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrastOf = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
/** A colour that reads on `bg`: the style's ink when it does, else black or white, whichever reads better. */
export const inkOn = (bg: string, ink: string) => (contrastOf(ink, bg) >= 4.5 ? ink : contrastOf("#111111", bg) >= contrastOf("#ffffff", bg) ? "#111111" : "#ffffff");

// ───────── the panels ─────────

/** A see-through window cut in a panel (the person shows through it), in px of the panel. */
export interface Hole {
  x: number;
  y: number;
  w: number;
  h: number;
  /** a circle (the person in a corner) or a rounded box */
  round: boolean;
}

/** A small repeatable random (the same panel for the same reel and moment). */
function rand(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const esc = (n: number) => +n.toFixed(1);

/** The decorations of a style on a w×h panel. */
function decor(st: TalkStyle, w: number, h: number, bg: string, r: () => number): string {
  const ink = inkOn(bg, st.ink);
  const out: string[] = [];
  switch (st.id) {
    case "notebook": {
      const step = Math.round(h / 22);
      for (let y = step * 2; y < h; y += step) out.push(`<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="#93c5fd" stroke-width="3"/>`);
      out.push(`<line x1="${w - 90}" y1="0" x2="${w - 90}" y2="${h}" stroke="#f87171" stroke-width="4"/>`);
      for (let i = 0; i < 3; i++) out.push(`<circle cx="${w - 45}" cy="${esc(h * (0.2 + i * 0.3))}" r="18" fill="#e5e7eb" stroke="#cbd5e1" stroke-width="3"/>`);
      out.push(`<path d="M ${esc(w * 0.08)} ${esc(h * 0.9)} q 30 -40 60 0 t 60 0 t 60 0" fill="none" stroke="${st.accent}" stroke-width="6" stroke-linecap="round"/>`);
      break;
    }
    case "comic": {
      const dots: string[] = [];
      for (let y = 20; y < h; y += 34) for (let x = (y / 34) % 2 ? 37 : 20; x < w; x += 34) dots.push(`<circle cx="${x}" cy="${y}" r="${esc(4 + 5 * (y / h))}"/>`);
      out.push(`<g fill="#000" fill-opacity="0.12">${dots.join("")}</g>`);
      const cx = w * (0.2 + 0.6 * r()), cy = h * (0.2 + 0.6 * r());
      const pts = Array.from({ length: 24 }, (_, i) => {
        const a = (i / 24) * Math.PI * 2, R = (i % 2 ? 0.28 : 0.45) * Math.min(w, h);
        return `${esc(cx + Math.cos(a) * R)},${esc(cy + Math.sin(a) * R)}`;
      }).join(" ");
      out.push(`<polygon points="${pts}" fill="#ffffff" fill-opacity="0.35"/>`);
      out.push(`<rect x="10" y="10" width="${w - 20}" height="${h - 20}" fill="none" stroke="#111" stroke-width="18"/>`);
      break;
    }
    case "neon": {
      const hz = h * 0.62;
      for (let i = 0; i < 12; i++) {
        const y = hz + (h - hz) * (i / 11) ** 1.8;
        out.push(`<line x1="0" y1="${esc(y)}" x2="${w}" y2="${esc(y)}" stroke="#00f5ff" stroke-opacity="0.45" stroke-width="3"/>`);
      }
      for (let i = -8; i <= 8; i++) out.push(`<line x1="${esc(w / 2 + i * 30)}" y1="${esc(hz)}" x2="${esc(w / 2 + i * 260)}" y2="${h}" stroke="#ff2bd6" stroke-opacity="0.4" stroke-width="3"/>`);
      out.push(`<rect x="30" y="30" width="${w - 60}" height="${h - 60}" rx="40" fill="none" stroke="#00f5ff" stroke-width="8" filter="url(#glow)"/>`);
      break;
    }
    case "blueprint": {
      for (let x = 0; x < w; x += 40) out.push(`<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="#ffffff" stroke-opacity="${x % 200 ? 0.08 : 0.2}" stroke-width="2"/>`);
      for (let y = 0; y < h; y += 40) out.push(`<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="#ffffff" stroke-opacity="${y % 200 ? 0.08 : 0.2}" stroke-width="2"/>`);
      out.push(`<circle cx="${esc(w * 0.82)}" cy="${esc(h * 0.2)}" r="${esc(Math.min(w, h) * 0.12)}" fill="none" stroke="#fff" stroke-opacity="0.5" stroke-width="3" stroke-dasharray="12 10"/>`);
      out.push(`<path d="M 60 ${h - 60} h 220 M 60 ${h - 72} v 24 M 280 ${h - 72} v 24" stroke="#ffd166" stroke-width="4"/>`);
      break;
    }
    case "chalk": {
      for (let i = 0; i < 7; i++) out.push(`<ellipse cx="${esc(w * r())}" cy="${esc(h * r())}" rx="${esc(80 + 160 * r())}" ry="${esc(20 + 40 * r())}" fill="#ffffff" fill-opacity="0.05"/>`);
      out.push(`<rect x="0" y="0" width="${w}" height="${h}" fill="none" stroke="#7c5c3b" stroke-width="36"/>`);
      out.push(`<path d="M ${esc(w * 0.1)} ${esc(h * 0.86)} l 80 -12 l 70 10" stroke="#fff" stroke-opacity="0.6" stroke-width="6" fill="none" stroke-linecap="round"/>`);
      break;
    }
    case "paper": {
      for (let i = 0; i < 3; i++) {
        const y0 = h * (0.15 + i * 0.3 + 0.08 * r());
        const pts = Array.from({ length: 14 }, (_, k) => `${esc((w * k) / 13)},${esc(y0 + (r() - 0.5) * 40)}`).join(" L ");
        out.push(`<path d="M 0 ${h} L ${pts} L ${w} ${h} Z" fill="#000" fill-opacity="0.12" transform="translate(0 10)"/><path d="M 0 ${h} L ${pts} L ${w} ${h} Z" fill="#ffffff" fill-opacity="${0.12 + i * 0.06}"/>`);
      }
      break;
    }
    case "glass": {
      const blobs = ["#22d3ee", "#a78bfa", "#f472b6", "#34d399"];
      for (let i = 0; i < 4; i++) out.push(`<circle cx="${esc(w * r())}" cy="${esc(h * r())}" r="${esc(Math.min(w, h) * (0.25 + 0.2 * r()))}" fill="${blobs[i]}" fill-opacity="0.55" filter="url(#soft)"/>`);
      out.push(`<rect x="${esc(w * 0.06)}" y="${esc(h * 0.08)}" width="${esc(w * 0.88)}" height="${esc(h * 0.84)}" rx="48" fill="#ffffff" fill-opacity="0.12" stroke="#ffffff" stroke-opacity="0.45" stroke-width="3"/>`);
      break;
    }
    case "retro": {
      const R = Math.min(w, h) * 0.3, cx = w / 2, cy = h * 0.55;
      out.push(`<defs><linearGradient id="sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd23f"/><stop offset="1" stop-color="#ff006e"/></linearGradient></defs><circle cx="${cx}" cy="${esc(cy)}" r="${esc(R)}" fill="url(#sun)"/>`);
      for (let i = 0; i < 6; i++) out.push(`<rect x="0" y="${esc(cy + R * (0.15 + i * 0.15))}" width="${w}" height="${esc(4 + i * 3)}" fill="${bg}"/>`);
      for (let i = 0; i < 10; i++) out.push(`<line x1="0" y1="${esc(cy + R + i * i * 6)}" x2="${w}" y2="${esc(cy + R + i * i * 6)}" stroke="#ff006e" stroke-opacity="0.5" stroke-width="3"/>`);
      break;
    }
    case "news": {
      for (let c = 0; c < 3; c++) for (let y = 120; y < h - 40; y += 26) out.push(`<rect x="${esc(40 + (c * (w - 80)) / 3)}" y="${y}" width="${esc((w - 80) / 3 - 30)}" height="8" fill="#000" fill-opacity="${0.08 + 0.04 * r()}"/>`);
      out.push(`<rect x="0" y="30" width="${w}" height="60" fill="#c1121f"/><rect x="0" y="100" width="${w}" height="6" fill="#111"/>`);
      break;
    }
    case "sticker": {
      const shapes = ["★", "♥", "✿", "●", "✦"];
      for (let i = 0; i < 10; i++) out.push(`<text x="${esc(w * r())}" y="${esc(h * r())}" font-size="${esc(40 + 60 * r())}" fill="#ffffff" fill-opacity="0.7" stroke="#1d1d1d" stroke-opacity="0.25" stroke-width="2" transform="rotate(${esc(-30 + 60 * r())} ${esc(w * 0.5)} ${esc(h * 0.5)})">${shapes[i % shapes.length]}</text>`);
      break;
    }
    case "minimal": {
      out.push(`<rect x="${esc(w * 0.08)}" y="${esc(h * 0.12)}" width="${esc(w * 0.12)}" height="12" fill="${st.accent}"/>`);
      break;
    }
    case "gradient": {
      const cols = ["#f472b6", "#22d3ee", "#facc15", "#34d399", "#818cf8"];
      for (let i = 0; i < 3; i++) out.push(`<circle cx="${esc(w * r())}" cy="${esc(h * r())}" r="${esc(Math.min(w, h) * (0.35 + 0.2 * r()))}" fill="${cols[Math.floor(r() * cols.length)]}" fill-opacity="0.6" filter="url(#soft)"/>`);
      break;
    }
    case "doodle": {
      const crayon = ["#f03e3e", "#1c7ed6", "#37b24d", "#f59f00", "#ae3ec9"];
      for (let i = 0; i < 6; i++) {
        const x = w * r(), y = h * r(), c = crayon[i % crayon.length];
        out.push(
          i % 3 === 0
            ? `<path d="M ${esc(x)} ${esc(y)} q 20 -30 40 0 t 40 0 t 40 0" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round"/>`
            : i % 3 === 1
              ? `<path d="M ${esc(x)} ${esc(y - 30)} l 9 21 23 2 -17 15 6 23 -21 -12 -21 12 6 -23 -17 -15 23 -2 z" fill="none" stroke="${c}" stroke-width="6" stroke-linejoin="round"/>`
              : `<path d="M ${esc(x)} ${esc(y)} c 30 -10 60 -10 90 0 m -16 -14 l 16 14 -16 12" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round"/>`,
        );
      }
      out.push(`<rect x="14" y="14" width="${w - 28}" height="${h - 28}" rx="30" fill="none" stroke="${ink}" stroke-width="7" stroke-dasharray="40 14"/>`);
      break;
    }
    case "grain": {
      out.push(`<rect x="0" y="0" width="${w}" height="${h}" filter="url(#noise)" opacity="0.35"/>`);
      for (let y = 20; y < h; y += 70) out.push(`<rect x="14" y="${y}" width="22" height="34" rx="6" fill="#000" fill-opacity="0.6"/><rect x="${w - 36}" y="${y}" width="22" height="34" rx="6" fill="#000" fill-opacity="0.6"/>`);
      out.push(`<rect x="0" y="0" width="${w}" height="${h}" fill="url(#vig)"/>`);
      break;
    }
  }
  return out.join("");
}

/**
 * A designed panel of the style: w×h px, filled with `bg` and the style's decorations; `hole` cuts a window the
 * person shows through, with a frame around it in the style (a polaroid edge, a comic border, a neon ring…).
 */
export function panelSvg(st: TalkStyle, w: number, h: number, bg: string, seed: number, hole?: Hole | null): string {
  const r = rand(seed);
  const defs = `<defs>
<filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="60"/></filter>
<filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
<radialGradient id="vig" cx="50%" cy="50%" r="75%"><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.65"/></radialGradient>
${hole ? `<mask id="hole"><rect x="0" y="0" width="${w}" height="${h}" fill="#fff"/>${hole.round ? `<ellipse cx="${esc(hole.x + hole.w / 2)}" cy="${esc(hole.y + hole.h / 2)}" rx="${esc(hole.w / 2)}" ry="${esc(hole.h / 2)}" fill="#000"/>` : `<rect x="${esc(hole.x)}" y="${esc(hole.y)}" width="${esc(hole.w)}" height="${esc(hole.h)}" rx="${esc(Math.min(hole.w, hole.h) * 0.08)}" fill="#000"/>`}</mask>` : ""}
</defs>`;
  const frame = hole ? holeFrame(st, hole) : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs}<g${hole ? ` mask="url(#hole)"` : ""}><rect x="0" y="0" width="${w}" height="${h}" fill="${bg}"/>${decor(st, w, h, bg, r)}</g>${frame}</svg>`;
}

/** The frame around the window the person shows through, in the style. */
function holeFrame(st: TalkStyle, h: Hole): string {
  const stroke: Record<TalkStyleId, [string, number, string?]> = {
    notebook: ["#ffffff", 22],
    comic: ["#111111", 16],
    neon: ["#00f5ff", 10, ` filter="url(#glow)"`],
    blueprint: ["#ffd166", 6],
    chalk: ["#f5f5f0", 8],
    paper: ["#ffffff", 18],
    glass: ["#ffffff", 6],
    retro: ["#ff9e00", 10],
    news: ["#111111", 8],
    sticker: ["#ffffff", 20],
    minimal: [st.accent, 10],
    gradient: ["#ffffff", 8],
    doodle: ["#212529", 8],
    grain: ["#f2e6d0", 6],
  };
  const [c, sw, extra = ""] = stroke[st.id];
  const shape = h.round
    ? `<ellipse cx="${esc(h.x + h.w / 2)}" cy="${esc(h.y + h.h / 2)}" rx="${esc(h.w / 2)}" ry="${esc(h.h / 2)}"`
    : `<rect x="${esc(h.x)}" y="${esc(h.y)}" width="${esc(h.w)}" height="${esc(h.h)}" rx="${esc(Math.min(h.w, h.h) * 0.08)}"`;
  return `${shape} fill="none" stroke="${c}" stroke-width="${sw}"${extra}/>`;
}

/** A divider along the cut of a split screen (a stripe in the style's accent). */
export function dividerSvg(st: TalkStyle, w: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="24" viewBox="0 0 ${w} 24"><rect x="0" y="4" width="${w}" height="16" fill="${st.accent}"/><rect x="0" y="4" width="${w}" height="4" fill="#ffffff" fill-opacity="0.5"/></svg>`;
}

/** What حيدرة is told about the looks (the ids and what each looks like). */
export const TALK_STYLES_SKILL = TALK_STYLES.map((s) => `"${s.id}" ${s.icon} «${s.ar}» — ${s.hint}`).join("; ");
