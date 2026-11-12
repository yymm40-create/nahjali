// «الجواد الذكي!» | JAWAD AI — «أدوات الصورة» in «الاستوديو الإبداعي»: the pure part (ids, provider costs, the canvas
// math of «وسّع الصورة», the sizes of «ارفع الدقة», and the mask of «امسح بالفرشاة»). Shared by the studio, the
// registry (config/jawad/generators.ts) and the server, and checked by tests/jawad/image-tools.test.ts.
//
// Every cost below is a provider's published price, checked on its own model page on the date in IMAGE_TOOLS_CHECKED
// (the links are in each generator's `sources`):
//   • fal-ai/object-removal/mask (removes what the mask covers and fills it):  $0.024 a picture at «best_quality»
//     — https://fal.ai/models/fal-ai/object-removal/mask ("$0.006 Low · $0.012 Medium · $0.018 High · $0.024 Best")
//   • fal-ai/flux-pro/v1/fill (FLUX.1 Fill [pro], paints the mask from a description): $0.05 a megapixel, rounded up
//     — https://fal.ai/models/fal-ai/flux-pro/v1/fill ("$0.05 per megapixel")
//   • fal-ai/bria/expand (places the picture on a bigger canvas and paints the rest, with an optional description):
//     $0.04 a picture — https://fal.ai/models/fal-ai/bria/expand ("$0.04 per generation")
//   • fal-ai/seedvr/upscale/image (SeedVR2): $0.001 a megapixel — https://fal.ai/models/fal-ai/seedvr/upscale/image
//   • fal-ai/topaz/upscale/image (Topaz «Standard V2»): $0.08 up to 24 MP, $0.16 up to 48 MP, $0.32 up to 96 MP of
//     output — https://fal.ai/models/fal-ai/topaz/upscale/image
//   • fal-ai/sam-3/image (Meta's SAM 3, «✨ تحديد ذكي»): $0.005 a request — https://fal.ai/models/fal-ai/sam-3/image
//   • Claude Haiku 5.5 turning an Arabic description into the English these models read: $0.10 / $0.50 per million
//     tokens in / out (config/claude-models.ts); a ceiling of 2,000 in + 1,000 out.

export const IMAGE_TOOLS_CHECKED = "2026-11-12";

export const IMG_INPAINT_ID = "image-inpaint";
export const IMG_OUTPAINT_ID = "image-outpaint";
export const IMG_UPSCALE_ID = "image-upscale";
export const IMAGE_TOOL_IDS = [IMG_INPAINT_ID, IMG_OUTPAINT_ID, IMG_UPSCALE_ID] as const;
export type ImageToolId = (typeof IMAGE_TOOL_IDS)[number];
export const isImageTool = (id: string): id is ImageToolId => (IMAGE_TOOL_IDS as readonly string[]).includes(id);
/** A description these models cannot read as written (anything but plain English): Claude Haiku writes it in English first. */
export const needsEnglish = (text: string) => /[^\x00-\x7f]/.test(text.trim());

/** The provider endpoints (fal.ai). */
export const IMAGE_TOOL_MODELS = {
  erase: "fal-ai/object-removal/mask",
  fill: "fal-ai/flux-pro/v1/fill",
  expand: "fal-ai/bria/expand",
  seedvr: "fal-ai/seedvr/upscale/image",
  topaz: "fal-ai/topaz/upscale/image",
  sam: "fal-ai/sam-3/image",
} as const;

/** Provider costs in USD (see the header for each source). */
export const IMAGE_TOOL_USD = {
  /** object removal at «best_quality», one picture */
  erase: 0.024,
  /** FLUX.1 Fill [pro], each megapixel sent (rounded up) */
  fillPerMp: 0.05,
  /** Bria Expand, one picture */
  expand: 0.04,
  /** SeedVR2, each megapixel of the result (a ceiling: the page does not say input or output, the output is the bigger) */
  seedvrPerMp: 0.001,
  /** Topaz Standard V2 by the result's megapixels */
  topaz: [
    { upToMp: 24, usd: 0.08 },
    { upToMp: 48, usd: 0.16 },
    { upToMp: 96, usd: 0.32 },
  ],
  /** SAM 3 on one picture */
  sam: 0.005,
  /** Claude Haiku 5.5 writing the description in English, at its ceiling (2,000 in × $0.10/M + 1,000 out × $0.50/M) */
  translate: (2_000 * 0.1 + 1_000 * 0.5) / 1e6,
} as const;

// ───────────────────────────── «امسح بالفرشاة» / «عدّل هالجزء» ─────────────────────────────

/** The largest picture sent to the inpainting models (megapixels): a bigger one is sent smaller, and only the painted
 * part comes back into the original at its full size (everything outside the mask stays the original's pixels). */
export const INPAINT_MAX_MP = 4;
/** The mask the page draws: its long side (the server stretches it smoothly to the picture's exact size). Kept small so
 * a phone holds its undo steps (each one a copy of the layer: 1024² × 4 bytes = 4 MB). */
export const MASK_WORK_SIDE = 1024;

/** A size scaled to fit `maxMp` megapixels (never bigger than it was), even sides, at least 64 px. */
export function fitMegapixels(w: number, h: number, maxMp: number): { width: number; height: number } {
  const mp = (w * h) / 1e6;
  const k = mp > maxMp ? Math.sqrt(maxMp / mp) : 1;
  const even = (n: number) => Math.max(64, Math.floor((n * k) / 2) * 2);
  return { width: even(w), height: even(h) };
}

/** What FLUX Fill bills for one picture: its megapixels as sent, rounded up. */
export function fillMegapixels(w: number, h: number) {
  const s = fitMegapixels(w, h, INPAINT_MAX_MP);
  return Math.max(1, Math.ceil((s.width * s.height) / 1e6 - 1e-9));
}

/** The size of the mask the page draws for a picture: the picture's own shape, its long side at most MASK_WORK_SIDE. */
export function maskCanvasSize(w: number, h: number): { width: number; height: number } {
  const k = Math.min(1, MASK_WORK_SIDE / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) };
}

/** A mask fits its picture when it has the same shape (within 1%) and is not tiny. Null = fits, else why not. */
export function maskProblem(picture: { width?: number | null; height?: number | null }, mask: { width?: number | null; height?: number | null }): string | null {
  const pw = picture.width ?? 0;
  const ph = picture.height ?? 0;
  const mw = mask.width ?? 0;
  const mh = mask.height ?? 0;
  if (!pw || !ph || !mw || !mh) return "تعذّر قراءة أبعاد الصورة أو التحديد.";
  if (Math.min(mw, mh) < 16) return "التحديد صغير جدًا.";
  if (Math.abs(mw / mh - pw / ph) > 0.01 * (pw / ph)) return "التحديد ما يطابق شكل الصورة؛ ارسمه من جديد.";
  return null;
}

/**
 * The page's painted layer (RGBA, a pixel is painted where its alpha is at least half) as a binary mask: one byte a
 * pixel, 255 where something is to change, 0 elsewhere. `painted` counts the 255s.
 */
export function binaryMask(rgba: ArrayLike<number>, width: number, height: number): { data: Uint8Array; painted: number } {
  if (rgba.length !== width * height * 4) throw new Error("mask size");
  const data = new Uint8Array(width * height);
  let painted = 0;
  for (let i = 0; i < data.length; i++) {
    if (rgba[i * 4 + 3] >= 128) {
      data[i] = 255;
      painted++;
    }
  }
  return { data, painted };
}

/** The binary mask as RGBA (white where painted, black elsewhere, opaque): what is encoded to the PNG sent. */
export function maskToRgba(mask: Uint8Array): Uint8ClampedArray {
  const out = new Uint8ClampedArray(mask.length * 4);
  for (let i = 0; i < mask.length; i++) {
    const v = mask[i] ? 255 : 0;
    out[i * 4] = v;
    out[i * 4 + 1] = v;
    out[i * 4 + 2] = v;
    out[i * 4 + 3] = 255;
  }
  return out;
}

/** The share of the picture painted (0–1). */
export const maskShare = (painted: number, width: number, height: number) => (width * height ? painted / (width * height) : 0);

// ───────────────────────────── «وسّع الصورة» ─────────────────────────────

export const OUTPAINT_SHAPES = ["9:16", "1:1", "4:5", "16:9", "3:4", "all"] as const;
export type OutpaintShape = (typeof OUTPAINT_SHAPES)[number];
export const OUTPAINT_SHAPE_LABEL: Record<OutpaintShape, string> = { "9:16": "9:16", "1:1": "1:1", "4:5": "4:5", "16:9": "16:9", "3:4": "3:4", all: "كبّرها من كل الجهات" };
export const OUTPAINT_SHAPE_HINT: Record<OutpaintShape, string> = { "9:16": "ستوري وريلز", "1:1": "مربع", "4:5": "بوست انستقرام", "16:9": "يوتيوب", "3:4": "عمودي", all: "نفس الشكل وأوسع" };
/** «كبّرها من كل الجهات»: the canvas this many times the picture on each side (a quarter more on every edge). */
export const OUTPAINT_ALL_SCALE = 1.5;
/** The largest canvas side sent (Bria Expand takes a canvas under 5000 × 5000). */
export const OUTPAINT_MAX_SIDE = 4096;

export interface OutpaintPlan {
  /** the new picture's size */
  canvasW: number;
  canvasH: number;
  /** the original's size and place on it (it may be sent smaller when the canvas would pass OUTPAINT_MAX_SIDE) */
  imgW: number;
  imgH: number;
  x: number;
  y: number;
  /** how much of the new canvas is new (0–1) */
  added: number;
}

const ratioOf = (shape: Exclude<OutpaintShape, "all">) => {
  const [a, b] = shape.split(":").map(Number);
  return a / b;
};

/**
 * Where the picture goes on the new canvas: the smallest canvas of the chosen shape that holds the whole picture, the
 * picture in its middle; «all»: the same shape, bigger on every side. Null when the picture already has that shape.
 */
export function outpaintPlan(w: number, h: number, shape: OutpaintShape): OutpaintPlan | null {
  if (!(w > 0) || !(h > 0)) return null;
  let cw: number;
  let ch: number;
  if (shape === "all") {
    cw = w * OUTPAINT_ALL_SCALE;
    ch = h * OUTPAINT_ALL_SCALE;
  } else {
    const r = ratioOf(shape);
    if (Math.abs(w / h - r) / r < 0.02) return null;
    if (r > w / h) {
      ch = h;
      cw = h * r;
    } else {
      cw = w;
      ch = w / r;
    }
  }
  // the canvas made smaller to fit, and the picture with it
  const k = Math.min(1, OUTPAINT_MAX_SIDE / Math.max(cw, ch));
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  const canvasW = even(cw * k);
  const canvasH = even(ch * k);
  const imgW = Math.min(canvasW, Math.round(w * k));
  const imgH = Math.min(canvasH, Math.round(h * k));
  const x = Math.floor((canvasW - imgW) / 2);
  const y = Math.floor((canvasH - imgH) / 2);
  return { canvasW, canvasH, imgW, imgH, x, y, added: 1 - (imgW * imgH) / (canvasW * canvasH) };
}

// ───────────────────────────── «ارفع الدقة» ─────────────────────────────

export const UPSCALE_FACTORS = ["2", "4"] as const;
export const UPSCALE_ENGINES = ["seedvr", "topaz"] as const;
export type UpscaleEngine = (typeof UPSCALE_ENGINES)[number];
/** The biggest result made (megapixels): 8192 × 8192 is about 67. */
export const UPSCALE_MAX_MP = 64;

/** The result's size for a factor. */
export const upscaledImage = (w: number, h: number, factor: number) => ({ width: Math.round(w * factor), height: Math.round(h * factor) });
/** The result's megapixels. */
export const upscaledMp = (w: number, h: number, factor: number) => (w * h * factor * factor) / 1e6;

/** Topaz's tier for a result of `mp` megapixels (its upper bound and price), or null past the last one offered. */
export function topazTier(mp: number) {
  return IMAGE_TOOL_USD.topaz.find((t) => mp <= t.upToMp + 1e-9) ?? null;
}

/** The provider's cost of one upscale (USD), or null when the result would be too big. */
export function upscaleUsd(w: number, h: number, factor: number, engine: UpscaleEngine): number | null {
  const mp = upscaledMp(w, h, factor);
  if (mp > UPSCALE_MAX_MP + 1e-9) return null;
  if (engine === "topaz") return topazTier(mp)?.usd ?? null;
  return Math.max(1, Math.ceil(mp - 1e-9)) * IMAGE_TOOL_USD.seedvrPerMp;
}
