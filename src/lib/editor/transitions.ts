// «الانتقالات»: 100 ways from one clip to the next, around the cut, for any length the person picks. Each is a preset
// of a recipe; `transitionLook` says, for a moment p (0 → 1), how the outgoing clip (a) and the incoming one (b) look:
// moved, scaled, turned, squashed, blurred, shown through a shape (a mask), with a passing effect, or under a flash.
// Pure (the server checks ids with it; the page draws with it). The first six ids are the editor's old ones.

export const TR_CATS = {
  basic: "أساسي",
  push: "دفع وانزلاق",
  squeeze: "كشف وعصر",
  zoom: "تقريب",
  spin: "دوران وثلاثي",
  wipe: "مسح",
  shape: "أشكال",
  pattern: "نقوش",
  light: "ضوء",
  fx: "قلتش وحركة",
} as const;
export type TrCat = keyof typeof TR_CATS;

export type MaskShape = "linear" | "circle" | "diamond" | "square" | "heart" | "star" | "triangle" | "hexagon" | "ellipse" | "cross" | "clock" | "barn" | "blinds" | "checker" | "dots" | "mosaic" | "stagger";

/** What part of the frame a clip shows: grows with `p` from nothing (0) to everything (1). */
export interface TrMask {
  shape: MaskShape;
  p: number;
  /** linear/barn: the direction (radians; 0 = from the right, as Arabic reads) */
  angle?: number;
  /** blinds, checker, dots, mosaic, stagger: how many */
  n?: number;
  /** clock: counter-clockwise; barn: closing */
  rev?: boolean;
  /** blinds/stagger: vertical */
  v?: boolean;
}

export interface TrLook {
  alpha?: number;
  dx?: number;
  dy?: number;
  scale?: number;
  sx?: number;
  sy?: number;
  rotate?: number;
  /** blur, a fraction of the frame's height */
  blur?: number;
  mask?: TrMask;
  /** a passing clip effect (effects.ts) */
  fx?: { id: string; amount: number }[];
}

export interface TrFrame {
  a: TrLook;
  b: TrLook;
  /** b drawn under a (normally b is on top) */
  bUnder?: boolean;
  /** a colour over everything (a dip or a flash) */
  solid?: { color: string; alpha: number };
}

type Params = Record<string, number | string | boolean>;
interface TrPreset {
  id: string;
  label: string;
  icon: string;
  cat: TrCat;
  base: string;
  p: Params;
}
type Row = [id: string, label: string, icon: string, cat: TrCat, base: string, p?: Params];

const D = { l: Math.PI, r: 0, u: -Math.PI / 2, d: Math.PI / 2 };

const ROWS: Row[] = [
  // ── basic (8) — the first three keep the old ids
  ["fade", "تلاشي", "◐", "basic", "dissolve"],
  ["black", "عبر الأسود", "●", "basic", "dip", { color: "#000000" }],
  ["white", "وميض أبيض", "○", "basic", "dip", { color: "#ffffff" }],
  ["dipGold", "عبر الذهبي", "🟡", "basic", "dip", { color: "#e9b546" }],
  ["dipBlue", "عبر الأزرق", "🔵", "basic", "dip", { color: "#1d4ed8" }],
  ["dipPink", "عبر الوردي", "🩷", "basic", "dip", { color: "#ec4899" }],
  ["softDissolve", "تلاشي ناعم", "🌫️", "basic", "dissolve", { blur: 0.02 }],
  ["flashDissolve", "تلاشي مضيء", "✨", "basic", "dissolve", { bright: 1 }],
  // ── push & slide (8)
  ["slide", "دفع لليسار", "⇠", "push", "push", { dx: -1, dy: 0 }],
  ["pushRight", "دفع لليمين", "⇢", "push", "push", { dx: 1, dy: 0 }],
  ["pushUp", "دفع لفوق", "⇡", "push", "push", { dx: 0, dy: -1 }],
  ["pushDown", "دفع لتحت", "⇣", "push", "push", { dx: 0, dy: 1 }],
  ["slideLeft", "انزلاق فوق من اليمين", "◁", "push", "slide", { dx: -1, dy: 0 }],
  ["slideRight", "انزلاق فوق من اليسار", "▷", "push", "slide", { dx: 1, dy: 0 }],
  ["slideUp", "انزلاق من تحت", "△", "push", "slide", { dx: 0, dy: -1 }],
  ["slideDown", "انزلاق من فوق", "▽", "push", "slide", { dx: 0, dy: 1 }],
  // ── uncover & squeeze (8)
  ["uncoverLeft", "كشف لليسار", "⫷", "squeeze", "uncover", { dx: -1, dy: 0 }],
  ["uncoverRight", "كشف لليمين", "⫸", "squeeze", "uncover", { dx: 1, dy: 0 }],
  ["uncoverUp", "كشف لفوق", "⤒", "squeeze", "uncover", { dx: 0, dy: -1 }],
  ["uncoverDown", "كشف لتحت", "⤓", "squeeze", "uncover", { dx: 0, dy: 1 }],
  ["squeezeH", "عصر أفقي", "⇔", "squeeze", "squeeze", { axis: "x" }],
  ["squeezeV", "عصر عمودي", "⇕", "squeeze", "squeeze", { axis: "y" }],
  ["stretchIn", "مطّ للداخل", "↔", "squeeze", "stretch", { k: 1 }],
  ["stretchOut", "مطّ للخارج", "↕", "squeeze", "stretch", { k: -1 }],
  // ── zoom (10)
  ["zoom", "تكبير", "⤢", "zoom", "zoom", { a: 1.6, b: 0.85 }],
  ["zoomOutT", "تصغير", "⤡", "zoom", "zoom", { a: 0.6, b: 1.3 }],
  ["punchIn", "زووم صدمة", "💥", "zoom", "zoom", { a: 2.4, b: 1.4, hard: true }],
  ["punchOut", "زووم ارتداد", "🎯", "zoom", "zoom", { a: 0.4, b: 0.6, hard: true }],
  ["zoomBlurT", "زووم ضبابي", "🌀", "zoom", "zoom", { a: 1.8, b: 0.7, blur: 0.02, fx: "echoZoom" }],
  ["zoomSpin", "زووم مع دوران", "🌪️", "zoom", "spin", { deg: 120, scale: 1.8 }],
  ["zoomFlash", "زووم بفلاش", "⚡", "zoom", "zoom", { a: 1.7, b: 0.8, flash: "#ffffff" }],
  ["crossZoom", "زووم متقاطع", "✳️", "zoom", "zoom", { a: 2, b: 2, blur: 0.015 }],
  ["dollyIn", "دخول عميق", "🎥", "zoom", "zoom", { a: 3, b: 0.95 }],
  ["pullBack", "رجوع للخلف", "🔭", "zoom", "zoom", { a: 0.3, b: 1.05 }],
  // ── spin & 3D (10)
  ["spinT", "دوران", "🔄", "spin", "spin", { deg: 180, scale: 1 }],
  ["spinCCW", "دوران عكسي", "🔃", "spin", "spin", { deg: -180, scale: 1 }],
  ["spinZoom", "دوران وتكبير", "💫", "spin", "spin", { deg: 360, scale: 2.2 }],
  ["flipX", "قلب أفقي", "↹", "spin", "flip", { axis: "x" }],
  ["flipY", "قلب عمودي", "⇳", "spin", "flip", { axis: "y" }],
  ["cubeLeft", "مكعب لليسار", "🧊", "spin", "cube", { dir: -1 }],
  ["cubeRight", "مكعب لليمين", "📦", "spin", "cube", { dir: 1 }],
  ["swing", "أرجوحة", "🎢", "spin", "swing", {}],
  ["roll", "دحرجة", "🎳", "spin", "roll", { dir: 1 }],
  ["tumble", "سقطة", "🤸", "spin", "roll", { dir: -1, drop: true }],
  // ── wipe (14)
  ["wipe", "مسح من اليمين", "▧", "wipe", "wipe", { angle: D.r }],
  ["wipeLeft", "مسح من اليسار", "◧", "wipe", "wipe", { angle: D.l }],
  ["wipeUp", "مسح من تحت", "⬒", "wipe", "wipe", { angle: D.d }],
  ["wipeDown", "مسح من فوق", "⬓", "wipe", "wipe", { angle: D.u }],
  ["wipeDiagTL", "مسح قطري ↖", "◤", "wipe", "wipe", { angle: (-3 * Math.PI) / 4 }],
  ["wipeDiagTR", "مسح قطري ↗", "◥", "wipe", "wipe", { angle: -Math.PI / 4 }],
  ["wipeDiagBL", "مسح قطري ↙", "◣", "wipe", "wipe", { angle: (3 * Math.PI) / 4 }],
  ["wipeDiagBR", "مسح قطري ↘", "◢", "wipe", "wipe", { angle: Math.PI / 4 }],
  ["clock", "عقارب الساعة", "🕐", "wipe", "mask", { shape: "clock" }],
  ["clockCCW", "عكس الساعة", "🕘", "wipe", "mask", { shape: "clock", rev: true }],
  ["barnH", "باب ينفتح", "🚪", "wipe", "mask", { shape: "barn", angle: 0 }],
  ["barnV", "باب من النص", "🎚️", "wipe", "mask", { shape: "barn", angle: Math.PI / 2 }],
  ["barnClose", "باب يتسكّر", "🚧", "wipe", "mask", { shape: "barn", angle: 0, rev: true }],
  ["wipeSoft", "مسح ناعم", "🌗", "wipe", "wipe", { angle: D.r, soft: true }],
  // ── shapes (10)
  ["iris", "دائرة", "⚪", "shape", "mask", { shape: "circle" }],
  ["irisClose", "دائرة تتسكّر", "⚫", "shape", "irisOut"],
  ["diamond", "معيّن", "🔷", "shape", "mask", { shape: "diamond" }],
  ["squareT", "مربع", "⬜", "shape", "mask", { shape: "square" }],
  ["heart", "قلب", "❤️", "shape", "mask", { shape: "heart" }],
  ["star", "نجمة", "⭐", "shape", "mask", { shape: "star" }],
  ["triangle", "مثلث", "🔺", "shape", "mask", { shape: "triangle" }],
  ["hexagon", "سداسي", "⬡", "shape", "mask", { shape: "hexagon" }],
  ["ellipse", "بيضاوي", "🥚", "shape", "mask", { shape: "ellipse" }],
  ["cross", "علامة زائد", "➕", "shape", "mask", { shape: "cross" }],
  // ── patterns (10)
  ["blindsH", "ستائر أفقية", "☰", "pattern", "mask", { shape: "blinds", n: 8 }],
  ["blindsV", "ستائر عمودية", "▥", "pattern", "mask", { shape: "blinds", n: 8, v: true }],
  ["blindsWide", "ستائر عريضة", "▤", "pattern", "mask", { shape: "blinds", n: 4 }],
  ["checker", "شطرنج", "▦", "pattern", "mask", { shape: "checker", n: 8 }],
  ["checkerBig", "شطرنج كبير", "🏁", "pattern", "mask", { shape: "checker", n: 4 }],
  ["mosaicT", "مربعات عشوائية", "🧩", "pattern", "mask", { shape: "mosaic", n: 10 }],
  ["dotsT", "نقاط", "🔘", "pattern", "mask", { shape: "dots", n: 9 }],
  ["staggerRows", "صفوف متتالية", "📶", "pattern", "mask", { shape: "stagger", n: 6 }],
  ["staggerCols", "أعمدة متتالية", "📊", "pattern", "mask", { shape: "stagger", n: 6, v: true }],
  ["blindsFine", "ستائر رفيعة", "≣", "pattern", "mask", { shape: "blinds", n: 16 }],
  // ── light (8)
  ["flashWhite", "فلاش أبيض", "⚪", "light", "flash", { color: "#ffffff" }],
  ["flashGold", "فلاش ذهبي", "🌟", "light", "flash", { color: "#ffd65c" }],
  ["leakWarmT", "تسريب ضوء دافئ", "🔥", "light", "fxDissolve", { fx: "leakWarm" }],
  ["leakPinkT", "تسريب وردي", "🌸", "light", "fxDissolve", { fx: "leakPink" }],
  ["glowT", "توهج", "💡", "light", "fxDissolve", { fx: "bloomStrong" }],
  ["burn", "حرق فيلم", "🎞️", "light", "burn"],
  ["flareSweep", "وهج يمر", "🌅", "light", "fxDissolve", { fx: "lensFlare" }],
  ["sparkleT", "لمعة", "✨", "light", "fxDissolve", { fx: "goldSparkle" }],
  // ── glitch & motion (14)
  ["glitchT", "قلتش", "📺", "fx", "fxCut", { fx: "glitchLight" }],
  ["glitchHeavyT", "قلتش قوي", "👾", "fx", "fxCut", { fx: "glitchHeavy" }],
  ["rgbSplitT", "انقسام ألوان", "🌈", "fx", "fxCut", { fx: "rgbSplit" }],
  ["tvOff", "تلفزيون ينطفي", "📴", "fx", "tvOff"],
  ["staticT", "تشويش", "📡", "fx", "fxCut", { fx: "tvStatic" }],
  ["pixelT", "بكسلة", "🟪", "fx", "fxCut", { fx: "pixelBurst", steady: true }],
  ["whipLeft", "سحبة لليسار", "💨", "fx", "whip", { dx: -1, dy: 0 }],
  ["whipRight", "سحبة لليمين", "🌬️", "fx", "whip", { dx: 1, dy: 0 }],
  ["whipUp", "سحبة لفوق", "🚀", "fx", "whip", { dx: 0, dy: -1 }],
  ["whipDown", "سحبة لتحت", "🪂", "fx", "whip", { dx: 0, dy: 1 }],
  ["shakeT", "اهتزاز", "🫨", "fx", "fxCut", { fx: "earthquake" }],
  ["rippleT", "تموّج", "🌊", "fx", "fxDissolve", { fx: "jelly" }],
  ["kaleidoT", "مشكال", "🔯", "fx", "fxDissolve", { fx: "kaleido" }],
  ["blurWhip", "ضباب سريع", "🌫️", "fx", "dissolve", { blur: 0.04, fast: true }],
];

export const TR_LIST: TrPreset[] = ROWS.map(([id, label, icon, cat, base, p]) => ({ id, label, icon, cat, base, p: p ?? {} }));
export const TR_BY_ID = new Map(TR_LIST.map((t) => [t.id, t]));

const ease = (p: number) => p * p * (3 - 2 * p);
const outExpo = (p: number) => (p >= 1 ? 1 : 1 - 2 ** (-10 * p));
const inExpo = (p: number) => (p <= 0 ? 0 : 2 ** (10 * p - 10));
const num = (p: Params, k: string, d: number) => (typeof p[k] === "number" ? (p[k] as number) : d);
const str = (p: Params, k: string, d: string) => (typeof p[k] === "string" ? (p[k] as string) : d);

/** How the two clips look at moment `p` (0 → 1) of transition `id`. */
export function transitionLook(id: string, p0: number): TrFrame {
  const t = TR_BY_ID.get(id) ?? TR_BY_ID.get("fade")!;
  const p = Math.min(1, Math.max(0, p0));
  const e = ease(p);
  const P = t.p;
  switch (t.base) {
    case "dissolve": {
      const q = P.fast ? ease(Math.min(1, Math.max(0, (p - 0.3) / 0.4))) : e;
      const blur = num(P, "blur", 0) * Math.sin(Math.PI * p);
      return {
        a: { blur },
        b: { alpha: q, blur },
        solid: P.bright ? { color: "#ffffff", alpha: 0.5 * Math.sin(Math.PI * p) } : undefined,
      };
    }
    case "dip":
      return p < 0.5 ? { a: {}, b: { alpha: 0 }, solid: { color: str(P, "color", "#000"), alpha: 1 - Math.abs(2 * p - 1) } } : { a: { alpha: 0 }, b: {}, solid: { color: str(P, "color", "#000"), alpha: 1 - Math.abs(2 * p - 1) } };
    case "push": {
      const dx = num(P, "dx", -1);
      const dy = num(P, "dy", 0);
      return { a: { dx: dx * e, dy: dy * e }, b: { dx: dx * (e - 1), dy: dy * (e - 1) } };
    }
    case "slide": {
      const dx = num(P, "dx", -1);
      const dy = num(P, "dy", 0);
      const q = outExpo(p);
      return { a: { scale: 1 - 0.06 * q, alpha: 1 - 0.3 * q }, b: { dx: -dx * (1 - q), dy: -dy * (1 - q) } };
    }
    case "uncover": {
      const q = inExpo(p) * 0.4 + e * 0.6;
      return { a: { dx: num(P, "dx", -1) * q, dy: num(P, "dy", 0) * q }, b: { scale: 0.94 + 0.06 * e }, bUnder: true };
    }
    case "squeeze": {
      const x = str(P, "axis", "x") === "x";
      return p < 0.5
        ? { a: x ? { sx: Math.max(0.001, 1 - 2 * e) } : { sy: Math.max(0.001, 1 - 2 * e) }, b: { alpha: 0 } }
        : { a: { alpha: 0 }, b: x ? { sx: Math.max(0.001, 2 * e - 1) } : { sy: Math.max(0.001, 2 * e - 1) } };
    }
    case "stretch": {
      const k = num(P, "k", 1);
      return { a: { sx: 1 + 0.8 * e * k, alpha: 1 - e }, b: { sx: 1 + 0.8 * (1 - e) * -k, alpha: e } };
    }
    case "zoom": {
      const a = num(P, "a", 1.6);
      const b = num(P, "b", 0.85);
      const q = P.hard ? outExpo(p) : e;
      const blur = num(P, "blur", 0) * Math.sin(Math.PI * p);
      const fx = P.fx ? [{ id: String(P.fx), amount: Math.sin(Math.PI * p) }] : undefined;
      return {
        a: { scale: 1 + (a - 1) * q, alpha: P.hard ? (p < 0.5 ? 1 : 0) : 1 - q, blur, fx },
        b: { scale: b + (1 - b) * q, alpha: P.hard ? (p < 0.5 ? 0 : 1) : q, blur, fx },
        solid: P.flash ? { color: String(P.flash), alpha: Math.max(0, 1 - Math.abs(p - 0.5) * 5) } : undefined,
      };
    }
    case "spin": {
      const deg = num(P, "deg", 180);
      const s = num(P, "scale", 1);
      return p < 0.5
        ? { a: { rotate: deg * e, scale: 1 + (s - 1) * e - 0.3 * Math.sin(Math.PI * p) }, b: { alpha: 0 } }
        : { a: { alpha: 0 }, b: { rotate: -deg * (1 - e), scale: 1 + (s - 1) * (1 - e) - 0.3 * Math.sin(Math.PI * p) } };
    }
    case "flip": {
      const x = str(P, "axis", "x") === "x";
      const k = Math.abs(Math.cos(Math.PI * e));
      const side = (v: number) => (x ? { sx: Math.max(0.001, v) } : { sy: Math.max(0.001, v) });
      return p < 0.5 ? { a: side(k), b: { alpha: 0 } } : { a: { alpha: 0 }, b: side(k) };
    }
    case "cube": {
      const dir = num(P, "dir", -1);
      return { a: { dx: dir * e, sx: Math.max(0.001, 1 - e), alpha: 1 - 0.4 * e }, b: { dx: dir * (e - 1), sx: Math.max(0.001, e), alpha: 0.6 + 0.4 * e } };
    }
    case "swing":
      return { a: { rotate: -25 * e, dy: 0.3 * e * e, alpha: 1 - e }, b: { rotate: 25 * (1 - e), dy: -0.3 * (1 - e) ** 2, alpha: e } };
    case "roll": {
      const dir = num(P, "dir", 1);
      return { a: { rotate: 90 * dir * e, dx: -dir * e, dy: P.drop ? 0.5 * e * e : 0 }, b: { rotate: -90 * dir * (1 - e), dx: dir * (1 - e) } };
    }
    case "wipe":
      return { a: {}, b: { mask: { shape: "linear", p: e, angle: num(P, "angle", 0) }, alpha: P.soft ? Math.min(1, e * 1.6) : 1 } };
    case "mask":
      return { a: {}, b: { mask: { shape: str(P, "shape", "circle") as MaskShape, p: e, angle: num(P, "angle", 0), n: num(P, "n", 8), rev: !!P.rev, v: !!P.v } } };
    case "irisOut":
      // the old picture closes in a circle over the new one
      return { a: { mask: { shape: "circle", p: 1 - e } }, b: {}, bUnder: true };
    case "flash":
      return { a: { alpha: p < 0.5 ? 1 : 0 }, b: { alpha: p < 0.5 ? 0 : 1 }, solid: { color: str(P, "color", "#fff"), alpha: Math.max(0, 1 - Math.abs(p - 0.5) * 2.4) } };
    case "fxDissolve": {
      const amt = Math.sin(Math.PI * p);
      const fx = [{ id: str(P, "fx", "leakWarm"), amount: amt }];
      return { a: { fx }, b: { alpha: e, fx } };
    }
    case "fxCut": {
      const amt = P.steady ? Math.sin(Math.PI * p) : Math.max(0, 1 - Math.abs(p - 0.5) * 2);
      const fx = [{ id: str(P, "fx", "glitchHeavy"), amount: amt }];
      return { a: { alpha: p < 0.5 ? 1 : 0, fx }, b: { alpha: p < 0.5 ? 0 : 1, fx } };
    }
    case "burn":
      return { a: { alpha: 1 - e }, b: { alpha: e }, solid: { color: "#ff7a1a", alpha: 0.75 * Math.sin(Math.PI * p) } };
    case "tvOff":
      return p < 0.5
        ? { a: { sy: Math.max(0.004, 1 - 2 * outExpo(p * 2) * 0.5 - 0.5 * e * 2), sx: p > 0.35 ? Math.max(0.002, 1 - (p - 0.35) * 6.6) : 1 }, b: { alpha: 0 }, solid: { color: "#000", alpha: Math.min(0.9, p * 1.8) } }
        : { a: { alpha: 0 }, b: { sy: Math.max(0.004, (p - 0.5) * 2) }, solid: { color: "#000", alpha: Math.max(0, 0.9 - (p - 0.5) * 1.8) } };
    case "whip": {
      const dx = num(P, "dx", -1);
      const dy = num(P, "dy", 0);
      const blur = 0.03 * Math.sin(Math.PI * p);
      const out = inExpo(Math.min(1, p * 1.4));
      const inn = p >= 1 ? 0 : 1 - outExpo(Math.min(1, Math.max(0, p * 1.4 - 0.4)));
      return { a: { dx: dx * out, dy: dy * out, blur }, b: { dx: -dx * inn, dy: -dy * inn, blur } };
    }
  }
  return { a: { alpha: 1 - e }, b: { alpha: e } };
}
