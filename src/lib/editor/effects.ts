// «المؤثرات»: 100 effects on a clip itself (not between clips): it moves a certain way, turns into an old TV, gets
// light leaks, rain, a mirror… Each is a preset of one of ~45 drawing recipes (components/jawad/editor/fx.ts), with
// its own numbers. Shared by the server (to accept an effect) and the page (to draw it, in the preview and the file).

export const FX_CATS = {
  motion: "حركة",
  retro: "ريترو وتلفزيون",
  glitch: "قلتش",
  light: "ضوء",
  color: "ألوان",
  weather: "أجواء وطقس",
  split: "تقسيم ومرايا",
  dreamy: "حالم",
  cinema: "سينمائي",
  occasion: "مناسبات",
} as const;
export type FxCat = keyof typeof FX_CATS;

export type FxParams = Record<string, number | string>;
export interface FxPreset {
  id: string;
  label: string;
  cat: FxCat;
  /** the drawing recipe */
  base: string;
  p: FxParams;
}

type Row = [id: string, label: string, cat: FxCat, base: string, p?: FxParams];

const ROWS: Row[] = [
  // ── motion (14)
  ["shakeLight", "اهتزاز خفيف", "motion", "shake", { amp: 0.008, freq: 9 }],
  ["shakeStrong", "اهتزاز قوي", "motion", "shake", { amp: 0.025, freq: 14 }],
  ["earthquake", "زلزال", "motion", "shake", { amp: 0.045, freq: 18, blur: 1.5 }],
  ["handheld", "كاميرا باليد", "motion", "handheld", { amp: 0.012 }],
  ["pulseBeat", "نبض الإيقاع", "motion", "pulse", { amp: 0.06, period: 0.5 }],
  ["heartbeat", "دقات قلب", "motion", "pulse", { amp: 0.07, period: 0.9, double: 1 }],
  ["zoomSlowIn", "تقريب بطيء", "motion", "zoomDrift", { to: 1.2 }],
  ["wobble", "تمايل", "motion", "wobble", { deg: 3, freq: 0.8 }],
  ["swing", "أرجوحة", "motion", "wobble", { deg: 8, freq: 0.5 }],
  ["float", "طفو", "motion", "float", { amp: 0.02, freq: 0.4 }],
  ["bounce", "نطّة", "motion", "bounce", { amp: 0.04, period: 0.6 }],
  ["spinSlow", "دوران بطيء", "motion", "spin", { speed: 20 }],
  ["sway", "يمين ويسار", "motion", "sway", { amp: 0.03, freq: 0.5 }],
  // ── retro & TV (12)
  ["vhs", "VHS", "retro", "vhs", { split: 4, noise: 0.18, lines: 0.15 }],
  ["vhsStrong", "VHS قوي", "retro", "vhs", { split: 9, noise: 0.3, lines: 0.25, jump: 1 }],
  ["crt", "تلفزيون قديم", "retro", "crt", { lines: 0.35 }],
  ["oldFilm", "فيلم قديم", "retro", "oldFilm", { sepia: 0.8, scratches: 6 }],
  ["super8", "سوبر ٨", "retro", "oldFilm", { sepia: 0.25, scratches: 2, warm: 1 }],
  ["scanlines", "خطوط شاشة", "retro", "scanlines", { alpha: 0.28, gap: 3 }],
  ["filmGrain", "حبيبات فيلم", "retro", "grain", { alpha: 0.22 }],
  ["tvStatic", "تشويش تلفزيون", "retro", "static", { alpha: 0.45 }],
  ["camcorder", "كاميرا التسعينات", "retro", "camcorder", {}],
  ["polaroid", "بولارويد", "retro", "frame", { kind: "polaroid" }],
  ["sepiaMemory", "ذكريات", "retro", "tone", { filter: "sepia(0.75) contrast(0.95) brightness(1.05)", vignette: 0.5 }],
  // ── glitch (10)
  ["glitchLight", "قلتش خفيف", "glitch", "glitch", { amp: 0.03, rate: 0.25 }],
  ["glitchHeavy", "قلتش قوي", "glitch", "glitch", { amp: 0.09, rate: 0.6, split: 8 }],
  ["rgbSplit", "انقسام ألوان", "glitch", "rgb", { px: 6 }],
  ["digitalBlocks", "مربعات رقمية", "glitch", "blocks", { n: 10 }],
  ["signalLoss", "انقطاع إشارة", "glitch", "signal", { rate: 0.35 }],
  ["chromaShake", "اهتزاز ملوّن", "glitch", "rgb", { px: 8, shake: 0.015 }],
  ["glitchFlicker", "رمشة قلتش", "glitch", "flicker", { rate: 0.3, glitch: 1 }],
  ["pixelBurst", "بكسلة نابضة", "glitch", "pixelate", { size: 40, pulse: 0.6 }],
  // ── light (12)
  ["leakWarm", "تسريب ضوء دافئ", "light", "leak", { c1: "#ff8a3d", c2: "#ffd36e" }],
  ["leakPink", "تسريب وردي", "light", "leak", { c1: "#ff4fa3", c2: "#ffb3d9" }],
  ["leakBlue", "تسريب أزرق", "light", "leak", { c1: "#3d7bff", c2: "#8fe3ff" }],
  ["leakGold", "تسريب ذهبي", "light", "leak", { c1: "#f5b800", c2: "#fff1b0" }],
  ["rainbowLeak", "قوس قزح", "light", "leak", { c1: "#ff3d6e", c2: "#3dd9ff", c3: "#b6ff3d" }],
  ["lensFlare", "وهج العدسة", "light", "flare", {}],
  ["bloomSoft", "توهج ناعم", "light", "bloom", { blur: 0.012, alpha: 0.45 }],
  ["bloomStrong", "توهج قوي", "light", "bloom", { blur: 0.02, alpha: 0.8, sat: 1.4 }],
  ["sunRays", "أشعة شمس", "light", "rays", { n: 12 }],
  ["strobe", "ستروب", "light", "strobe", { rate: 3, alpha: 0.85 }],
  ["flashBeat", "فلاش مع الإيقاع", "light", "strobe", { rate: 1, alpha: 0.6, soft: 1 }],
  ["blackFlash", "وميض أسود", "light", "strobe", { rate: 2, alpha: 0.9, color: "#000000" }],
  ["spotlight", "بقعة ضوء", "light", "spotlight", { r: 0.35 }],
  // ── colour (14)
  ["hueCycle", "ألوان متغيرة", "color", "hue", { speed: 90 }],
  ["bw", "أبيض وأسود", "color", "tone", { filter: "grayscale(1)" }],
  ["bwPunch", "أبيض وأسود حاد", "color", "tone", { filter: "grayscale(1) contrast(1.6) brightness(1.05)" }],
  ["invert", "عكس الألوان", "color", "tone", { filter: "invert(1) hue-rotate(180deg)" }],
  ["duoGoldNavy", "ذهبي وكحلي", "color", "duotone", { dark: "#0b1d4a", light: "#ffcf5c" }],
  ["duoPinkBlue", "وردي وأزرق", "color", "duotone", { dark: "#1b2bd6", light: "#ff7bc6" }],
  ["duoCyanMagenta", "سماوي وبنفسجي", "color", "duotone", { dark: "#5b1a8f", light: "#4dfff3" }],
  ["duoGreenBlack", "أخضر وأسود", "color", "duotone", { dark: "#03140a", light: "#3dff7a" }],
  ["duoOrangeTeal", "برتقالي وفيروزي", "color", "duotone", { dark: "#064e57", light: "#ffae5c" }],
  ["popColor", "ألوان بوب", "color", "tone", { filter: "saturate(2.2) contrast(1.35)" }],
  ["iceBlue", "ثلجي", "color", "tone", { filter: "saturate(0.7) hue-rotate(-12deg) brightness(1.08)", tint: "rgba(120,180,255,0.18)" }],
  ["sunset", "غروب", "color", "tone", { filter: "saturate(1.3) sepia(0.25)", tint: "rgba(255,120,60,0.18)" }],
  ["nightVision", "رؤية ليلية", "color", "tone", { filter: "grayscale(1) contrast(1.4) brightness(1.2)", tint: "rgba(40,255,90,0.38)", grain: 0.3, vignette: 0.8 }],
  // ── weather & atmosphere (8)
  ["rain", "مطر", "weather", "rain", { n: 140, speed: 1.4 }],
  ["storm", "عاصفة", "weather", "rain", { n: 320, speed: 2.2, lightning: 1 }],
  ["snow", "ثلج", "weather", "snow", { n: 90 }],
  ["blizzard", "عاصفة ثلج", "weather", "snow", { n: 260, wind: 0.6 }],
  ["dust", "غبار", "weather", "particles", { n: 70, color: "#f3e3c3", size: 0.004 }],
  ["fireflies", "يراعات", "weather", "particles", { n: 40, color: "#d9ff6b", size: 0.006, glow: 1 }],
  ["bubbles", "فقاعات", "weather", "bubbles", { n: 30 }],
  ["fog", "ضباب", "weather", "fog", { alpha: 0.45 }],
  // ── split & mirror (10)
  ["mirrorH", "مرآة جانبية", "split", "mirror", { axis: "x" }],
  ["mirrorV", "مرآة فوق وتحت", "split", "mirror", { axis: "y" }],
  ["kaleido", "مشكال", "split", "kaleido", {}],
  ["grid2", "شبكة ٤", "split", "grid", { n: 2 }],
  ["grid3", "شبكة ٩", "split", "grid", { n: 3 }],
  ["tunnel", "نفق", "split", "tunnel", { n: 6 }],
  ["echoZoom", "صدى تقريب", "split", "zoomBlur", { n: 6, k: 0.06 }],
  ["trail", "أثر الحركة", "split", "trail", { n: 5 }],
  ["splitSlide", "نصفين يتحركون", "split", "splitSlide", { amp: 0.08 }],
  // ── dreamy (6)
  ["dreamy", "حالم", "dreamy", "dream", { blur: 0.012, alpha: 0.55 }],
  ["softFocus", "تركيز ناعم", "dreamy", "dream", { blur: 0.006, alpha: 0.4, bright: 1.05 }],
  ["heatWave", "حرارة", "dreamy", "wave", { amp: 0.006, freq: 18, speed: 3 }],
  ["underwater", "تحت الماء", "dreamy", "wave", { amp: 0.012, freq: 8, speed: 1.2, tint: "rgba(30,140,200,0.28)" }],
  ["jelly", "جيلي", "dreamy", "wave", { amp: 0.02, freq: 4, speed: 2.5 }],
  // ── cinematic (8)
  ["letterbox", "شريط سينما", "cinema", "letterbox", { ratio: 2.39 }],
  ["tealOrange", "تيل وبرتقالي", "cinema", "tone", { filter: "saturate(1.15) contrast(1.1)", tint2: 1 }],
  ["filmLook", "لوك فيلم", "cinema", "tone", { filter: "contrast(1.12) saturate(0.9)", grain: 0.12, vignette: 0.45 }],
  ["vignette", "إطار ظل", "cinema", "vignette", { alpha: 0.55 }],
  ["vignetteStrong", "إطار ظل قوي", "cinema", "vignette", { alpha: 0.85 }],
  ["bleach", "باهت سينمائي", "cinema", "tone", { filter: "saturate(0.45) contrast(1.35) brightness(1.03)" }],
  ["noir", "نوار", "cinema", "tone", { filter: "grayscale(1) contrast(1.5) brightness(0.95)", vignette: 0.85, grain: 0.15 }],
  ["blockbuster", "بلوكبستر", "cinema", "tone", { filter: "saturate(1.2) contrast(1.2)", tint2: 1, letterbox: 2.39, bloom: 1 }],
  // ── occasions (6)
  ["goldSparkle", "لمعة ذهبية", "occasion", "sparkle", { n: 60, color: "#ffd65c" }],
  ["starryNight", "ليل ونجوم", "occasion", "sparkle", { n: 110, color: "#ffffff", small: 1, night: 1 }],
  ["lanternBokeh", "فوانيس رمضان", "occasion", "bokeh", { n: 22, color: "#ffc35c", leak: "#ff9a3d" }],
  ["crescentGlow", "هلال", "occasion", "crescent", {}],
  ["eidFireworks", "ألعاب نارية", "occasion", "fireworks", { n: 4 }],
  ["goldFrame", "إطار ذهبي", "occasion", "goldFrame", {}],
  ["mashrabiya", "ظل المشربية", "occasion", "mashrabiya", { alpha: 0.35 }],
  ["sandstorm", "عجاج", "occasion", "sand", { n: 220 }],
  ["bukhoor", "دخان بخور", "occasion", "smoke", { n: 6 }],
  ["eidConfetti", "قصاصات العيد", "occasion", "confetti", { n: 90 }],
  ["bokehLights", "أضواء بوكيه", "occasion", "bokeh", { n: 26, color: "#9cc8ff" }],
  ["heartsFloat", "قلوب", "occasion", "hearts", { n: 18 }],
];

export const FX_LIST: FxPreset[] = ROWS.map(([id, label, cat, base, p]) => ({ id, label, cat, base, p: p ?? {} }));
export const FX_BY_ID = new Map(FX_LIST.map((f) => [f.id, f]));
/** Effects stacked on one clip at most. */
export const FX_MAX = 3;
