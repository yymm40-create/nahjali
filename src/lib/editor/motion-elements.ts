// «حيدرة كت» · «مسار الموشن»: motion graphics as ELEMENTS on the timeline, not a rendered video. Each element is one
// clip on the motion track (a text-kind track marked `motion`) carrying what it shows — its kind, its heading, its
// items each with the moment it appears, its place, size, theme and fonts — and the player draws it live from that
// data (render.ts → motion-draw.ts), so every detail stays editable: drag it, stretch it, cut it, change a word, a
// colour or the moment a line comes in. Pure (no DOM): the model, the themes and the safe reader (tested).

/** The elements of the first phase: a title, a list, a phrase with a stressed word, a big number. */
export const MOTION_KINDS = {
  title: { label: "عنوان", icon: "🔤", hint: "عنوان كبير وتحته سطر" },
  list: { label: "قائمة", icon: "📋", hint: "عنوان وبنود تدخل وحدة وحدة" },
  phrase: { label: "عبارة", icon: "💬", hint: "جملة وكلمة منها مميّزة" },
  big: { label: "رقم كبير", icon: "🔢", hint: "رقم يعدّ لين قيمته وتحته وصف" },
  ambient: { label: "عناصر تتحرك", icon: "✨", hint: "خلفية ناعمة: أشكال تطفو بهدوء تحت الكلام" },
} as const;
export type MotionKind = keyof typeof MOTION_KINDS;
export const isMotionKind = (v: unknown): v is MotionKind => typeof v === "string" && v in MOTION_KINDS;

/** The looks an element can wear (the panel, the text, the highlight and the second colour). */
export const MOTION_THEMES = {
  navy: { label: "ليل كحلي", bg: "#0b1530", panel: "#132049", text: "#ffffff", accent: "#3b82f6", second: "#93c5fd" },
  teal: { label: "بحر فيروزي", bg: "#04252b", panel: "#0b3a42", text: "#ffffff", accent: "#14b8a6", second: "#5eead4" },
  gold: { label: "ذهبي فاخر", bg: "#17120a", panel: "#241a0c", text: "#fff7e6", accent: "#d4a537", second: "#f5d27a" },
  rose: { label: "وردي ناعم", bg: "#2a0f1d", panel: "#3d1529", text: "#ffffff", accent: "#ec4899", second: "#f9a8d4" },
  paper: { label: "ورق فاتح", bg: "#f6f1e7", panel: "#ffffff", text: "#1f2937", accent: "#ea580c", second: "#c2410c" },
  comfort: { label: "مريح للعين", bg: "#22405e", panel: "#34587c", text: "#f3f7fb", accent: "#8fb8dd", second: "#c7dcef" },
  mono: { label: "أسود وأبيض", bg: "#0a0a0a", panel: "#171717", text: "#ffffff", accent: "#ffffff", second: "#a3a3a3" },
} as const;
export type MotionThemeId = keyof typeof MOTION_THEMES;
export interface MotionColors {
  bg: string;
  panel: string;
  text: string;
  accent: string;
  second: string;
}

/** How an element (and each of its items) comes in. */
export const MOTION_ENTERS = { rise: "يطلع من تحت", side: "يدخل من الجنب", fade: "يظهر بهدوء", pop: "يكبر بسلاسة" } as const;
export type MotionEnter = keyof typeof MOTION_ENTERS;

/** «عناصر تتحرك»: what floats on the background. */
export const AMBIENT_SHAPES = { orbs: "دوائر ناعمة", khatim: "نجمة ثمانية", stars: "نجوم", sparks: "لمعات" } as const;
export type AmbientShape = keyof typeof AMBIENT_SHAPES;

/** One line of an element: its words and when it comes in (ms from the element's start). */
export interface MotionItem {
  text: string;
  at: number;
}

export interface MotionEl {
  kind: MotionKind;
  /** the heading (the title, the list's name, the phrase itself, the big number's caption) */
  title: string;
  /** a second line under the title / the stressed word of a phrase / the number of «رقم كبير» */
  sub: string;
  /** the list's lines, each with its moment */
  items: MotionItem[];
  /** the element's centre, as fractions of the frame */
  x: number;
  y: number;
  /** 0.5–2 (1 = the designed size) */
  size: number;
  theme: MotionThemeId;
  /** the person's own colours over the theme (null = the theme's) */
  colors: MotionColors | null;
  /** the panel behind the element (off = the words straight on the video) */
  panel: boolean;
  enter: MotionEnter;
  /** the fonts (the editor's catalogue ids) */
  font: string;
  /** a number's unit / prefix around «رقم كبير» (e.g. «٪», «$») */
  unit: string;
  /** «عناصر تتحرك»: the shape that floats */
  shape: AmbientShape;
  /** «عناصر تتحرك»: how fast they drift, 0.25–2 (1 = calm) */
  speed: number;
}

export const MOTION_LIMITS = { title: 120, sub: 80, item: 90, items: 8, unit: 8 } as const;
/** The shortest and the default element on the timeline. */
export const MOTION_MS = { min: 600, default: 4000 } as const;

/** A new element of each kind, ready to show (Arabic sample words the person replaces). */
export function newMotion(kind: MotionKind, o: Partial<MotionEl> = {}): MotionEl {
  const base: MotionEl = { kind, title: "", sub: "", items: [], x: 0.5, y: 0.5, size: 1, theme: "navy", colors: null, panel: true, enter: "rise", font: "readex", unit: "", shape: "orbs", speed: 1 };
  const sample: Record<MotionKind, Partial<MotionEl>> = {
    title: { title: "العنوان", sub: "سطر صغير تحته", y: 0.3 },
    list: { title: "العنوان", items: [{ text: "النقطة الأولى", at: 500 }, { text: "النقطة الثانية", at: 1300 }, { text: "النقطة الثالثة", at: 2100 }], y: 0.62 },
    phrase: { title: "موضوع اللهجة مهم جدًا", sub: "مهم", y: 0.7, panel: false },
    big: { title: "من المتابعين", sub: "250", unit: "K", y: 0.4 },
    ambient: { theme: "comfort", shape: "khatim" },
  };
  return readMotion({ ...base, ...sample[kind], ...o }) ?? base;
}

const str = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").slice(0, max);
const num = (v: unknown, min: number, max: number, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};
const hex = (v: unknown, d: string) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : d);
const FONT_ID = /^[a-z0-9-]{2,40}$/;

/** A stored or received element made safe (null when it is not one). Never throws. */
export function readMotion(v: unknown): MotionEl | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (!isMotionKind(o.kind)) return null;
  const theme: MotionThemeId = typeof o.theme === "string" && o.theme in MOTION_THEMES ? (o.theme as MotionThemeId) : "navy";
  const t = MOTION_THEMES[theme];
  const c = o.colors && typeof o.colors === "object" ? (o.colors as Record<string, unknown>) : null;
  const items = (Array.isArray(o.items) ? o.items : [])
    .slice(0, MOTION_LIMITS.items)
    .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
    .map((i) => ({ text: str(i.text, MOTION_LIMITS.item), at: Math.round(num(i.at, 0, 600_000, 0)) }))
    .sort((a, b) => a.at - b.at);
  return {
    kind: o.kind,
    title: str(o.title, MOTION_LIMITS.title),
    sub: str(o.sub, MOTION_LIMITS.sub),
    items,
    x: num(o.x, 0, 1, 0.5),
    y: num(o.y, 0, 1, 0.5),
    size: num(o.size, 0.5, 2, 1),
    theme,
    colors: c ? { bg: hex(c.bg, t.bg), panel: hex(c.panel, t.panel), text: hex(c.text, t.text), accent: hex(c.accent, t.accent), second: hex(c.second, t.second) } : null,
    panel: o.panel !== false,
    enter: typeof o.enter === "string" && o.enter in MOTION_ENTERS ? (o.enter as MotionEnter) : "rise",
    font: typeof o.font === "string" && FONT_ID.test(o.font) ? o.font : "readex",
    unit: str(o.unit, MOTION_LIMITS.unit),
    shape: typeof o.shape === "string" && o.shape in AMBIENT_SHAPES ? (o.shape as AmbientShape) : "orbs",
    speed: num(o.speed, 0.25, 2, 1),
  };
}

/** The colours an element is drawn with (its own over its theme's). */
export const motionColors = (m: Pick<MotionEl, "theme" | "colors">): MotionColors => m.colors ?? MOTION_THEMES[m.theme];

/** What the timeline shows on the clip (its kind and its first words). */
export const motionLabel = (m: MotionEl) => `${MOTION_KINDS[m.kind].icon} ${m.title || MOTION_KINDS[m.kind].label}`.slice(0, 60);

/** The smooth ease every entrance uses (no bounce: Majed's rules). */
export const easeOut = (p: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 3);

/** How far an entrance is (0 → 1) `ms` after it began; entrances last 280 ms. */
export const ENTER_MS = 280;
export const EXIT_MS = 200;
export const enterAt = (ms: number) => easeOut(ms / ENTER_MS);

/**
 * The element's own clock: how far it has come in at `local` ms of its `length`, and how far it is leaving (the last
 * EXIT_MS). 1 = fully shown.
 */
export function presence(local: number, length: number) {
  const inP = enterAt(local);
  const outP = length > EXIT_MS * 2 ? Math.min(1, Math.max(0, (length - local) / EXIT_MS)) : 1;
  return Math.min(inP, outP);
}

/** «رقم كبير»: the number shown at `local` ms (it counts up over 900 ms, keeping the written decimals and separators). */
export function countedNumber(value: string, local: number) {
  const digits = value.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  const n = Number(digits.replace(/,/g, ""));
  if (!digits || !Number.isFinite(n)) return value;
  const p = easeOut(local / 900);
  const decimals = (digits.split(".")[1] ?? "").length;
  const now = n * p;
  const out = now.toFixed(decimals);
  return digits.includes(",") ? Number(out).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : out;
}
