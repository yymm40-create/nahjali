// «حيدرة كت» — motion that follows the speaker's words (Majed Alzaabi's talking reels): while the person talks, the
// moment they say a thing it appears — «تاكسي» → the word with its picture, «بروح الرياض» → a line drawn to Riyadh,
// «انستا» → Instagram's icon — and the person shrinks into a box at the bottom for those seconds, then comes back full
// screen. حيدرة writes only the cues (which word, what to show) from the transcript; this engine lays them out,
// draws the icons/routes (SVG → PNG on the server), keys the shrink on every piece of the talking video, lifts the
// captions above the box, and picks the sounds. Pure (no I/O): the tests run it on real timelines.

import type { Command } from "./commands";
import { clipEnd, mainTrack, type Timeline } from "./model";
import { brandPalette, capCues, contrast, emWidth, paletteOf, westernDigits, type Palette, type SfxCue } from "./motion-build";

export const BRANDS = ["instagram", "tiktok", "youtube", "x", "snapchat", "whatsapp", "facebook", "telegram", "linkedin", "threads"] as const;
export type Brand = (typeof BRANDS)[number];
/** The words people say for each app (Gulf Arabic and English), so a cue can be checked against the transcript. */
export const BRAND_WORDS: Record<Brand, string[]> = {
  instagram: ["انستا", "انستقرام", "انستغرام", "إنستغرام", "إنستا", "instagram", "insta"],
  tiktok: ["تيك توك", "تيكتوك", "tiktok"],
  youtube: ["يوتيوب", "youtube"],
  x: ["تويتر", "إكس", "اكس", "twitter"],
  snapchat: ["سناب", "سناب شات", "snap", "snapchat"],
  whatsapp: ["واتساب", "واتس", "whatsapp"],
  facebook: ["فيسبوك", "فيس بوك", "facebook"],
  telegram: ["تيليجرام", "تلغرام", "telegram"],
  linkedin: ["لينكدإن", "لنكد ان", "linkedin"],
  threads: ["ثريدز", "threads"],
};

export type CueKind = "word" | "emoji" | "brand" | "route" | "pin" | "stat";
export interface TalkCue {
  kind: CueKind;
  /** timeline ms: the moment the word is said */
  at: number;
  /** until when it stays (default: the next cue, 1.6–3.5 s) */
  until?: number;
  text: string;
  emoji?: string;
  brand?: Brand;
  from?: string;
  to?: string;
  value?: string;
}
/** The face on the frame (fractions of the timeline's frame, at full size): found in the page, never by Claude. */
export interface FaceBox {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type TalkLayout = "shrink" | "over" | "over3d";
export interface TalkPlan {
  palette?: string;
  colors?: { bg?: string; text?: string; accent?: string; second?: string };
  /**
   * "shrink" (default, «المربع الصغير»): the person becomes a box at the bottom while a cue shows (the box centred on
   * the face) · "over": the person stays full, the cues on boxes beside the face · "over3d" («فوق كلامي ثلاثي الأبعاد»):
   * the person stays full and the cues float in 3D (extruded slabs and tiles, a flip in, a slow tilt) where the face isn't
   */
  layout: TalkLayout;
  /** where the face is (from the page); the box follows it and the cues keep off it */
  face?: FaceBox | null;
  cues: TalkCue[];
}

/** A face box from the page, checked (fractions inside the frame, a sensible size), or null. */
export function readFace(v: unknown): FaceBox | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const n = (k: string) => (Number.isFinite(Number(o[k])) ? Number(o[k]) : NaN);
  const f = { x: n("x"), y: n("y"), w: n("w"), h: n("h") };
  if (![f.x, f.y, f.w, f.h].every(Number.isFinite) || f.w <= 0.02 || f.h <= 0.02 || f.w > 1 || f.h > 1 || f.x < 0 || f.x > 1 || f.y < 0 || f.y > 1) return null;
  return f;
}

const clean = (v: unknown, max: number) => (typeof v === "string" ? westernDigits(v.replace(/\s+/g, " ").trim()).slice(0, max) : "");

/** حيدرة's cues (a JSON string), checked: known kinds, times inside the piece, in order, at least 0.9 s apart. */
export function readTalk(raw: unknown, endMs: number): TalkPlan | null {
  let o: unknown = raw;
  if (typeof raw === "string") {
    try {
      o = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!o || typeof o !== "object") return null;
  const s = o as Record<string, unknown>;
  const kinds: CueKind[] = ["word", "emoji", "brand", "route", "pin", "stat"];
  const cues = (Array.isArray(s.cues) ? s.cues : [])
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object" && kinds.includes((c as { kind?: CueKind }).kind as CueKind))
    .map((c): TalkCue => {
      const brand = BRANDS.find((b) => b === String(c.brand ?? "").toLowerCase());
      return {
        kind: c.kind as CueKind,
        at: Math.round(Number(c.at)),
        until: Number.isFinite(Number(c.until)) && Number(c.until) > 0 ? Math.round(Number(c.until)) : undefined,
        text: clean(c.text, 28),
        emoji: clean(c.emoji, 8) || undefined,
        brand,
        from: clean(c.from, 24) || undefined,
        to: clean(c.to, 24) || undefined,
        value: clean(c.value, 12) || undefined,
      };
    })
    .filter((c) => Number.isFinite(c.at) && c.at >= 0 && c.at < endMs)
    .filter((c) => (c.kind === "brand" ? !!c.brand : c.kind === "route" || c.kind === "pin" ? !!c.to : c.kind === "stat" ? !!c.value : !!c.text || !!c.emoji))
    .sort((a, b) => a.at - b.at)
    // one thing at a time: a cue too close to the one before waits for it to be read (0.9 s)
    .filter((c, i, all) => i === 0 || c.at - all[i - 1].at >= 900)
    .slice(0, 40);
  if (!cues.length) return null;
  const col = s.colors && typeof s.colors === "object" ? (s.colors as Record<string, string>) : undefined;
  return { palette: clean(s.palette, 20) || undefined, ...(col ? { colors: col } : {}), layout: s.layout === "over" || s.layout === "over3d" ? s.layout : "shrink", cues };
}

/** When each cue shows: from its word until the next cue (or its own `until`), 1.6–3.5 s. */
export function cueTimes(cues: TalkCue[], endMs: number) {
  return cues.map((c, i) => {
    const next = cues[i + 1]?.at ?? endMs;
    const want = c.until && c.until > c.at ? c.until : c.at + 2600;
    return { start: c.at, end: Math.max(c.at + 1600, Math.min(want, next - 80, c.at + 3500, endMs)) };
  });
}

/** The shrink windows: cues closer than 1.5 s share one (the person doesn't jump in and out between them). */
export function windowsOf(times: { start: number; end: number }[]) {
  const out: { start: number; end: number }[] = [];
  for (const t of times) {
    const last = out[out.length - 1];
    if (last && t.start - last.end < 1500) last.end = Math.max(last.end, t.end);
    else out.push({ ...t });
  }
  return out;
}

/** Where things go on this frame: the person's box, and the area the cues use (fractions of the frame). */
export function talkLayout(W: number, H: number, face?: FaceBox | null, layout: TalkLayout = "shrink") {
  // square frames too: the person below, the cues above (a side box leaves too little width for the words)
  const tall = H >= W;
  const base = tall
    ? { box: { x: 0.5, y: 0.8, scale: 0.36 }, area: { x: 0.5, y: 0.3, w: 0.84, h: 0.36 }, caption: 0.565 }
    : { box: { x: 0.79, y: 0.66, scale: 0.4 }, area: { x: 0.33, y: 0.45, w: 0.5, h: 0.6 }, caption: 0.92 };
  if (!face || layout === "shrink") return base;
  // the person stays full: the cues go where the face isn't — above it, below it (never into the captions, which
  // sit from about 71% down) or beside it, whichever leaves the most room
  const capTop = 0.71;
  const top = face.y - face.h / 2;
  const bottom = face.y + face.h / 2;
  const left = face.x - face.w / 2;
  const right = face.x + face.w / 2;
  const gap = 0.03;
  type Area = { x: number; y: number; w: number; h: number };
  const bands: Area[] = [];
  const vert = (from: number, to: number) => {
    const h = Math.min(0.36, to - from);
    if (h >= 0.14) bands.push({ x: 0.5, y: (from + to) / 2, w: 0.84, h });
  };
  vert(0.1, top - gap);
  vert(bottom + gap, capTop);
  const side = (from: number, to: number) => {
    const w = Math.min(0.5, to - from);
    if (w >= 0.26) bands.push({ x: (from + to) / 2, y: (0.1 + capTop) / 2, w, h: Math.min(0.6, capTop - 0.1) });
  };
  // beside the face on wide and square frames (a tall one is too narrow for words beside a face)
  if (W >= H * 0.95) {
    side(0.08, left - gap);
    side(right + gap, 0.92);
  }
  const best = bands.sort((a, b) => b.w * b.h - a.w * a.h)[0];
  const r = (a: Area) => ({ x: +a.x.toFixed(4), y: +a.y.toFixed(4), w: +a.w.toFixed(4), h: +a.h.toFixed(4) });
  if (best) return { ...base, area: r(best) };
  // a face filling the frame: the cues low, over the shoulders, above the captions
  return { ...base, area: r({ x: 0.5, y: Math.min(capTop - 0.12, bottom + 0.1), w: 0.84, h: 0.22 }) };
}

/**
 * Where a face found in the source picture (fractions of the source) is on the frame, and — when the picture is
 * wider/taller than the frame («cover» crops it) — the place that keeps the face in view: centred across, moved up or
 * down only when the face would be cut, never so far that an edge of the picture shows.
 */
export function faceOnFrame(t: { x: number; y: number; scale: number }, fit: "cover" | "contain", sw: number, sh: number, W: number, H: number, f: FaceBox): { x: number; y: number; face: FaceBox; moved: boolean } {
  const k = fit === "contain" ? Math.min(W / sw, H / sh) : Math.max(W / sw, H / sh);
  const dw = sw * k * (t.scale || 1);
  const dh = sh * k * (t.scale || 1);
  let cx = t.x * W;
  let cy = t.y * H;
  const keep = (c: number, d: number, size: number) => (d > size ? Math.min(d / 2, Math.max(size - d / 2, c)) : c);
  const fx = () => cx + (f.x - 0.5) * dw;
  const fy = () => cy + (f.y - 0.5) * dh;
  if (dw > W) cx = keep(cx + (W / 2 - fx()), dw, W);
  const top = fy() - (f.h * dh) / 2;
  const bottom = fy() + (f.h * dh) / 2;
  if (dh > H && (top < 0.04 * H || bottom > 0.96 * H)) cy = keep(cy + (H * 0.4 - fy()), dh, H);
  const x = +(cx / W).toFixed(4);
  const y = +(cy / H).toFixed(4);
  return { x, y, moved: Math.abs(x - t.x) > 0.002 || Math.abs(y - t.y) > 0.002, face: { x: +(fx() / W).toFixed(4), y: +(fy() / H).toFixed(4), w: +((f.w * dw) / W).toFixed(4), h: +((f.h * dh) / H).toFixed(4) } };
}

/**
 * The person's small transform for the box («المربع الصغير»): shrunk about its own centre, then moved so the FACE
 * lands at the box's centre (not the middle of the picture), kept inside the frame.
 */
export function boxTransform(full: { x: number; y: number; scale: number; rotate: number; opacity: number }, box: { x: number; y: number; scale: number }, face?: FaceBox | null) {
  const k = box.scale;
  if (!face) return { ...full, x: box.x, y: box.y, scale: +(full.scale * k).toFixed(3) };
  // the face's offset from the picture's centre shrinks with the picture
  const x = box.x - (face.x - full.x) * k;
  const y = box.y - (face.y - full.y) * k;
  const clamp = (v: number) => +Math.min(0.92, Math.max(0.08, v)).toFixed(4);
  return { ...full, x: clamp(x), y: clamp(y), scale: +(full.scale * k).toFixed(3) };
}

const SHRINK_MS = 320;
/** A square icon «contained» in any frame fills its shorter side: this scale makes it about a quarter of it. */
const ICON_SCALE = 0.24;

// ───────── the drawn pieces (icons and routes as SVG; the server turns them into PNG files) ─────────

const ICON = 400;
function brandSvg(b: Brand): string {
  const r = (fill: string, extra = "") => `<rect x="10" y="10" width="380" height="380" rx="92" fill="${fill}"/>${extra}`;
  const body: Record<Brand, string> = {
    instagram: `<defs><linearGradient id="g" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#feda75"/><stop offset=".3" stop-color="#fa7e1e"/><stop offset=".55" stop-color="#d62976"/><stop offset=".8" stop-color="#962fbf"/><stop offset="1" stop-color="#4f5bd5"/></linearGradient></defs>${r("url(#g)", `<rect x="95" y="95" width="210" height="210" rx="62" fill="none" stroke="#fff" stroke-width="26"/><circle cx="200" cy="200" r="52" fill="none" stroke="#fff" stroke-width="26"/><circle cx="262" cy="138" r="16" fill="#fff"/>`)}`,
    tiktok: r("#000", `<path d="M222 90h44c4 34 26 58 60 62v44c-22 0-42-7-60-19v92c0 48-38 84-84 84s-84-36-84-84 38-84 84-84c6 0 11 1 16 2v46c-5-2-10-3-16-3-22 0-40 18-40 39s18 40 40 40 40-18 40-40z" fill="#25f4ee" transform="translate(-8 -6)"/><path d="M222 90h44c4 34 26 58 60 62v44c-22 0-42-7-60-19v92c0 48-38 84-84 84s-84-36-84-84 38-84 84-84c6 0 11 1 16 2v46c-5-2-10-3-16-3-22 0-40 18-40 39s18 40 40 40 40-18 40-40z" fill="#fe2c55" transform="translate(8 6)"/><path d="M222 90h44c4 34 26 58 60 62v44c-22 0-42-7-60-19v92c0 48-38 84-84 84s-84-36-84-84 38-84 84-84c6 0 11 1 16 2v46c-5-2-10-3-16-3-22 0-40 18-40 39s18 40 40 40 40-18 40-40z" fill="#fff"/>`),
    youtube: `<rect x="20" y="80" width="360" height="240" rx="70" fill="#ff0000"/><path d="M165 140v120l105-60z" fill="#fff"/>`,
    x: r("#000", `<path d="M110 100h70l110 200h-70z" fill="#fff"/><path d="M285 100h30L135 300h-30z" fill="#fff"/>`),
    snapchat: r("#fffc00", `<path d="M200 80c58 0 92 44 90 98l-2 34c10 4 24 2 34 0 8 8 2 20-14 26-10 4-22 6-24 14 8 28 34 50 60 56-4 12-28 16-48 18-4 10-4 22-12 24-14 2-30-6-52-2-20 4-30 26-62 26s-42-22-62-26c-22-4-38 4-52 2-8-2-8-14-12-24-20-2-44-6-48-18 26-6 52-28 60-56-2-8-14-10-24-14-16-6-22-18-14-26 10 2 24 4 34 0l-2-34c-2-54 32-98 90-98z" fill="#fff" stroke="#000" stroke-width="10"/>`),
    whatsapp: r("#25d366", `<path d="M200 82a118 118 0 0 0-102 178l-16 58 60-16A118 118 0 1 0 200 82z" fill="none" stroke="#fff" stroke-width="22"/><path d="M160 140c8-4 14 0 18 8l12 26c2 6 0 10-4 14l-10 10c10 22 28 40 50 50l10-10c4-4 8-6 14-4l26 12c8 4 12 10 8 18-6 18-24 30-44 26-60-12-110-62-122-122-4-20 8-38 26-44z" fill="#fff"/>`),
    facebook: r("#1877f2", `<path d="M226 390V250h46l8-56h-54v-34c0-16 6-28 28-28h30V82c-6 0-24-2-44-2-46 0-76 28-76 78v36h-48v56h48v140z" fill="#fff"/>`),
    telegram: r("#29a9eb", `<path d="M82 196l218-86c10-4 20 4 16 20l-38 176c-2 12-12 16-22 10l-58-42-28 28c-4 4-8 4-10-2l-8-62 116-104-144 88-58-18c-12-4-12-12 2-18z" fill="#fff"/>`),
    linkedin: r("#0a66c2", `<rect x="96" y="166" width="48" height="140" fill="#fff"/><circle cx="120" cy="118" r="28" fill="#fff"/><path d="M178 166h46v20c10-16 28-26 52-26 44 0 58 28 58 70v76h-48v-68c0-18-6-32-24-32-20 0-36 14-36 36v64h-48z" fill="#fff"/>`),
    threads: r("#000", `<path d="M262 186c-4-34-26-52-62-52-30 0-54 16-62 44l40 10c4-14 12-20 22-20 14 0 22 6 24 18-50-2-90 16-90 54 0 30 26 50 58 50 30 0 50-16 58-44 6 6 10 16 10 28 0 30-28 56-78 56-60 0-94-40-94-108s34-108 94-108c50 0 82 26 92 70l38-10c-14-62-60-98-130-98-84 0-136 56-136 146s52 146 136 146c74 0 120-40 120-96 0-38-22-64-58-76zm-50 74c-14 0-22-6-22-16 0-12 14-22 46-20-2 22-10 36-24 36z" fill="#fff"/>`),
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON}" height="${ICON}" viewBox="0 0 400 400">${body[b]}</svg>`;
}

/** The route's frame (a wide picture over the cue area): where its two ends are, as fractions of the picture. */
export const ROUTE = { w: 1000, h: 640, from: { x: 0.82, y: 0.78 }, to: { x: 0.18, y: 0.22 } } as const;
function routeSvg(pal: Palette): string {
  const { w, h } = ROUTE;
  const fx = ROUTE.from.x * w, fy = ROUTE.from.y * h, tx = ROUTE.to.x * w, ty = ROUTE.to.y * h;
  const cx = (fx + tx) / 2 + 60, cy = Math.min(fy, ty) - 40;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect x="6" y="6" width="${w - 12}" height="${h - 12}" rx="48" fill="${pal.second}" fill-opacity="0.14" stroke="${pal.second}" stroke-opacity="0.35" stroke-width="4"/>
<path d="M ${fx} ${fy} Q ${cx} ${cy} ${tx} ${ty}" fill="none" stroke="${pal.text}" stroke-opacity="0.25" stroke-width="22" stroke-linecap="round"/>
<path d="M ${fx} ${fy} Q ${cx} ${cy} ${tx} ${ty}" fill="none" stroke="${pal.accent}" stroke-width="12" stroke-linecap="round" stroke-dasharray="2 30"/>
<circle cx="${fx}" cy="${fy}" r="22" fill="${pal.text}"/><circle cx="${fx}" cy="${fy}" r="10" fill="${pal.bg}"/>
<path d="M ${tx} ${ty + 6} c -34 -40 -46 -58 -46 -78 a 46 46 0 0 1 92 0 c 0 20 -12 38 -46 78 z" fill="${pal.accent}"/><circle cx="${tx}" cy="${ty - 72}" r="17" fill="${pal.bg}"/>
</svg>`;
}
function pinSvg(pal: Palette): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><ellipse cx="200" cy="360" rx="70" ry="16" fill="#000" fill-opacity="0.25"/><path d="M200 352c-80-96-110-140-110-188a110 110 0 0 1 220 0c0 48-30 92-110 188z" fill="${pal.accent}"/><circle cx="200" cy="164" r="42" fill="${pal.bg}"/></svg>`;
}

/** Everything in a cue area made smaller when the area is shorter than the usual one (a face leaving little room). */
const areaFit = (A: { h: number }) => Math.min(1, A.h / 0.36);
/** A cue's words sized to one line of the cue area (the same measure for the text and its 3D slab). */
function cueTextSize(body: string, base: number, A: { w: number }, W: number, H: number) {
  const fit = (0.96 * A.w * W) / (Math.max(0.5, emWidth(body, "cairo", 900) + 0.7) * H);
  return Math.min(base, fit);
}
/** The slab behind a word or a number in 3D: its face in px of the frame, and the words' size on it. */
export function slabOf(c: TalkCue, A: { w: number; h: number }, W: number, H: number): { wPx: number; hPx: number; size: number; body: string } | null {
  const k = (Math.min(W, H) / H) * areaFit(A);
  const body = c.kind === "word" ? c.text : c.kind === "stat" ? (c.value ?? "") : "";
  if (!body) return null;
  const size = cueTextSize(body, c.kind === "word" ? 0.15 * k : 0.2 * k, A, W, H);
  return { wPx: Math.round((emWidth(body, "cairo", 900) + 0.9) * size * H), hPx: Math.round(size * H * 1.55), size, body };
}
/** The scale that draws a picture of sw×sh at its own size in px on a W×H frame (pictures are «contained» at 1). */
const nativeScale = (sw: number, sh: number, W: number, H: number) => +(1 / Math.min(W / sw, H / sh)).toFixed(4);

// ───────── «ثلاثي الأبعاد»: slabs and tiles lifted off the picture (a stacked side and a soft shadow) ─────────

const darker = (hex: string, k: number) => `#${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - k)).toString(16).padStart(2, "0")).join("")}`;
/** Depth and shadow around a face of w×h (px): the face sits at the picture's centre, its side goes down. */
const pad3d = (h: number) => ({ depth: Math.round(h * 0.18), shadow: Math.round(h * 0.3) });

/**
 * A 3D slab (for a word or a number): a rounded face, its side stacked under it in a darker shade, a light on its top
 * edge and a blurred shadow on the picture. `inner` (an SVG fragment in face coordinates) is drawn on the face.
 */
export function slabSvg(w: number, h: number, face: string, inner = ""): { svg: string; w: number; h: number } {
  const { depth, shadow } = pad3d(h);
  const P = depth + shadow;
  const W = Math.round(w + 2 * P);
  const H = Math.round(h + 2 * P);
  const r = Math.round(Math.min(h, w) * 0.28);
  const side = darker(face.slice(0, 7), 0.45);
  const layers = Array.from({ length: 8 }, (_, i) => `<rect x="${P}" y="${(P + ((8 - i) * depth) / 8).toFixed(1)}" width="${w}" height="${h}" rx="${r}" fill="${side}"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><filter id="s" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${Math.max(2, shadow / 3).toFixed(1)}"/></filter>
<linearGradient id="l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.35"/><stop offset="0.45" stop-color="#ffffff" stop-opacity="0"/></linearGradient></defs>
<rect x="${P + w * 0.06}" y="${P + depth + h * 0.35}" width="${w * 0.88}" height="${h * 0.85}" rx="${r}" fill="#000" fill-opacity="0.45" filter="url(#s)"/>
${layers}
<rect x="${P}" y="${P}" width="${w}" height="${h}" rx="${r}" fill="${face}"/>
<rect x="${P}" y="${P}" width="${w}" height="${h}" rx="${r}" fill="url(#l)"/>
<g transform="translate(${P} ${P})">${inner}</g>
</svg>`;
  return { svg, w: W, h: H };
}

/** An app's icon as a 3D tile: its own picture on the face, lifted with a dark side and a shadow. */
function brand3dSvg(b: Brand) {
  const inner = brandSvg(b).replace(/^<svg[^>]*>/, `<svg x="0" y="0" width="${ICON}" height="${ICON}" viewBox="0 0 400 400">`);
  return slabSvg(ICON, ICON, "#1a1a1a", inner);
}

/** The pictures the plan needs (each drawn once): key → SVG. */
export function talkArt(plan: TalkPlan, W = 1080, H = 1920): { key: string; svg: string; w: number; h: number }[] {
  const pal = paletteOfTalk(plan);
  const out = new Map<string, { key: string; svg: string; w: number; h: number }>();
  const d3 = plan.layout === "over3d";
  // the 3D slabs behind the words and numbers: one per cue, sized from its words (talkCommands sizes the text the same)
  if (d3) {
    const L = talkLayout(W, H, plan.face, plan.layout);
    plan.cues.forEach((c, i) => {
      const slab = slabOf(c, L.area, W, H);
      if (slab) out.set(`slab-${i}`, { key: `slab-${i}`, ...slabSvg(slab.wPx, slab.hPx, c.kind === "word" ? pal.pill : pal.bg) });
    });
  }
  for (const c of plan.cues) {
    if (c.kind === "brand" && c.brand) out.set(`brand-${c.brand}`, d3 ? { key: `brand-${c.brand}`, ...brand3dSvg(c.brand) } : { key: `brand-${c.brand}`, svg: brandSvg(c.brand), w: ICON, h: ICON });
    if (c.kind === "route" && c.from) out.set("route", { key: "route", svg: routeSvg(pal), w: ROUTE.w, h: ROUTE.h });
    if (c.kind === "pin" || (c.kind === "route" && !c.from)) out.set("pin", { key: "pin", svg: pinSvg(pal), w: 400, h: 400 });
  }
  return [...out.values()];
}

export const paletteOfTalk = (plan: Pick<TalkPlan, "palette" | "colors">) => brandPalette(plan.colors) ?? paletteOf(plan.palette || "studio");

// ───────── the commands ─────────

type Tx = { x: number; y: number; scale: number; rotate: number; opacity: number };

/**
 * Everything the plan does to the timeline. `base`: commands before these in the same answer (for "$N"). `art`:
 * picture key → library file (a cue whose picture is missing shows its words instead).
 */
export function talkCommands(plan: TalkPlan, tl: Timeline, base = 0, art?: Map<string, string>): { commands: Command[]; sounds: SfxCue[]; windows: { start: number; end: number }[] } {
  const W = tl.width, H = tl.height;
  const L = talkLayout(W, H, plan.face, plan.layout);
  const A = L.area;
  const pal = paletteOfTalk(plan);
  const main = mainTrack(tl);
  const end = Math.max(...tl.tracks.flatMap((t) => t.clips.map(clipEnd)), 0);
  const times = cueTimes(plan.cues, end);
  const windows = plan.layout === "shrink" ? windowsOf(times) : [];
  const out: Command[] = [];
  const ref = () => `$${base + out.length}`;
  const sounds: SfxCue[] = [];
  // a short area (the face left little room) makes everything in it smaller together
  const k = (Math.min(W, H) / H) * areaFit(A);
  const IS = ICON_SCALE * areaFit(A);
  // over the video (the person stays full): every text sits on a box of the palette, so it reads on any picture
  const over = plan.layout !== "shrink";
  // «ثلاثي الأبعاد»: the words on 3D slabs and the icons on 3D tiles, flipping in and floating (a slow tilt)
  const d3 = plan.layout === "over3d";
  const flip = { in: "flip", out: "fade", inMs: 420, outMs: 160 };
  const float = (r: string, at: number, until: number, x: number, y: number, scale: number) => {
    out.push({ type: "set_key", clipId: r, at, transform: { x, y, scale: +(scale * 0.97).toFixed(4), rotate: -4, opacity: 1 } });
    out.push({ type: "set_key", clipId: r, at: until - 1, transform: { x, y, scale: +(scale * 1.04).toFixed(4), rotate: 3, opacity: 1 } });
  };
  const textCmd = (at: number, until: number, body: string, o: { x: number; y: number; size: number; color: string; box?: string | null; weight?: 400 | 700 | 900; bare?: boolean; anim: { in: string; out: string; inMs: number; outMs: number } }) => {
    // one line that fits the cue area's width (measured like the motion engine measures)
    const fit = (0.96 * A.w * W) / (Math.max(0.5, emWidth(body, "cairo", o.weight ?? 900) + 0.7) * H);
    o = { ...o, size: Math.min(o.size, fit), ...(over && !o.box && !o.bare ? { box: `${pal.bg}e6`, color: pal.text } : {}) };
    out.push({ type: "add_text", at, body, duration: until - at });
    const r = ref();
    out.push({ type: "update_clip", clipId: r, patch: { text: { body, size: +o.size.toFixed(4), color: o.color, weight: o.weight ?? 900, font: "cairo", align: "center", box: o.box ?? null, highlight: null }, transform: { x: o.x, y: o.y, scale: 1, rotate: 0, opacity: 1 }, anim: o.anim as never } });
    return r;
  };
  const imgCmd = (key: string, at: number, until: number, x: number, y: number, scale: number, anim: { in: string; out: string; inMs: number; outMs: number }) => {
    const id = art?.get(key);
    if (!id) return false;
    out.push({ type: "add_clip", assetId: id, trackId: "new", at });
    const r = ref();
    out.push({ type: "trim_clip", clipId: r, edge: "end", to: until });
    out.push({ type: "update_clip", clipId: r, patch: { fit: "contain", transform: { x, y, scale, rotate: 0, opacity: 1 }, anim: (d3 ? flip : anim) as never } });
    if (d3) float(r, at, until, x, y, scale);
    else {
      // nothing still: a slow push-in over its seconds
      out.push({ type: "set_key", clipId: r, at, transform: { x, y, scale, rotate: 0, opacity: 1 } });
      out.push({ type: "set_key", clipId: r, at: until - 1, transform: { x, y, scale: +(scale * 1.05).toFixed(3), rotate: 0, opacity: 1 } });
    }
    return true;
  };
  /** a 3D slab and its words on it, flipping in together and floating together */
  const slabCmd = (i: number, c: TalkCue, at: number, until: number, y: number, color: string) => {
    const sl = slabOf(c, A, W, H);
    if (!sl) return false;
    const { depth, shadow } = pad3d(sl.hPx);
    const sw = sl.wPx + 2 * (depth + shadow), sh = sl.hPx + 2 * (depth + shadow);
    if (!imgCmd(`slab-${i}`, at, until, A.x, y, nativeScale(sw, sh, W, H), flip)) return false;
    const r = textCmd(at, until, sl.body, { x: A.x, y, size: sl.size, color, bare: true, anim: flip });
    float(r, at, until, A.x, y, 1);
    return true;
  };
  const settle = { in: "settle", out: "fade", inMs: 280, outMs: 160 };
  const rise = { in: "rise", out: "fade", inMs: 260, outMs: 160 };
  const wipe = { in: "wipe", out: "fade", inMs: 700, outMs: 160 };
  const label = (c: TalkCue, at: number, until: number, y: number) => c.text && textCmd(at + 60, until, c.text, { x: A.x, y, size: 0.075 * k, color: pal.text, anim: rise });


  // 1) the background the person's box sits on
  if (windows.length) out.push({ type: "set_background", color: pal.bg });

  // 2) each cue's graphic, landing on its word
  plan.cues.forEach((c, i) => {
    const { start, end: until } = times[i];
    // a picture (or a big number) with its word under it, stacked from their real heights and centred in the area
    const LABEL = 0.075 * k;
    const stack = (iconH: number) => {
      const total = iconH + 0.035 + LABEL * 1.35;
      const iconY = A.y - total / 2 + iconH / 2;
      return { iconY, underY: iconY + iconH / 2 + 0.035 + (LABEL * 1.35) / 2 };
    };
    const imgH = (IS * Math.min(W, H)) / H;
    const EMOJI = 0.17 * k;
    const STAT = 0.2 * k;
    const { iconY, underY } = stack(c.kind === "emoji" ? EMOJI * 1.35 : c.kind === "stat" ? STAT * 1.35 : imgH);
    switch (c.kind) {
      case "word":
        if (!(d3 && slabCmd(i, c, start, until, A.y, pal.pillText))) textCmd(start, until, c.text, { x: A.x, y: A.y, size: 0.15 * k, color: pal.pillText, box: pal.pill, anim: settle });
        sounds.push({ kind: "whoosh", at: start });
        break;
      case "emoji": {
        // the system's own colour emoji, drawn big, with the word under it (in 3D: flipping in and floating)
        const e = textCmd(start, until, c.emoji || "⭐", { x: A.x, y: iconY, size: EMOJI, color: pal.text, bare: d3, anim: d3 ? flip : settle });
        if (d3) float(e, start, until, A.x, iconY, 1);
        label(c, start, until, underY);
        sounds.push({ kind: "pop", at: start });
        break;
      }
      case "brand":
        // in 3D the icon is a tile with its side and shadow around it: scaled so the icon itself stays the same size
        if (!imgCmd(`brand-${c.brand}`, start, until, A.x, iconY, d3 ? +(IS * ((ICON + 2 * (pad3d(ICON).depth + pad3d(ICON).shadow)) / ICON)).toFixed(4) : IS, settle)) textCmd(start, until, c.text || c.brand!, { x: A.x, y: iconY, size: Math.min(0.12 * k, imgH / 1.35), color: pal.accent, anim: settle });
        label(c, start, until, underY);
        sounds.push({ kind: "pop", at: start });
        break;
      case "route": {
        // the line drawn from the start (right, Arabic reading) to the destination, with the two names at its ends
        // as wide as the area, unless that makes it taller than the area (square frames)
        const wFrac = Math.min(A.w, (A.h * H * (ROUTE.w / ROUTE.h)) / W);
        const hFrac = (wFrac * W * (ROUTE.h / ROUTE.w)) / H;
        // a picture is «contained» in the frame at scale 1: its width there, as a fraction of the frame's width
        const containW = Math.min(1, (H * (ROUTE.w / ROUTE.h)) / W);
        const drawn = c.from ? imgCmd("route", start, until, A.x, A.y, +(wFrac / containW).toFixed(3), wipe) : imgCmd("pin", start, until, A.x, iconY, IS, settle);
        if (drawn && c.from) {
          const left = A.x - wFrac / 2, top = A.y - hFrac / 2;
          // the names inside the route's panel: where they are above its start, the place under its pin
          const inside = (y: number, size: number) => Math.min(top + hFrac - size * 0.8, Math.max(top + size * 0.8, y));
          const fromSize = 0.045 * k, toSize = 0.055 * k;
          textCmd(start + 60, until, c.from, { x: left + ROUTE.from.x * wFrac, y: inside(top + ROUTE.from.y * hFrac - 0.06 * hFrac - fromSize, fromSize), size: fromSize, color: pal.text, anim: rise });
          textCmd(start + 640, until, c.to!, { x: left + (ROUTE.to.x + 0.2) * wFrac, y: inside(top + ROUTE.to.y * hFrac + 0.12 * hFrac, toSize), size: toSize, color: pal.pillText, box: pal.pill, anim: settle });
        } else textCmd(start + 60, until, c.to!, { x: A.x, y: underY, size: 0.075 * k, color: pal.pillText, box: pal.pill, anim: settle });
        sounds.push({ kind: "swish", at: start }, { kind: "hit", at: start + 640 });
        break;
      }
      case "pin":
        imgCmd("pin", start, until, A.x, iconY, IS, settle);
        textCmd(start + 60, until, c.to!, { x: A.x, y: underY, size: 0.075 * k, color: pal.pillText, box: pal.pill, anim: settle });
        sounds.push({ kind: "pop", at: start });
        break;
      case "stat":
        if (!(d3 && slabCmd(i, c, start, until, iconY, pal.accent))) textCmd(start, until, c.value!, { x: A.x, y: iconY, size: STAT, color: pal.accent, anim: { in: "punch", out: "fade", inMs: 300, outMs: 160 } });
        label(c, start, until, underY);
        sounds.push({ kind: "hit", at: start });
        break;
    }
  });

  // 3) the person: every piece of the talking video shrinks into the box for each window, then grows back
  if (main && windows.length) {
    for (const clip of main.clips) {
      if (clip.text) continue;
      const full: Tx = { ...clip.transform };
      // «المربع الصغير»: the box centred on the face (when the page found it), not on the middle of the picture
      const small: Tx = boxTransform(full, L.box, plan.face);
      const a = clip.start, b = clipEnd(clip);
      const marks: [number, Tx][] = [];
      for (const w of windows) {
        if (w.end + SHRINK_MS <= a || w.start - SHRINK_MS >= b) continue;
        for (const [t, tx] of [[w.start - SHRINK_MS, full], [w.start, small], [w.end, small], [w.end + SHRINK_MS, full]] as [number, Tx][]) if (t > a && t < b) marks.push([t, tx]);
        // a piece that starts or ends inside a window starts/ends small
        if (a >= w.start && a <= w.end) marks.push([a, small]);
        if (b - 1 >= w.start && b - 1 <= w.end) marks.push([b - 1, small]);
      }
      for (const [t, tx] of marks.sort((x, y) => x[0] - y[0])) out.push({ type: "set_key", clipId: clip.id, at: Math.round(t), transform: tx });
    }
    // the captions said during a window go up, above the box (never over the face)
    for (const tr of tl.tracks) {
      if (tr.kind !== "text") continue;
      for (const c of tr.clips) {
        if (!windows.some((w) => c.start < w.end && clipEnd(c) > w.start)) continue;
        out.push({ type: "update_clip", clipId: c.id, patch: { transform: { ...c.transform, y: L.caption } } });
      }
    }
  }
  return { commands: out, sounds: capCues(sounds), windows };
}

/** The words of a cue that should be in the transcript near its moment (a check against invented cues). */
export function cueWords(c: TalkCue): string[] {
  if (c.kind === "brand" && c.brand) return BRAND_WORDS[c.brand];
  if (c.kind === "route" || c.kind === "pin") return [c.to!];
  if (c.kind === "stat") return [c.value!];
  return c.text ? [c.text] : [];
}

/** Whether a colour pair reads (exported for the tests). */
export const reads = (fg: string, bg: string) => contrast(fg, bg) >= 4.5;
