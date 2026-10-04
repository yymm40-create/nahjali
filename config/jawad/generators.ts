// «الجواد الذكي!» | JAWAD AI — the central registry of generators. One definition per integration (provider + model
// version + API), used by the studio in the browser AND re-checked on the server before any charge.
//
// Everything below was checked against the providers' official API documents on 2026-10-04 (links in `sources`).
// What could not be confirmed is marked `unverified` and the option it affects stays off (see `verification`).
// The owner can rename, hide, reorder or re-price a generator from /jawad-ai/admin, but can never add a capability:
// options, limits and modes only come from this file.

import { COIN_COST_USD } from "../coins";
import type { GeneratorDef, Issue, ModeDef, OptionState, PriceResult, RefMeta, Settings } from "./types";

const CHECKED = "2026-10-04";
const MB = 1024 * 1024;

/** Hundredths of a coin for a provider cost (rounded up), on the site's coin price (config/coins.ts). */
export const centiFor = (usd: number) => Math.max(1, Math.ceil((usd / COIN_COST_USD) * 100 - 1e-9));
/** Whole coins charged for a sum of hundredths (rounded up, never 0 for a paid line). */
export const coinsOf = (centi: number) => Math.ceil(centi / 100 - 1e-9);

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
export const hasArabic = (s: string) => ARABIC.test(s);
/** UTF-8 bytes: an upper bound of any BPE token count (a token is at least one byte). */
export const utf8Bytes = (s: string) => new TextEncoder().encode(s).length;

const opt = (options: GeneratorDef["options"], states: Partial<Record<string, Partial<OptionState>>> = {}): OptionState[] =>
  options.map((o) => ({ ...o, ...(states[o.key] ?? {}) }) as OptionState);

// ───────────────────────────── OpenAI · GPT Image 2 ─────────────────────────────

/**
 * Output tokens of one gpt-image-2 image: the formula of OpenAI's official calculator (image generation guide,
 * "GPT Image 2.5 and GPT Image 2 output tokens"). It reproduces the published prices exactly
 * (1024×1024: low $0.006 · medium $0.053 · high $0.211; 1536×1024: $0.005 · $0.041 · $0.165).
 */
export function gptImage2OutputTokens(w: number, h: number, quality: "low" | "medium" | "high") {
  const base = { low: 16, medium: 48, high: 96 }[quality];
  const s = base / (Math.max(w, h) / Math.min(w, h));
  const l = Math.floor(s);
  const u = s - l === 0.5 ? l + (l % 2) : Math.round(s);
  const d = (w >= h ? base : u) * (w >= h ? u : base);
  return Math.ceil((d * (2e6 + w * h)) / 4e6);
}
/** USD per 1M tokens for gpt-image-2 (pricing page, standard): text in 5 · image in 8 · image out 30. */
const GPT_IMAGE_2_PRICE = { textIn: 5, imageIn: 8, imageOut: 30 };
/**
 * Tokens of one reference image — a cap: OpenAI documents input image tokens only for gpt-image-1, whose worst case
 * (portrait/landscape, high fidelity) is 65 + 6 tiles × 129 + 6,240 = 7,079 tokens. The real count comes back in
 * the response's usage and is stored as the job's actual cost.
 */
const GPT_IMAGE_2_REF_TOKENS_CAP = 7100;

/**
 * gpt-image-2 sizes we offer. Every size meets the documented rules (edges multiples of 16, long/short ≤ 3,
 * 655,360–8,294,400 pixels) and stays at or below 2560×1440, above which sizes are documented as experimental.
 */
export const GPT_IMAGE_2_SIZES: Record<"std" | "hi", Record<string, [number, number]>> = {
  std: { "1:1": [1024, 1024], "16:9": [1536, 864], "9:16": [864, 1536], "3:2": [1536, 1024], "2:3": [1024, 1536] },
  hi: { "1:1": [1536, 1536], "16:9": [2048, 1152], "9:16": [1152, 2048], "3:2": [1920, 1280], "2:3": [1280, 1920] },
};
const QUALITIES = ["low", "medium", "high"] as const;
const outUsd = (w: number, h: number, q: (typeof QUALITIES)[number]) => (gptImage2OutputTokens(w, h, q) * GPT_IMAGE_2_PRICE.imageOut) / 1e6;
/** The dearest size of a tier (the price of a tier is its ceiling). */
const tierOutUsd = (tier: "std" | "hi", q: (typeof QUALITIES)[number]) => Math.max(...Object.values(GPT_IMAGE_2_SIZES[tier]).map(([w, h]) => outUsd(w, h, q)));

const IMAGE_FILE = { mimes: ["image/png", "image/jpeg", "image/webp"], maxBytes: 20 * MB, minSide: 64, maxSide: 8192 };

const gptImage2Modes: ModeDef[] = [
  { id: "text_to_image", label: "من النص", refStyle: "none", refs: {}, promptRequired: true },
  { id: "image_reference", label: "بصور مرجعية", refStyle: "references", refs: { image: { min: 1, max: 16 } }, promptRequired: true },
];

const gptImage2: GeneratorDef = {
  id: "openai-gpt-image-2",
  name: "GPT Image 2",
  output: "image",
  defaultSection: "images",
  provider: { id: "openai", label: "OpenAI" },
  model: { id: "gpt-image-2-2026-04-21", family: "gpt-image-2", version: "2026-04-21" },
  api: { name: "OpenAI Images API", endpoint: "POST /v1/images/generations · POST /v1/images/edits", tracking: "sync", progress: "none", cancel: "none" },
  modes: gptImage2Modes,
  options: [
    {
      key: "aspect", label: "نسبة الأبعاد", kind: "choice", ltr: true, default: "1:1",
      values: [
        { value: "1:1", label: "1:1", hint: "مربع" },
        { value: "16:9", label: "16:9", hint: "أفقي" },
        { value: "9:16", label: "9:16", hint: "عمودي" },
        { value: "3:2", label: "3:2", hint: "أفقي" },
        { value: "2:3", label: "2:3", hint: "عمودي" },
      ],
    },
    {
      key: "resolution", label: "الدقة", kind: "choice", default: "std",
      values: [
        { value: "std", label: "قياسية", hint: "1024–1536 بكسل" },
        { value: "hi", label: "عالية", hint: "1536–2048 بكسل" },
      ],
    },
    {
      key: "quality", label: "مستوى الجودة", kind: "choice", default: "medium",
      values: [
        { value: "low", label: "سريعة" },
        { value: "medium", label: "متوازنة" },
        { value: "high", label: "عالية" },
      ],
    },
    { key: "count", label: "عدد الصور", kind: "int", min: 1, max: 4, default: 1, unit: "صورة" },
  ],
  files: { image: IMAGE_FILE },
  // OpenAI API reference: the prompt can be up to 32,000 characters for GPT Image models
  prompt: { label: "البرومبت", placeholder: "صف الصورة التي تريدها…", max: 32000, arabic: true },
  // OpenAI's prompting guide: refer to input images by index ("Image 1", "Image 2")
  refLabel: (_kind, n) => `Image ${n}`,
  priceKeys: [
    ...(["std", "hi"] as const).flatMap((tier) =>
      QUALITIES.map((q) => ({
        key: `out:${q}:${tier}`,
        label: `صورة · ${q === "low" ? "سريعة" : q === "medium" ? "متوازنة" : "عالية"} · ${tier === "std" ? "قياسية" : "عالية الدقة"}`,
        defaultCenti: centiFor(tierOutUsd(tier, q)),
        basis: `أغلى مقاس في الفئة بمعادلة OpenAI الرسمية × $${GPT_IMAGE_2_PRICE.imageOut}/مليون توكن`,
      })),
    ),
    { key: "prompt:1kb", label: "كل ١٠٠٠ بايت من البرومبت", defaultCenti: centiFor((1000 * GPT_IMAGE_2_PRICE.textIn) / 1e6), basis: "سقف: كل بايت ≤ توكن واحد × $5/مليون" },
    { key: "ref:image", label: "كل صورة مرجعية", defaultCenti: centiFor((GPT_IMAGE_2_REF_TOKENS_CAP * GPT_IMAGE_2_PRICE.imageIn) / 1e6), basis: `سقف (غير متحقق لـ gpt-image-2): ${GPT_IMAGE_2_REF_TOKENS_CAP.toLocaleString("en")} توكن، أقصى ما وثّقته OpenAI لصورة مدخلة في gpt-image-1، × $${GPT_IMAGE_2_PRICE.imageIn}/مليون. التكلفة الفعلية تُسجَّل مع كل مهمة` },
  ],
  modeFor: (_style, refs) => (refs.length ? gptImage2Modes[1] : gptImage2Modes[0]),
  rules: () => ({ options: opt(gptImage2.options), issues: [], notes: [] }),
  price(d, mode, table) {
    const s = d.settings;
    const tier = s.resolution === "hi" ? "hi" : "std";
    const q = (QUALITIES as readonly string[]).includes(String(s.quality)) ? (s.quality as (typeof QUALITIES)[number]) : "medium";
    const n = Number(s.count) || 1;
    const per = table[`out:${q}:${tier}`];
    const perKb = table["prompt:1kb"];
    if (per == null || perKb == null) return { ok: false, reason: "سعر هذا الإعداد غير محدد بعد." };
    const kb = Math.max(1, Math.ceil(utf8Bytes(d.prompt) / 1000));
    const lines = [
      { label: `${n} × صورة`, centi: n * per },
      { label: "البرومبت", centi: kb * perKb },
    ];
    if (mode.id === "image_reference") {
      const ref = table["ref:image"];
      if (ref == null) return { ok: false, reason: "سعر الصور المرجعية لهذا المولد لم يُحدد بعد (تكلفتها غير موثّقة من OpenAI)." };
      lines.push({ label: `${d.refs.length} × مرجع`, centi: d.refs.length * ref });
    }
    return total(lines, gptImage2.costUsd(d, mode));
  },
  costUsd(d) {
    const s = d.settings;
    const tier = s.resolution === "hi" ? "hi" : "std";
    const size = GPT_IMAGE_2_SIZES[tier][String(s.aspect)] ?? GPT_IMAGE_2_SIZES.std["1:1"];
    const q = (s.quality as (typeof QUALITIES)[number]) ?? "medium";
    // Reference images at their cap (their real token count is not documented for gpt-image-2)
    const refs = (d.refs.filter((r) => r.kind === "image").length * GPT_IMAGE_2_REF_TOKENS_CAP * GPT_IMAGE_2_PRICE.imageIn) / 1e6;
    return (Number(s.count) || 1) * outUsd(size[0], size[1], q) + (utf8Bytes(d.prompt) * GPT_IMAGE_2_PRICE.textIn) / 1e6 + refs;
  },
  sources: [
    { label: "OpenAI — Image generation guide (sizes, quality, calculator)", url: "https://developers.openai.com/api/docs/guides/image-generation", checked: CHECKED },
    { label: "OpenAI — Images API reference (edits: up to 16 images, sizes)", url: "https://developers.openai.com/api/reference/resources/images", checked: CHECKED },
    { label: "OpenAI — Pricing (gpt-image-2)", url: "https://developers.openai.com/api/docs/pricing", checked: CHECKED },
    { label: "OpenAI — GPT Image prompting guide (refer to inputs as Image 1, Image 2)", url: "https://developers.openai.com/cookbook/examples/multimodal/image-gen-models-prompting-guide", checked: CHECKED },
  ],
  verification: [
    { item: "المقاسات والنِّسب", status: "verified", note: "أي مقاس بأضلاع من مضاعفات 16، نسبة ≤ 3:1، و655,360–8,294,400 بكسل؛ ما فوق 2560×1440 تجريبي فلم نعرضه." },
    { item: "الجودة", status: "verified", note: "low · medium · high (auto مستبعد لأنه يجعل السعر غير معروف)." },
    { item: "عدد الصور", status: "verified", note: "n من 1 إلى 10؛ نعرض حتى 4." },
    { item: "الصور المرجعية", status: "verified", note: "نقطة edits تقبل حتى 16 صورة؛ نقبل PNG وJPEG وWEBP حتى 20MB." },
    { item: "سعر المخرجات", status: "verified", note: "$30 لكل مليون توكن، وعدد التوكنات بمعادلة الحاسبة الرسمية (يطابق الأسعار المنشورة)." },
    { item: "سعر الصور المرجعية", status: "unverified", note: "OpenAI يوثّق توكنات الصورة المدخلة لـ gpt-image-1 فقط؛ نسعّرها افتراضيًا بسقف أقصى حالة موثّقة (7,100 توكن × $8/مليون)، والتكلفة الفعلية تُسجَّل من usage." },
    { item: "الخلفية الشفافة", status: "unverified", note: "موثّقة كمعاينة (preview) لـ gpt-image-2؛ غير معروضة." },
    { item: "التقدم والإلغاء", status: "verified", note: "طلب متزامن بلا نسبة تقدم ولا إلغاء." },
    { item: "طول البرومبت", status: "verified", note: "حتى 32,000 حرف (مرجع Images API)." },
    { item: "أسماء المراجع في البرومبت", status: "verified", note: "دليل OpenAI: الإشارة للصور المدخلة بترتيبها «Image 1» و«Image 2»؛ كل «‎@اسم» يُرسل بهذا الشكل." },
  ],
  notes: ["كل طلب متزامن: يرجع بالصور مباشرة (base64) ونحفظها في تخزيننا."],
};

// ───────────────────────────── BytePlus ModelArk · Seedance ─────────────────────────────

/** Output pixel sizes per resolution and ratio (ModelArk "Create a video generation task", width/height table). */
const SEEDANCE_PIXELS: Record<"2.5" | "2.0", Record<string, Record<string, [number, number]>>> = {
  "2.5": {
    "480p": { "16:9": [854, 480], "4:3": [752, 560], "1:1": [640, 640], "3:4": [560, 752], "9:16": [480, 854], "21:9": [992, 432] },
    "720p": { "16:9": [1280, 720], "4:3": [1112, 834], "1:1": [960, 960], "3:4": [834, 1112], "9:16": [720, 1280], "21:9": [1470, 630] },
    "1080p": { "16:9": [1920, 1080], "4:3": [1664, 1248], "1:1": [1440, 1440], "3:4": [1248, 1664], "9:16": [1080, 1920], "21:9": [2206, 946] },
  },
  "2.0": {
    "480p": { "16:9": [864, 496], "4:3": [752, 560], "1:1": [640, 640], "3:4": [560, 752], "9:16": [496, 864], "21:9": [992, 432] },
    "720p": { "16:9": [1280, 720], "4:3": [1112, 834], "1:1": [960, 960], "3:4": [834, 1112], "9:16": [720, 1280], "21:9": [1470, 630] },
    "1080p": { "16:9": [1920, 1080], "4:3": [1664, 1248], "1:1": [1440, 1440], "3:4": [1248, 1664], "9:16": [1080, 1920], "21:9": [2206, 946] },
    "4k": { "16:9": [3840, 2160], "4:3": [3326, 2494], "1:1": [2880, 2880], "3:4": [2494, 3326], "9:16": [2160, 3840], "21:9": [4398, 1886] },
  },
};
/** USD per 1M tokens, online inference, input without video (ModelArk model pricing page). */
const SEEDANCE_RATE: Record<"2.5" | "2.0", Record<string, number>> = {
  "2.5": { "480p": 10.7, "720p": 10.7, "1080p": 11.7 },
  "2.0": { "480p": 7.0, "720p": 7.0, "1080p": 7.7, "4k": 4.0 },
};
/** USD per 1M tokens when the input contains a video (same pricing page). The whole task is billed at this rate. */
const SEEDANCE_RATE_WITH_VIDEO: Record<"2.5" | "2.0", Record<string, number>> = {
  "2.5": { "480p": 6.4, "720p": 6.4, "1080p": 7.0 },
  "2.0": { "480p": 4.3, "720p": 4.3, "1080p": 4.7, "4k": 2.4 },
};
/** tokens = (input video seconds + output seconds) × width × height × 24 / 1024 (ModelArk pricing). Ceiling: the largest size of the resolution. */
const seedanceSecondUsd = (v: "2.5" | "2.0", res: string, ratio?: string) => {
  const sizes = SEEDANCE_PIXELS[v][res];
  const px = ratio && sizes[ratio] ? sizes[ratio][0] * sizes[ratio][1] : Math.max(...Object.values(sizes).map(([w, h]) => w * h));
  return ((px * 24) / 1024) * (SEEDANCE_RATE[v][res] / 1e6);
};

const RATIO_VALUES = [
  { value: "16:9", label: "16:9", hint: "أفقي" },
  { value: "9:16", label: "9:16", hint: "عمودي" },
  { value: "1:1", label: "1:1", hint: "مربع" },
  { value: "4:3", label: "4:3" },
  { value: "3:4", label: "3:4" },
  { value: "21:9", label: "21:9", hint: "سينمائي عريض" },
];
const RES_LABEL: Record<string, string> = { "480p": "480p", "720p": "720p", "1080p": "1080p", "4k": "4K" };

function seedance(v: "2.5" | "2.0"): GeneratorDef {
  const is25 = v === "2.5";
  const maxSec = is25 ? 30 : 15;
  const lim = is25 ? { images: 30, videos: 10, audios: 10, totalMs: 30_000, clipMax: 30_000 } : { images: 9, videos: 3, audios: 3, totalMs: 15_000, clipMax: 15_000 };
  const modes: ModeDef[] = [
    { id: "text_to_video", label: "من النص", refStyle: "none", refs: {}, promptRequired: true },
    { id: "first_frame", label: "إطار أول", refStyle: "frames", refs: { image: { min: 1, max: 1 } }, roles: ["first_frame"], promptRequired: false },
    { id: "first_last_frame", label: "إطار أول وأخير", refStyle: "frames", refs: { image: { min: 2, max: 2 } }, roles: ["first_frame", "last_frame"], promptRequired: false },
    {
      id: "omni_reference",
      label: "مراجع متعددة",
      refStyle: "references",
      refs: {
        image: { min: 0, max: lim.images },
        video: { min: 0, max: lim.videos, totalMaxMs: lim.totalMs },
        audio: { min: 0, max: lim.audios, totalMaxMs: lim.totalMs },
      },
      // 2.5 accepts audio-only; the 2.0 series needs at least one image or video
      needsOneOf: is25 ? ["image", "video", "audio"] : ["image", "video"],
      promptRequired: false,
    },
  ];
  const resolutions = is25 ? ["480p", "720p", "1080p"] : ["480p", "720p", "1080p", "4k"];
  const def: GeneratorDef = {
    id: is25 ? "byteplus-seedance-2-5" : "byteplus-seedance-2-0",
    name: is25 ? "Seedance 2.5" : "Seedance 2.0",
    output: "video",
    defaultSection: "video",
    provider: { id: "byteplus-modelark", label: "BytePlus ModelArk" },
    model: is25
      ? { id: "dreamina-seedance-2-5-260628", family: "Dreamina Seedance 2.5", version: "260628" }
      : { id: "dreamina-seedance-2-0-260128", family: "Dreamina Seedance 2.0", version: "260128" },
    api: { name: "ModelArk Video generation API", endpoint: "POST/GET /api/v3/contents/generations/tasks", tracking: "async", progress: "none", cancel: "queued-only" },
    modes,
    options: [
      { key: "ratio", label: "نسبة الأبعاد", kind: "choice", ltr: true, default: "16:9", values: RATIO_VALUES },
      { key: "resolution", label: "الدقة", kind: "choice", ltr: true, default: "720p", values: resolutions.map((r) => ({ value: r, label: RES_LABEL[r] })) },
      { key: "duration", label: "المدة", kind: "int", min: 4, max: maxSec, default: 5, unit: "ثانية" },
      { key: "audio", label: "صوت متزامن مع الفيديو", kind: "bool", default: true, hint: "حوار ومؤثرات وموسيقى يولّدها النموذج" },
    ],
    files: {
      image: { mimes: ["image/png", "image/jpeg", "image/webp"], maxBytes: 30 * MB - 1, minSide: 300, maxSide: 6000, minAspect: 0.4, maxAspect: 2.5 },
      video: { mimes: ["video/mp4", "video/quicktime"], maxBytes: 50 * MB, minSide: 300, maxSide: 6000, minAspect: 0.4, maxAspect: 2.5, minPixels: 407_696, maxPixels: 8_295_044, minMs: 2000, maxMs: lim.clipMax, minFps: 24, maxFps: 60 },
      audio: { mimes: ["audio/mpeg", "audio/wav"], maxBytes: 15 * MB, minMs: 2000, maxMs: lim.clipMax },
    },
    // No hard limit documented (we accept up to 32,000 characters); BytePlus advises ≤ 500 Chinese characters or 1,000 English words
    prompt: {
      label: "البرومبت",
      placeholder: is25 ? "صف المشهد والحركة والكاميرا… (اختياري مع المراجع)" : "Describe the scene, motion and camera…",
      max: 32000,
      arabic: is25,
      ...(is25 ? {} : { arabicNote: "Seedance 2.0 يدعم رسميًا الإنجليزية والإسبانية والإندونيسية والبرتغالية واليابانية فقط؛ للعربية اختر Seedance 2.5." }),
      advise: { maxWords: 1000, maxCjk: 500, note: "البرومبت أطول مما تنصح به BytePlus (1000 كلمة إنجليزية أو 500 حرف صيني)؛ قد يتجاهل المولد بعض التفاصيل ويركّز على الأهم. يمكنك الإرسال مع ذلك." },
    },
    priceKeys: [
      ...resolutions.map((r) => ({
        key: `sec:${r}`,
        label: `كل ثانية · ${RES_LABEL[r]}`,
        // 4K waits for the owner: a long 4K file can pass the 50MB per-file storage limit (provider paid, file not saved)
        defaultCenti: r === "4k" ? null : centiFor(seedanceSecondUsd(v, r)),
        basis:
          r === "4k"
            ? `موقوف حتى تحدد سعره: ملف 4K الطويل قد يتجاوز حد 50MB لكل ملف في التخزين. ارفع الحد في Supabase أولًا. السعر المحسوب: ${(centiFor(seedanceSecondUsd(v, r)) / 100).toFixed(2)} للثانية ($${SEEDANCE_RATE[v][r]}/مليون توكن)`
            : `$${SEEDANCE_RATE[v][r]}/مليون توكن × أكبر مقاس للدقة × 24 إطار ÷ 1024`,
      })),
      ...resolutions.map((r) => ({
        key: `vref:sec:${r}`,
        label: `كل ثانية من فيديو مرجعي · ${RES_LABEL[r]}`,
        // Priced like an output second (the higher "without video" rate): the real "with video" rate is lower,
        // which leaves room for the minimum token consumption ModelArk only estimates. 4K follows sec:4k (held).
        defaultCenti: r === "4k" ? null : centiFor(seedanceSecondUsd(v, r)),
        basis:
          r === "4k"
            ? "يتبع 4K: موقوف حتى تحدد سعره"
            : `سقف: بسعر ثانية المخرج ($${SEEDANCE_RATE[v][r]}/مليون)، والفعلي مع فيديو $${SEEDANCE_RATE_WITH_VIDEO[v][r]}/مليون + حد أدنى تقديري للتوكنات`,
      })),
    ],
    modeFor(style, refs) {
      if (!refs.length) return modes[0];
      if (style === "frames") return refs.length >= 2 ? modes[2] : modes[1];
      return modes[3];
    },
    rules(d, mode) {
      const issues: Issue[] = [];
      const notes: string[] = [];
      const states: Partial<Record<string, Partial<OptionState>>> = {};
      if (mode.refStyle === "frames") {
        // ModelArk keeps the first frame's aspect ratio in image-to-video (2.5: only "adaptive"); we never crop silently
        states.ratio = { fixed: { value: "adaptive", reason: "النسبة تتبع صورة الإطار الأول تلقائيًا" } };
        notes.push("في وضع الإطارات تُحفظ نسبة صورة الإطار الأول كما هي (adaptive)، ولا نقص الصورة.");
        if (mode.id === "first_last_frame") notes.push("إذا اختلفت نسبة الإطار الأخير عن الأول، يقصّه المزوّد ليطابق الأول.");
      }
      if (!def.prompt.arabic && hasArabic(d.prompt)) issues.push({ field: "prompt", message: def.prompt.arabicNote! });
      if (d.refs.some((r) => r.kind === "image" || r.kind === "video")) {
        notes.push("لا يقبل Seedance رفع صور أو فيديوهات فيها وجوه بشرية حقيقية كمراجع (سياسة المزوّد).");
      }
      return { options: opt(def.options, states), issues, notes };
    },
    price(d, mode, table) {
      const res = String(d.settings.resolution);
      const sec = Number(d.settings.duration);
      const per = table[`sec:${res}`];
      if (per == null) return { ok: false, reason: "سعر هذه الدقة غير محدد بعد." };
      const lines = [{ label: `${sec} ث · ${RES_LABEL[res] ?? res}`, centi: per * sec }];
      const vids = d.refs.filter((r) => r.kind === "video");
      if (vids.length) {
        const vk = table[`vref:sec:${res}`];
        if (vk == null) return { ok: false, reason: "مراجع الفيديو بهذه الدقة غير مسعّرة." };
        const inSec = Math.ceil(vids.reduce((s, r) => s + (r.durationMs ?? 0), 0) / 1000);
        lines.push({ label: `${inSec} ث فيديو مرجعي`, centi: inSec * vk });
      }
      void mode;
      return total(lines, def.costUsd(d, mode));
    },
    costUsd(d, mode) {
      const res = String(d.settings.resolution);
      if (!SEEDANCE_PIXELS[v][res]) return null;
      const ratio = mode.refStyle === "frames" ? undefined : String(d.settings.ratio);
      const inMs = d.refs.filter((r) => r.kind === "video").reduce((s, r) => s + (r.durationMs ?? 0), 0);
      if (!inMs) return seedanceSecondUsd(v, res, ratio) * Number(d.settings.duration);
      // With a video in the input: (input + output seconds) at the "with video" rate
      const perSec = seedanceSecondUsd(v, res, ratio) * (SEEDANCE_RATE_WITH_VIDEO[v][res] / SEEDANCE_RATE[v][res]);
      return perSec * (inMs / 1000 + Number(d.settings.duration));
    },
    // Seedance 2.0 references in a prompt: @image1 · @video1 · @audio1, by type in the order they are sent
    refLabel: (kind, n) => `@${kind}${n}`,
    sources: [
      { label: "BytePlus ModelArk — Create a video generation task", url: "https://docs.byteplus.com/en/docs/ModelArk/1520757", checked: CHECKED },
      { label: "BytePlus ModelArk — Retrieve / List / Cancel a video generation task", url: "https://docs.byteplus.com/en/docs/ModelArk/1521309", checked: CHECKED },
      { label: "BytePlus ModelArk — Model pricing (video generation)", url: "https://docs.byteplus.com/en/docs/ModelArk/1544106", checked: CHECKED },
      { label: "Seedance 2.0 multimodal guide (@image1 · @video1 · @audio1 by upload order) — public guide", url: "https://wavespeed.ai/blog/posts/seedance-2-0-complete-guide-multimodal-video-creation/", checked: CHECKED },
    ],
    verification: [
      { item: "الأوضاع", status: "verified", note: "نص · إطار أول · إطار أول وأخير · مراجع متعددة، ولا يُجمع بينها في طلب واحد." },
      { item: "النِّسب", status: "verified", note: "16:9 · 9:16 · 1:1 · 4:3 · 3:4 · 21:9؛ في أوضاع الإطارات نرسل adaptive (تتبع الإطار الأول)." },
      { item: "الدقة", status: "verified", note: is25 ? "480p · 720p · 1080p" : "480p · 720p · 1080p · 4K" },
      { item: "المدة", status: "verified", note: `من 4 إلى ${maxSec} ثانية (نرسل مدة محددة، لا -1).` },
      { item: "المراجع", status: "verified", note: `صور 1–${lim.images}، صوت حتى ${lim.audios} (مجموع ≤ ${lim.totalMs / 1000} ث، كل مقطع 2–${lim.clipMax / 1000} ث، MP3/WAV ≤ 15MB)؛ صورة ≤ 30MB، أضلاع 300–6000، نسبة 0.4–2.5.${is25 ? "" : " الصوت وحده غير مقبول في 2.0."}` },
      { item: "اللغة", status: "verified", note: is25 ? "يدعم البرومبت العربي." : "لا يدعم العربية رسميًا؛ نمنع البرومبت العربي." },
      { item: "طول البرومبت", status: "verified", note: "لا حد ثابت موثّق؛ يُنصح بـ ≤ 1000 كلمة إنجليزية أو 500 حرف صيني. نقبل حتى 32,000 حرف وننبّه بعد التوصية دون منع." },
      { item: "السعر", status: "verified", note: `توكنات = (مدة الفيديو المرجعي + المخرج) × العرض × الارتفاع × 24 ÷ 1024؛ بلا فيديو مرجعي: ${resolutions.map((r) => `${RES_LABEL[r]} $${SEEDANCE_RATE[v][r]}`).join(" · ")} لكل مليون. لا يُحسب الفشل.` },
      { item: "مراجع الفيديو", status: "unverified", note: `مع فيديو مرجعي تُحسب المهمة كلها بسعر «مع فيديو» (${resolutions.map((r) => `${RES_LABEL[r]} $${SEEDANCE_RATE_WITH_VIDEO[v][r]}`).join(" · ")} لكل مليون)، مع حد أدنى للتوكنات تقديري فقط؛ نسعّر ثانية المرجع افتراضيًا كثانية مخرج (سقف).` },
      { item: "التقدم", status: "verified", note: "الحالات queued/running/succeeded/failed/expired بلا نسبة مئوية؛ نعرض مؤشرًا غير محدد." },
      { item: "الإلغاء", status: "verified", note: "ممكن فقط والمهمة في الطابور (queued)." },
      { item: "الإشعارات", status: "verified", note: "callback_url يرسل POST عند تغيّر الحالة؛ نتحقق منه بالاستعلام عن المهمة ولا نثق بمحتواه." },
      { item: "الحفظ", status: "verified", note: "رابط الفيديو صالح 24 ساعة؛ ننسخه فورًا إلى تخزيننا." },
      { item: "أسماء المراجع في البرومبت", status: "unverified", note: "‎@image1 · ‎@video1 · ‎@audio1 حسب النوع وترتيب الإرسال، من أدلة Seedance 2.0 المنشورة؛ صفحة ModelArk الرسمية لا تُقرأ آليًا هنا. كل «‎@اسم» يُرسل بهذا الشكل." },
      ...(is25 ? [] : [{ item: "4K", status: "verified" as const, note: "مدعوم من المزوّد، لكنه موقوف عندنا حتى تحدد سعره: الملف الطويل قد يتجاوز حد 50MB لكل ملف في التخزين." }]),
    ],
    notes: is25 ? [] : ["لا يقبل البرومبت العربي."],
  };
  return def;
}

// ───────────────────────────── OpenAI · GPT-4o mini TTS ─────────────────────────────

const VOICES = ["marin", "cedar", "alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse"];

const ttsMode: ModeDef = { id: "text_to_speech", label: "نص إلى كلام", refStyle: "none", refs: {}, promptRequired: true };

const miniTts: GeneratorDef = {
  id: "openai-gpt-4o-mini-tts",
  name: "GPT-4o mini TTS",
  output: "audio",
  defaultSection: "audio",
  provider: { id: "openai", label: "OpenAI" },
  model: { id: "gpt-4o-mini-tts-2025-12-15", family: "gpt-4o-mini-tts", version: "2025-12-15" },
  api: { name: "OpenAI Audio API (speech)", endpoint: "POST /v1/audio/speech", tracking: "sync", progress: "none", cancel: "none" },
  modes: [ttsMode],
  options: [
    { key: "voice", label: "الصوت", kind: "choice", ltr: true, default: "marin", values: VOICES.map((v) => ({ value: v, label: v, hint: v === "marin" || v === "cedar" ? "الأفضل جودة" : undefined })) },
    {
      key: "format", label: "صيغة الملف", kind: "choice", ltr: true, default: "mp3",
      values: [
        { value: "mp3", label: "MP3" },
        { value: "wav", label: "WAV" },
        { value: "opus", label: "Opus" },
        { value: "aac", label: "AAC" },
        { value: "flac", label: "FLAC" },
      ],
    },
  ],
  files: {},
  prompt: { label: "النص المنطوق", placeholder: "اكتب الكلام كما سيُنطق حرفيًا…", max: 1800, arabic: true },
  extraText: { key: "instructions", label: "وصف الأداء (اختياري)", placeholder: "مثال: صوت هادئ ودافئ، بإيقاع بطيء…", max: 300 },
  priceKeys: [
    {
      key: "chars:1k",
      label: "كل ١٠٠٠ حرف (النص + وصف الأداء)",
      // OpenAI's own published per-character speech price (tts-1-hd: $30 / 1M characters)
      defaultCenti: centiFor((1000 * 30) / 1e6),
      basis: "بسعر OpenAI المنشور لنموذج الصوت عالي الجودة tts-1-hd ($30 لكل مليون حرف)؛ توكنات الصوت لكل ثانية غير موثّقة لهذا النموذج",
    },
  ],
  modeFor: () => ttsMode,
  rules: () => ({ options: opt(miniTts.options), issues: [], notes: ["الأصوات محسّنة للإنجليزية؛ النطق العربي مدعوم لكن جودته تختلف حسب الصوت."] }),
  price(d, _mode, table) {
    const per = table["chars:1k"];
    if (per == null) return { ok: false, reason: "سعر توليد الصوت لم يُحدد بعد (تكلفة المزوّد للثانية غير موثّقة)." };
    const k = Math.max(1, Math.ceil((d.prompt.length + d.instructions.length) / 1000));
    return total([{ label: `${k} × ١٠٠٠ حرف`, centi: k * per }], null);
  },
  costUsd: () => null,
  sources: [
    { label: "OpenAI — Text to speech guide (voices, formats, languages)", url: "https://developers.openai.com/api/docs/guides/text-to-speech", checked: CHECKED },
    { label: "OpenAI — Pricing (gpt-4o-mini-tts tokens; tts-1-hd $30 / 1M characters)", url: "https://developers.openai.com/api/docs/pricing", checked: CHECKED },
    { label: "OpenAI — Create speech (input ≤ 4096 chars, instructions)", url: "https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create", checked: CHECKED },
    { label: "OpenAI — GPT-4o mini TTS model (2000 input tokens, prices)", url: "https://developers.openai.com/api/docs/models/gpt-4o-mini-tts", checked: CHECKED },
  ],
  verification: [
    { item: "الأصوات", status: "verified", note: "13 صوتًا مدمجًا؛ marin وcedar الأفضل جودة." },
    { item: "وصف الأداء", status: "verified", note: "instructions حقل منفصل عن النص المنطوق." },
    { item: "الصيغ", status: "verified", note: "mp3 · opus · aac · flac · wav (pcm مستبعد لأنه بلا ترويسة)." },
    { item: "الطول", status: "verified", note: "حد النموذج 2000 توكن للمدخل؛ نقبل حتى 1800 حرف نصًا و300 حرف وصفًا." },
    { item: "اللغة", status: "verified", note: "يتبع لغات Whisper ومنها العربية؛ لا يوجد معامل لغة (تُستنتج من النص)." },
    { item: "السرعة", status: "unverified", note: "speed موثّق للنقطة عمومًا دون تأكيد لهذا النموذج؛ غير معروض." },
    { item: "معدل العينة", status: "unverified", note: "موثّق فقط لـ pcm (24kHz)؛ غير معروض." },
    { item: "السعر", status: "unverified", note: "$0.60/مليون توكن نص و$12/مليون توكن صوت، لكن توكنات الصوت لكل ثانية غير موثّقة؛ نسعّر افتراضيًا بسعر OpenAI المنشور لـ tts-1-hd ($30/مليون حرف)." },
  ],
  notes: ["يجب إخبار المستمع أن الصوت مولّد بالذكاء الاصطناعي (سياسة OpenAI)."],
};

function total(lines: { label: string; centi: number }[], usd: number | null): PriceResult {
  const centi = lines.reduce((s, l) => s + l.centi, 0);
  return { ok: true, coins: coinsOf(centi), lines, usdCeiling: usd };
}

export const GENERATORS: GeneratorDef[] = [gptImage2, seedance("2.5"), seedance("2.0"), miniTts];
export const generatorById = (id: string) => GENERATORS.find((g) => g.id === id);

/** The settings a generator starts with. */
export const defaultSettings = (g: GeneratorDef): Settings => Object.fromEntries(g.options.map((o) => [o.key, o.default]));

export type { RefMeta };
