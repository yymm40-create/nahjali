// «الجواد الذكي!» | JAWAD AI — the central registry of generators. One definition per integration (provider + model
// version + API), used by the studio in the browser AND re-checked on the server before any charge.
//
// Everything below was checked against the providers' official API documents on 2026-10-04 (links in `sources`).
// What could not be confirmed is marked `unverified` and the option it affects stays off (see `verification`).
// The owner can rename, hide, reorder or re-price a generator from /jawad-ai/admin, but can never add a capability:
// options, limits and modes only come from this file.

import { COIN_COST_USD } from "../coins";
import type { GeneratorDef, Issue, ModeDef, OptionState, PriceResult, RefMeta, Settings } from "./types";
import { DICTION_KEY, DICTION_VALUES, hasMarks, mostlyArabic, type Diction } from "./diction";
import { needsFrames, SMART_SPLIT_ID, SMART_SPLIT_MODE, STEM_LABEL, stemsOf, VIDEO_SFX, videoSfxSeconds } from "./smart-split";

const CHECKED = "2026-10-04";

/** Price key of «المخرج الخارق» (the prompt rewrite offered in video making), per use. */
export const DIRECTOR_PRICE_KEY = "director:prompt";
/** «التعديل الذكي» of a finished result: the fixed fee, and (videos) Claude writing the corrected prompt. Per edit. */
export const EDIT_FEE_KEY = "edit:fee";
export const EDIT_CLAUDE_KEY = "edit:claude";
/**
 * Claude Opus 5.5 writing a corrected video prompt, one answer at its ceiling: the Super Director skill (~10,000 tokens
 * at the cache-write rate $5/M) + up to 16 frames and the texts (~8,000 tokens × $4/M) + up to 6,000 output tokens × $20/M;
 * and before it, the original's locks (the previous prompt, سجاد's brief of a film and 3 frames: ~8,000 tokens × $5/M
 * + ~1,500 output tokens × $20/M).
 */
export const EDIT_CLAUDE_USD = (10_000 * 5 + 8_000 * 4 + 6_000 * 20 + 8_000 * 5 + 1_500 * 20) / 1e6;
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
    { key: EDIT_FEE_KEY, label: "التعديل الذكي · رسوم إضافية (للمرة)", defaultCenti: 1000, basis: "سعر ثابت حدّده المالك (10 نقدات) فوق سعر الصورة؛ يشمل كتابة Claude للبرومبت المعدّل" },
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
      {
        key: DIRECTOR_PRICE_KEY,
        label: "تطوير البرومبت بالمخرج الخارق (للمرة)",
        defaultCenti: 3000,
        basis: "سعر ثابت حدّده المالك (30 نقدة): Claude Opus 5.5 يعيد كتابة البرومبت بمهارة «المخرج الخارق»",
      },
      {
        key: EDIT_CLAUDE_KEY,
        label: "التعديل الذكي · Claude يكتب البرومبت المعدّل (للمرة)",
        defaultCenti: centiFor(EDIT_CLAUDE_USD),
        basis: `سقف إجابة واحدة لـ Claude Opus 5.5: مهارة المخرج الخارق (~10,000 توكن × $5/مليون) + حتى 16 لقطة والنصوص (~8,000 × $4) + حتى 6,000 توكن ناتج × $20 = $${EDIT_CLAUDE_USD.toFixed(3)}`,
      },
      { key: EDIT_FEE_KEY, label: "التعديل الذكي · رسوم إضافية (للمرة)", defaultCenti: 3000, basis: "سعر ثابت حدّده المالك (30 نقدة) فوق Claude وسعر الفيديو" },
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

// ───────────────────────────── ElevenLabs · Eleven v4 · Sound effects v2 · Music v2.5 ─────────────────────────────
// Checked on 2026-10-05 against ElevenLabs' models page, API reference, pay-as-you-go API pricing and the official
// JS SDK 2.70.0 (released with Eleven v4 on 2026-09-28).

const EL_CHECKED = "2026-10-05";
/** USD (pay-as-you-go API, regular price, not the launch discount): v4 per 1K characters · SFX, music, voice isolator per minute. */
export const ELEVEN_PRICE = { v4PerKChars: 0.08, sfxPerMin: 0.12, musicPerMin: 0.15, isolatorPerMin: 0.12 };
/**
 * Voice design: three spoken previews of up to 1,000 characters each (no separate API price is published; a ceiling
 * at the v4 speech rate). Saving a voice costs nothing at ElevenLabs but takes one of the account's voice slots.
 */
export const VOICE_DESIGN_USD = (3 * 1000 * ELEVEN_PRICE.v4PerKChars) / 1000;
/**
 * «النطق الدقيق»: Claude Opus 5.5 vowels the words of an Arabic text that need it (USD per 1,000 characters, a
 * ceiling with its thinking: about 1.5K input tokens at $4/M and 2K output tokens at $20/M).
 */
export const DICTION_USD_PER_K = 0.05;
/** Whether a request's text goes through «النطق الدقيق» (an Arabic text, and a mode other than «كما كتبت»). */
export const dictionOf = (d: { settings: Settings; prompt: string }): Diction => {
  const m = String(d.settings[DICTION_KEY] ?? "off") as Diction;
  return m !== "off" && mostlyArabic(d.prompt) ? m : "off";
};
/** Price keys of the voice library (on the Eleven v4 generator): designing a voice, and copying one from a recording. */
export const VOICE_DESIGN_KEY = "voice:design";
export const VOICE_CLONE_KEY = "voice:clone";
/**
 * A voice in a request: «p:<id>» one of ElevenLabs' ready voices, «v:<uuid>» one the person saved in their library.
 * George is in ElevenLabs' own examples and in every account's default voices.
 */
export const ELEVEN_VOICE = /^(p:[A-Za-z0-9]{16,32}|v:[0-9a-f-]{36})$/;
/** Any voice the film maker's cast may take: ElevenLabs' or MiniMax's. */
export const ANY_VOICE = /^(p:[A-Za-z0-9]{16,32}|x:[A-Za-z0-9_-]{2,64}|v:[0-9a-f-]{36})$/;
export const ELEVEN_DEFAULT_VOICE = "p:JBFqnCBsd6RMkjVDRZzb";
const AUDIO_REF = { mimes: ["audio/mpeg", "audio/wav"], maxBytes: 15 * MB };
const elSources = (extra: { label: string; url: string }[]) => [
  { label: "ElevenLabs — Models (eleven_v4, eleven_ttv_v3, eleven_text_to_sound_v2, music_v2_5)", url: "https://elevenlabs.io/docs/overview/models", checked: EL_CHECKED },
  { label: "ElevenLabs — API pricing (pay as you go)", url: "https://elevenlabs.io/pricing/api", checked: EL_CHECKED },
  ...extra.map((x) => ({ ...x, checked: EL_CHECKED })),
];

const v4Mode: ModeDef = { id: "text_to_speech", label: "نص إلى كلام", refStyle: "none", refs: {}, promptRequired: true };
const elevenV4: GeneratorDef = {
  id: "elevenlabs-eleven-v4",
  name: "Eleven v4",
  output: "audio",
  defaultSection: "audio",
  provider: { id: "elevenlabs", label: "ElevenLabs" },
  model: { id: "eleven_v4", family: "Eleven v4", version: "2026-09-28" },
  api: { name: "ElevenLabs Text to Speech API", endpoint: "POST /v1/text-to-speech/{voice_id}", tracking: "sync", progress: "none", cancel: "none" },
  modes: [v4Mode],
  options: [
    { key: "voice", label: "الصوت", kind: "choice", ltr: true, default: ELEVEN_DEFAULT_VOICE, values: [{ value: ELEVEN_DEFAULT_VOICE, label: "George" }], accepts: ELEVEN_VOICE, picker: "voice" },
    {
      key: "stability", label: "الأداء", kind: "choice", default: "0.5",
      values: [
        { value: "0", label: "معبّر", hint: "انفعال أكثر" },
        { value: "0.5", label: "طبيعي" },
        { value: "1", label: "ثابت", hint: "إلقاء متّزن" },
      ],
    },
    { key: DICTION_KEY, label: "دقة النطق العربي", kind: "choice", default: "precise", values: DICTION_VALUES },
  ],
  files: {},
  prompt: { label: "النص المنطوق", placeholder: "اكتب الكلام كما سيُنطق… شكّل الكلمة اللي تبي نطقها بالضبط (أنتِ، لكِ). وجّه الأداء بوسوم مثل [whispers] أو [laughs].", max: 5000, arabic: true },
  priceKeys: [
    { key: "chars:1k", label: "كل ١٠٠٠ حرف", defaultCenti: centiFor(ELEVEN_PRICE.v4PerKChars), basis: `سعر ElevenLabs المنشور لـ Eleven v4: $${ELEVEN_PRICE.v4PerKChars} لكل ١٠٠٠ حرف (السعر العادي، لا خصم الإطلاق)` },
    { key: VOICE_DESIGN_KEY, label: "تصميم صوت بالوصف (٣ عينات)", defaultCenti: centiFor(VOICE_DESIGN_USD), basis: `سقف: ٣ عينات × ١٠٠٠ حرف بسعر الكلام ($${ELEVEN_PRICE.v4PerKChars}/١٠٠٠)؛ لا يوجد سعر منفصل منشور لتصميم الأصوات` },
    { key: VOICE_CLONE_KEY, label: "نسخ صوت من تسجيل (للمرة)", defaultCenti: 500, basis: "سعر ثابت حدّده المالك (5 نقدات): النسخ الفوري بلا تكلفة لدى ElevenLabs لكنه يشغل خانة صوت في الحساب" },
    { key: "diction:1k", label: "النطق الدقيق (كل ١٠٠٠ حرف عربي)", defaultCenti: centiFor(DICTION_USD_PER_K), basis: `تقدير: Claude Opus 5.5 يشكّل الكلمات الملتبسة ($4/$20 لكل مليون توكن دخل/خرج) ≈ $${DICTION_USD_PER_K} لكل ١٠٠٠ حرف مع التفكير` },
  ],
  modeFor: () => v4Mode,
  rules(d) {
    const notes = ["وجّه الأداء بوسوم بين قوسين مثل [whispers] و[laughs] و[shouts]؛ يتكلم أكثر من ٩٠ لغة منها العربية."];
    const mode = String(d.settings[DICTION_KEY] ?? "precise");
    if (mostlyArabic(d.prompt)) {
      if (mode === "off" && hasMarks(d.prompt)) notes.unshift("«كما كتبت»: ElevenLabs يتجاهل الحركات غالبًا (مثل أنتِ ← أنتَ). «دقيق» يضمن نطقها.");
      else if (mode === "precise") notes.unshift("«دقيق»: Claude يشكّل الكلمات اللي يتغيّر نطقها بالحركات (حركاتك تبقى كما هي، والمؤنث يمشي على كل الكلام)، وتوصل لـ ElevenLabs بكتابتها الصوتية (IPA)، الطريقة الرسمية لضبط النطق في Eleven v4. تشوفها في «التفاصيل».");
      else if (mode === "spelled") notes.unshift("«كتابة صوتية»: نفس التشكيل، لكن نهاية المؤنث تُكتب حرفًا (أنتِ ← أنتي، لكِ ← لكي) والباقي بحركاته. جرّبها إذا صوتك ما ضبط مع «دقيق».");
    }
    return { options: opt(elevenV4.options), issues: [], notes };
  },
  price(d, _mode, table) {
    const per = table["chars:1k"];
    if (per == null) return { ok: false, reason: "سعر الكلام لم يُحدد بعد." };
    const k = Math.max(1, Math.ceil(d.prompt.length / 1000));
    const lines = [{ label: `${k} × ١٠٠٠ حرف`, centi: k * per }];
    if (dictionOf(d) !== "off") {
      const dp = table["diction:1k"];
      if (dp == null) return { ok: false, reason: "سعر النطق الدقيق لم يُحدد بعد." };
      lines.push({ label: `النطق الدقيق · ${k} × ١٠٠٠ حرف`, centi: k * dp });
    }
    return total(lines, elevenV4.costUsd(d, v4Mode));
  },
  costUsd: (d) => (Math.max(1, d.prompt.length) / 1000) * (ELEVEN_PRICE.v4PerKChars + (dictionOf(d) !== "off" ? DICTION_USD_PER_K : 0)),
  sources: elSources([
    { label: "ElevenLabs — Create speech (voice_id, model_id, voice_settings, output_format)", url: "https://elevenlabs.io/docs/api-reference/text-to-speech/convert" },
    { label: "ElevenLabs — Design a voice (eleven_ttv_v3, reference audio, prompt strength)", url: "https://elevenlabs.io/docs/api-reference/text-to-voice/design" },
    { label: "ElevenLabs — Create a voice from a preview", url: "https://elevenlabs.io/docs/api-reference/text-to-voice/create" },
    { label: "ElevenLabs — Eleven v4 (help center)", url: "https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/what-is-eleven-v4" },
    { label: "ElevenLabs — Best practices: IPA with Eleven v4 (/…/ inline)", url: "https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices" },
    { label: "ElevenLabs — Pronunciation dictionaries (IPA in languages other than English needs eleven_v4)", url: "https://elevenlabs.io/docs/eleven-api/guides/how-to/text-to-speech/pronunciation-dictionaries" },
  ]),
  verification: [
    { item: "النموذج", status: "verified", note: "eleven_v4 أحدث نموذج كلام (أُطلق 28 سبتمبر 2026)، حد 10,000 حرف للطلب؛ نقبل حتى 5,000." },
    { item: "الأصوات", status: "verified", note: "أصوات ElevenLabs الجاهزة في الحساب + الأصوات المحفوظة في مكتبة الشخص (مصمّمة بالوصف أو منسوخة من تسجيل)." },
    { item: "تصميم الصوت", status: "verified", note: "POST /v1/text-to-voice/design بنموذج eleven_ttv_v3 (الأحدث) يرجع عينات؛ مع مرجع صوتي (reference_audio_base64) وقوة الوصف prompt_strength." },
    { item: "الأداء", status: "verified", note: "voice_settings.stability: الأقل أكثر تعبيرًا والأعلى أثبت (الافتراضي 0.5)؛ نرسل 0 أو 0.5 أو 1." },
    { item: "الصيغة", status: "verified", note: "mp3_44100_128 (الافتراضي)." },
    { item: "النطق العربي", status: "verified", note: "Eleven v4 يقرأ IPA بين شرطتين «/…/» داخل النص لضبط نطق كلمة، وفي غير الإنجليزية لازم eleven_v4. language_code (ISO 639-1) يفرض اللغة على النموذج وقراءة الأرقام؛ نرسل «ar» للنص العربي." },
    { item: "الحركات", status: "unverified", note: "لا تذكر ElevenLabs الحركات العربية؛ ولاحظنا أنها تُتجاهل غالبًا. لذلك «النطق الدقيق» يرسل الكلمات المشكّلة بنطقها الصوتي بدل الاعتماد على الحركات. جودة IPA قد تختلف من صوت لصوت (توصية ElevenLabs: جرّب صوتك)، و«كتابة صوتية» بديل." },
    { item: "السعر", status: "verified", note: `$${ELEVEN_PRICE.v4PerKChars} لكل ١٠٠٠ حرف (عليه خصم إطلاق مؤقت حتى 12 أكتوبر؛ نسعّر بالسعر العادي).` },
    { item: "سعر تصميم الصوت", status: "unverified", note: "غير منشور منفصلًا؛ نسعّره بسقف ٣ عينات × ١٠٠٠ حرف بسعر الكلام." },
  ],
  notes: ["يجب إخبار المستمع أن الصوت مولّد بالذكاء الاصطناعي.", "لا يُنسخ صوت شخص إلا بإذنه."],
};

const sfxMode: ModeDef = { id: "text_to_sfx", label: "مؤثر من الوصف", refStyle: "none", refs: {}, promptRequired: true };
const elevenSfx: GeneratorDef = {
  id: "elevenlabs-sfx-v2",
  name: "ElevenLabs Sound Effects",
  output: "audio",
  defaultSection: "audio",
  provider: { id: "elevenlabs", label: "ElevenLabs" },
  model: { id: "eleven_text_to_sound_v2", family: "Text to Sound", version: "v2" },
  api: { name: "ElevenLabs Sound Effects API", endpoint: "POST /v1/sound-generation", tracking: "sync", progress: "none", cancel: "none" },
  modes: [sfxMode],
  options: [
    { key: "duration", label: "المدة", kind: "int", min: 1, max: 30, default: 5, unit: "ثانية" },
    {
      key: "influence", label: "الالتزام بالوصف", kind: "choice", default: "0.3",
      values: [
        { value: "0.3", label: "حر", hint: "تنوع أكثر" },
        { value: "0.6", label: "متوازن" },
        { value: "0.9", label: "حرفي", hint: "يتبع الوصف بدقة" },
      ],
    },
    { key: "loop", label: "مؤثر يتكرر بسلاسة (لوب)", kind: "bool", default: false, hint: "للخلفيات: مطر، رياح، زحام…" },
  ],
  files: {},
  prompt: { label: "وصف المؤثر", placeholder: "مثال: خطوات على أرض حجرية في ممر واسع، صدى خفيف، ليلًا… (الإنجليزية أدق)", max: 2000, arabic: true },
  priceKeys: [{ key: "sec", label: "كل ثانية", defaultCenti: centiFor(ELEVEN_PRICE.sfxPerMin / 60), basis: `سعر ElevenLabs المنشور للمؤثرات: $${ELEVEN_PRICE.sfxPerMin} للدقيقة` }],
  modeFor: () => sfxMode,
  rules: () => ({
    options: opt(elevenSfx.options),
    issues: [],
    notes: ["الوصف بالإنجليزية يعطي نتائج أدق؛ المؤثرات بلا كلام ولا موسيقى.", "عندك فيديو؟ «الفصل الذكي» يصنع مؤثراته في أماكنها، وموسيقاه، ويفصل حواره."],
  }),
  price(d, _mode, table) {
    const per = table.sec;
    if (per == null) return { ok: false, reason: "سعر المؤثرات لم يُحدد بعد." };
    const sec = Number(d.settings.duration) || 5;
    return total([{ label: `${sec} ث`, centi: sec * per }], elevenSfx.costUsd(d, sfxMode));
  },
  costUsd: (d) => ((Number(d.settings.duration) || 5) * ELEVEN_PRICE.sfxPerMin) / 60,
  sources: elSources([{ label: "ElevenLabs — Create sound effect (text, duration_seconds 0.5–30, loop, prompt_influence)", url: "https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert" }]),
  verification: [
    { item: "النموذج", status: "verified", note: "eleven_text_to_sound_v2، النموذج الوحيد للمؤثرات." },
    { item: "المدة", status: "verified", note: "0.5–30 ثانية؛ نرسل مدة محددة (1–30) ليكون السعر معروفًا." },
    { item: "اللوب والالتزام بالوصف", status: "verified", note: "loop (v2 فقط) وprompt_influence من 0 إلى 1 (الافتراضي 0.3)." },
    { item: "المراجع", status: "verified", note: "واجهة المؤثرات لا تقبل صوتًا مرجعيًا؛ المرجع يُستعمل كما هو من «مكتبة الأعمال»." },
    { item: "السعر", status: "verified", note: `$${ELEVEN_PRICE.sfxPerMin} للدقيقة.` },
  ],
  notes: [],
};

/** How a reference song is used: inspired by it, learning from it closely, or keeping it (Eleven Music's condition strength). */
export const MUSIC_REF_USE: Record<string, { label: string; strength: "low" | "medium" | "high" | "xhigh" }> = {
  inspire: { label: "يستوحي منه", strength: "low" },
  learn: { label: "يتعلّم منه", strength: "high" },
  same: { label: "يستخدمه نفسه", strength: "xhigh" },
};
/** The part of a reference song the music is conditioned on (Eleven Music's audio reference is about 30 seconds). */
export const MUSIC_REF_MS = 30_000;
const musicModes: ModeDef[] = [
  { id: "text_to_music", label: "من الوصف", refStyle: "none", refs: {}, promptRequired: true },
  { id: "music_reference", label: "بمقطع مرجعي", refStyle: "references", refs: { audio: { min: 1, max: 1 } }, promptRequired: true },
];
const elevenMusic: GeneratorDef = {
  id: "elevenlabs-music-v2-5",
  name: "Eleven Music v2.5",
  output: "audio",
  defaultSection: "audio",
  provider: { id: "elevenlabs", label: "ElevenLabs" },
  model: { id: "music_v2_5", family: "Eleven Music", version: "2.5" },
  api: { name: "ElevenLabs Music API", endpoint: "POST /v1/music · POST /v1/music/plan · POST /v1/music/upload", tracking: "sync", progress: "none", cancel: "none" },
  modes: musicModes,
  options: [
    { key: "duration", label: "المدة", kind: "int", min: 10, max: 300, step: 5, default: 60, unit: "ثانية" },
    { key: "instrumental", label: "بدون غناء (آلات فقط)", kind: "bool", default: false },
    {
      key: "refUse", label: "المقطع المرجعي", kind: "choice", default: "inspire",
      values: Object.entries(MUSIC_REF_USE).map(([value, x]) => ({ value, label: x.label })),
    },
  ],
  files: { audio: { ...AUDIO_REF, minMs: 5_000, maxMs: 60_000 } },
  prompt: { label: "وصف المقطوعة", placeholder: "الأسلوب والآلات والإيقاع والمزاج… والكلمات إن أردت غناءً (الإنجليزية أدق للأسلوب).", max: 4000, arabic: true },
  priceKeys: [
    { key: "sec", label: "كل ثانية من المقطوعة", defaultCenti: centiFor(ELEVEN_PRICE.musicPerMin / 60), basis: `سعر ElevenLabs المنشور للموسيقى: $${ELEVEN_PRICE.musicPerMin} للدقيقة` },
    { key: "ref:sec", label: "كل ثانية من المقطع المرجعي (رفعه)", defaultCenti: centiFor(ELEVEN_PRICE.musicPerMin / 60), basis: "رفع مقطع لـ Eleven Music بسعر توليد المقطوعة نفسه (وثيقة Upload music)" },
  ],
  modeFor: (_style, refs) => (refs.some((r) => r.kind === "audio") ? musicModes[1] : musicModes[0]),
  rules(d, mode) {
    const states: Partial<Record<string, Partial<OptionState>>> = {};
    if (mode.id !== "music_reference") states.refUse = { hidden: true };
    const notes = mode.id === "music_reference" ? [`يُبنى على أول ${MUSIC_REF_MS / 1000} ثانية من المقطع المرجعي: «يستوحي» بحرية، «يتعلّم» بقرب، «يستخدمه نفسه» بأقرب ما يمكن.`] : [];
    void d;
    return { options: opt(elevenMusic.options, states), issues: [], notes };
  },
  price(d, mode, table) {
    const per = table.sec;
    if (per == null) return { ok: false, reason: "سعر الموسيقى لم يُحدد بعد." };
    const sec = Number(d.settings.duration) || 60;
    const lines = [{ label: `${sec} ث`, centi: sec * per }];
    if (mode.id === "music_reference") {
      const rk = table["ref:sec"];
      if (rk == null) return { ok: false, reason: "سعر المقطع المرجعي لم يُحدد بعد." };
      const refSec = Math.ceil(d.refs.filter((r) => r.kind === "audio").reduce((s, r) => s + (r.durationMs ?? 0), 0) / 1000);
      lines.push({ label: `${refSec} ث مرجع`, centi: refSec * rk });
    }
    return total(lines, elevenMusic.costUsd(d, mode));
  },
  costUsd(d, mode) {
    const sec = Number(d.settings.duration) || 60;
    const refSec = mode.id === "music_reference" ? d.refs.filter((r) => r.kind === "audio").reduce((s, r) => s + (r.durationMs ?? 0), 0) / 1000 : 0;
    return ((sec + refSec) * ELEVEN_PRICE.musicPerMin) / 60;
  },
  sources: elSources([
    { label: "ElevenLabs — Compose music (prompt or composition_plan, music_length_ms 3,000–600,000, music_v2_5)", url: "https://elevenlabs.io/docs/api-reference/music/compose" },
    { label: "ElevenLabs — Upload music (song_id; billed like a generation)", url: "https://elevenlabs.io/docs/api-reference/music/upload" },
    { label: "ElevenLabs — Composition plans (chunks, styles, conditioning)", url: "https://elevenlabs.io/docs/eleven-api/guides/how-to/music/composition-plans" },
  ]),
  verification: [
    { item: "النموذج", status: "verified", note: "music_v2_5 أحدث نماذج Eleven Music." },
    { item: "المدة", status: "verified", note: "3 ثوانٍ إلى 10 دقائق في الواجهة البرمجية؛ نقدم 10–300 ثانية." },
    { item: "بدون غناء", status: "verified", note: "force_instrumental مع الوصف؛ ومع المرجع يُطلب في الخطة نفسها." },
    { item: "المقطع المرجعي", status: "verified", note: "يُرفع (POST /v1/music/upload → song_id)، ثم تُبنى خطة من الوصف (POST /v1/music/plan) ويُربط أول مقطع بالمرجع (conditioning_ref) بقوة low/high/xhigh." },
    { item: "إتاحة المرجع", status: "unverified", note: "بعض وثائق ElevenLabs تقصر رفع المقاطع على حسابات المؤسسات؛ إن رفضه المزوّد تُعاد النقود وتظهر رسالة واضحة." },
    { item: "السعر", status: "verified", note: `$${ELEVEN_PRICE.musicPerMin} للدقيقة، والرفع بسعر التوليد نفسه.` },
  ],
  notes: ["احترم حقوق المقاطع المرجعية: ElevenLabs يفحص المرفوع، وإن وجد محتوى محميًّا يرفضه ويحتسب نصف التكلفة."],
};

// ───────────────────────────── «الفصل الذكي» · ElevenLabs + Claude ─────────────────────────────

/**
 * Claude Opus 5.5 watching one video and planning its music and effects, at its ceiling: up to 60 frames (≤ 512 px,
 * ~400 tokens each) and the texts (~5,000 tokens) × $4/M + up to 20,000 output tokens (thinking included) × $20/M.
 */
export const SPLIT_CLAUDE_USD = ((VIDEO_SFX.framesMax * 400 + 5_000) * 4 + 20_000 * 20) / 1e6;
const videoMsOf = (refs: RefMeta[]) => refs.find((r) => r.kind === "video")?.durationMs ?? 0;
const splitMode: ModeDef = {
  id: SMART_SPLIT_MODE,
  label: "من فيديو",
  refStyle: "references",
  refs: { video: { min: 1, max: 1 } },
  promptRequired: false,
  prompt: { label: "توجيه إضافي", placeholder: "مثال: موسيقى عربية هادئة بالعود · ركّز على صوت السيوف · بدون أصوات خطوات" },
};
/** Price keys: one per track, per second of video. */
const STEM_KEY = { dialogue: "dialogue:sec", music: "music:sec", sfx: "sfx:sec" } as const;
const smartSplit: GeneratorDef = {
  id: SMART_SPLIT_ID,
  name: "الفصل الذكي",
  output: "audio",
  defaultSection: "audio",
  provider: { id: "elevenlabs", label: "ElevenLabs · Claude" },
  model: { id: "smart-split-v1", family: "Voice Isolator · Eleven Music v2.5 · Sound Effects v2 · Claude Opus 5.5", version: "2026-10-05" },
  api: {
    name: "ElevenLabs (Voice Isolator, Eleven Music, Sound Effects) + Claude Messages API",
    endpoint: "POST /v1/audio-isolation · POST /v1/music · POST /v1/sound-generation",
    tracking: "sync",
    progress: "none",
    cancel: "none",
  },
  modes: [splitMode],
  options: [
    { key: "dialogue", label: "الحوار", kind: "bool", default: true, hint: "يُفصل من صوت الفيديو نفسه" },
    { key: "music", label: "الموسيقى", kind: "bool", default: true, hint: "تُصنع جديدة على مقاس مشاهده، بلا غناء" },
    { key: "sfx", label: "المؤثرات الصوتية", kind: "bool", default: true, hint: "تُصنع كل واحدة في لحظتها" },
  ],
  files: { video: { mimes: ["video/mp4", "video/quicktime"], maxBytes: 50 * MB, minMs: VIDEO_SFX.minMs, maxMs: VIDEO_SFX.maxMs } },
  prompt: { label: "توجيه إضافي", placeholder: "مثال: موسيقى عربية هادئة بالعود · ركّز على صوت السيوف", max: 2000, arabic: true },
  priceKeys: [
    { key: STEM_KEY.dialogue, label: "الحوار · كل ثانية من الفيديو", defaultCenti: centiFor(ELEVEN_PRICE.isolatorPerMin / 60), basis: `سعر ElevenLabs المنشور لعزل الصوت: $${ELEVEN_PRICE.isolatorPerMin} للدقيقة` },
    { key: STEM_KEY.music, label: "الموسيقى · كل ثانية من الفيديو", defaultCenti: 100, basis: `مثل المؤثرات (30 نقدة لكل 30 ثانية): Claude يشاهد ويخطط الأقسام + Eleven Music $${ELEVEN_PRICE.musicPerMin}/دقيقة` },
    {
      key: STEM_KEY.sfx,
      label: "المؤثرات · كل ثانية من الفيديو",
      defaultCenti: 100,
      basis: `سعر ثابت حدّده المالك (30 نقدة لكل 30 ثانية). التكلفة القصوى لفيديو 30 ثانية: Claude ‏$${SPLIT_CLAUDE_USD.toFixed(2)} + مؤثرات حتى ${30 + VIDEO_SFX.eventsTotalSec} ثانية × $${ELEVEN_PRICE.sfxPerMin}/دقيقة`,
    },
  ],
  modeFor: () => splitMode,
  rules(d) {
    return {
      options: opt(smartSplit.options),
      issues: stemsOf(d.settings).length ? [] : [{ field: "sfx", message: "اختر مسارًا واحدًا على الأقل: الحوار أو الموسيقى أو المؤثرات." }],
      notes: [
        "يرجع لك كل مسار في ملف منفصل بطول الفيديو بالضبط: الحوار، والموسيقى، والمؤثرات.",
        "الحوار يُفصل من صوت الفيديو نفسه (لازم يكون فيه صوت). الموسيقى والمؤثرات تُصنع من جديد: يشاهد Claude الفيديو ويخطط لها على مشاهده ولحظاته.",
        `الفيديو حتى ${Math.floor(VIDEO_SFX.maxMs / 1000)} ثانية. الموسيقى بلا غناء، والمؤثرات بلا كلام.`,
      ],
    };
  },
  price(d, _mode, table) {
    const stems = stemsOf(d.settings);
    if (!stems.length) return { ok: false, reason: "اختر مسارًا واحدًا على الأقل." };
    const ms = videoMsOf(d.refs);
    if (!ms) return { ok: false, reason: "أضف الفيديو أولًا." };
    const sec = videoSfxSeconds(ms);
    const lines: { label: string; centi: number }[] = [];
    for (const st of stems) {
      const per = table[STEM_KEY[st]];
      if (per == null) return { ok: false, reason: `سعر «${STEM_LABEL[st]}» لم يُحدد بعد.` };
      lines.push({ label: `${STEM_LABEL[st]} · ${sec} ث`, centi: sec * per });
    }
    return total(lines, smartSplit.costUsd(d, splitMode));
  },
  costUsd(d) {
    const sec = videoMsOf(d.refs) / 1000;
    const s = d.settings;
    return (
      (needsFrames(s) ? SPLIT_CLAUDE_USD : 0) +
      (s.dialogue ? (sec * ELEVEN_PRICE.isolatorPerMin) / 60 : 0) +
      (s.music ? (Math.max(sec, VIDEO_SFX.musicMinMs / 1000) * ELEVEN_PRICE.musicPerMin) / 60 : 0) +
      (s.sfx ? ((sec + VIDEO_SFX.eventsTotalSec) * ELEVEN_PRICE.sfxPerMin) / 60 : 0)
    );
  },
  sources: [
    ...elSources([
      { label: "ElevenLabs — Audio isolation (POST /v1/audio-isolation)", url: "https://elevenlabs.io/docs/api-reference/audio-isolation/convert" },
      { label: "ElevenLabs — Voice isolator (accepts video: MP4, MOV…; up to 500MB and 1 hour)", url: "https://elevenlabs.io/docs/capabilities/voice-isolator" },
      { label: "ElevenLabs — Compose music (composition_plan, respect_sections_durations, output_format pcm_*)", url: "https://elevenlabs.io/docs/api-reference/music/compose" },
      { label: "ElevenLabs — Composition plans (chunks of 3–120 s, styles)", url: "https://elevenlabs.io/docs/eleven-api/guides/how-to/music/composition-plans" },
      { label: "ElevenLabs — Create sound effect (duration_seconds, loop, output_format pcm_*)", url: "https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert" },
    ]),
    { label: "Claude — Vision (images in a message)", url: "https://platform.claude.com/docs/en/build-with-claude/vision", checked: EL_CHECKED },
    { label: "Claude — Structured outputs (JSON schema)", url: "https://platform.claude.com/docs/en/build-with-claude/structured-outputs", checked: EL_CHECKED },
  ],
  verification: [
    { item: "الحوار", status: "verified", note: `يُرسل الفيديو نفسه إلى POST /v1/audio-isolation (يقبل MP4 وMOV حتى 500MB وساعة)؛ $${ELEVEN_PRICE.isolatorPerMin} للدقيقة. نرفض الفيديو الذي بلا مسار صوت قبل أي خصم.` },
    { item: "صيغة الحوار", status: "unverified", note: "صيغة الناتج غير موثّقة؛ نقرأ الملف كما وصل (MP3 أو WAV أو OGG) ونحفظه بصيغته." },
    { item: "الموسيقى", status: "verified", note: "يشاهد Claude الفيديو ويقسم الموسيقى أقسامًا تتبع مشاهده (3 ثوانٍ على الأقل لكل قسم)؛ تُرسل composition_plan إلى Eleven Music (music_v2_5) مع respect_sections_durations، ويُقص الناتج على طول الفيديو." },
    { item: "بلا غناء", status: "unverified", note: "force_instrumental لا يُستعمل مع الخطة؛ نطلب الآلات فقط بالأنماط (instrumental) ونمنع الغناء بالأنماط السالبة." },
    { item: "المؤثرات", status: "verified", note: `Claude يرى حتى ${VIDEO_SFX.framesMax} لقطة بوقت كل منها ويرجع حتى ${VIDEO_SFX.eventsMax} مؤثرًا بلحظته ومدته وارتفاعه + صوت خلفية؛ يُصنع كل واحد بمدة محددة ويُركّب على طول الفيديو.` },
    { item: "صيغة التركيب", status: "unverified", note: "نطلب pcm_48000 للموسيقى والمؤثرات (الوثيقة تقصر pcm_44100 وحدها على خطة Pro)، وإن رفضها الحساب نكمل بـ pcm_24000. الناتج WAV أحادي 48kHz." },
  ],
  notes: [],
};

function total(lines: { label: string; centi: number }[], usd: number | null): PriceResult {
  const centi = lines.reduce((s, l) => s + l.centi, 0);
  return { ok: true, coins: coinsOf(centi), lines, usdCeiling: usd };
}


// ───────────────────────────── MiniMax · Speech 2.8 (through fal.ai) ─────────────────────────────
// Checked on 2026-10-07 against fal's OpenAPI schema for fal-ai/minimax/speech-2.8-hd and the voice-clone page.

/** A MiniMax voice: one of its ready voices («x:<id>») or one copied into the person's library («v:<uuid>»). */
export const MINIMAX_VOICE = /^(x:[A-Za-z0-9_-]{2,64}|v:[0-9a-f-]{36})$/;
export const MINIMAX_DEFAULT_VOICE = "x:Deep_Voice_Man";
/** fal's published prices: $100 per million characters (HD); a copied voice $1.5 once. */
export const MINIMAX_PRICE = { hdPerKChars: 0.1, cloneUsd: 1.5 };
export const MINIMAX_CLONE_KEY = "voice:clone";
export const MINIMAX_DESIGN_KEY = "voice:design";
/** fal: $3 per designed voice + $0.03 per 1,000 preview characters (a preview of ≤ 500). */
export const MINIMAX_DESIGN_USD = 3 + (500 / 1000) * 0.03;

const mmMode: ModeDef = { id: "text_to_speech", label: "نص إلى كلام", refStyle: "none", refs: {}, promptRequired: true };
const minimaxSpeech: GeneratorDef = {
  id: "minimax-speech-2-8",
  name: "MiniMax Speech 2.8",
  output: "audio",
  defaultSection: "audio",
  provider: { id: "minimax", label: "MiniMax (fal.ai)" },
  model: { id: "speech-2.8-hd", family: "MiniMax Speech 2.8", version: "hd" },
  api: { name: "fal.ai queue · fal-ai/minimax/speech-2.8-hd", endpoint: "POST https://queue.fal.run/fal-ai/minimax/speech-2.8-hd", tracking: "async", progress: "none", cancel: "none" },
  modes: [mmMode],
  options: [
    { key: "voice", label: "الصوت", kind: "choice", ltr: true, default: MINIMAX_DEFAULT_VOICE, values: [{ value: MINIMAX_DEFAULT_VOICE, label: "Deep Voice Man" }], accepts: MINIMAX_VOICE, picker: "voice" },
    {
      key: "emotion", label: "الشعور", kind: "choice", default: "auto",
      values: [
        { value: "auto", label: "تلقائي" },
        { value: "happy", label: "سعيد" },
        { value: "sad", label: "حزين" },
        { value: "angry", label: "غاضب" },
        { value: "fearful", label: "خائف" },
        { value: "surprised", label: "متفاجئ" },
        { value: "disgusted", label: "مشمئز" },
        { value: "neutral", label: "محايد" },
      ],
    },
    {
      key: "speed", label: "السرعة", kind: "choice", default: "1",
      values: [
        { value: "0.8", label: "أبطأ" },
        { value: "1", label: "عادية" },
        { value: "1.2", label: "أسرع" },
      ],
    },
  ],
  files: {},
  prompt: { label: "النص المنطوق", placeholder: "اكتب الكلام كما سيُنطق… للوقفة اكتب <#1#> (ثانية)، وللضحك (laughs).", max: 5000, arabic: true },
  priceKeys: [
    { key: "chars:1k", label: "كل ١٠٠٠ حرف", defaultCenti: centiFor(MINIMAX_PRICE.hdPerKChars), basis: `سعر fal المنشور لـ Speech 2.8 HD: $${MINIMAX_PRICE.hdPerKChars} لكل ١٠٠٠ حرف` },
    { key: MINIMAX_CLONE_KEY, label: "نسخ صوت من تسجيل (للمرة)", defaultCenti: centiFor(MINIMAX_PRICE.cloneUsd), basis: `سعر fal المنشور: $${MINIMAX_PRICE.cloneUsd} لكل صوت منسوخ (بلا حد لعدد الأصوات)` },
    { key: MINIMAX_DESIGN_KEY, label: "تصميم صوت بالوصف (صوت واحد)", defaultCenti: centiFor(MINIMAX_DESIGN_USD), basis: "سعر fal المنشور: $3 لكل صوت مصمّم + $0.03 لكل ١٠٠٠ حرف من العينة (بلا حد لعدد الأصوات)" },
  ],
  modeFor: () => mmMode,
  rules: () => ({ options: opt(minimaxSpeech.options), issues: [], notes: ["يتكلم ٤٠ لغة منها العربية (language_boost: Arabic). الأصوات المنسوخة هنا بلا حد في العدد، على عكس ElevenLabs."] }),
  price(d, _mode, table) {
    const per = table["chars:1k"];
    if (per == null) return { ok: false, reason: "سعر الكلام لم يُحدد بعد." };
    const k = Math.max(1, Math.ceil(d.prompt.length / 1000));
    return total([{ label: `${k} × ١٠٠٠ حرف`, centi: k * per }], minimaxSpeech.costUsd(d, mmMode));
  },
  costUsd: (d) => (Math.max(1, d.prompt.length) / 1000) * MINIMAX_PRICE.hdPerKChars,
  sources: [
    { label: "fal.ai — MiniMax Speech 2.8 HD (schema: prompt, voice_setting, language_boost, output_format)", url: "https://fal.ai/models/fal-ai/minimax/speech-2.8-hd/api", checked: "2026-10-07" },
    { label: "fal.ai — MiniMax Voice Cloning ($1.5 per clone; audio ≥ 10 s; kept when used within 7 days)", url: "https://fal.ai/models/fal-ai/minimax/voice-clone", checked: "2026-10-07" },
    { label: "fal.ai — MiniMax Voice Design ($3 per voice; prompt + preview_text ≤ 500; returns custom_voice_id)", url: "https://fal.ai/models/fal-ai/minimax/voice-design", checked: "2026-10-07" },
    { label: "MiniMax — pay-as-you-go pricing (speech-2.8-hd $100/M chars, rapid clone $1.5)", url: "https://platform.minimax.io/docs/guides/pricing-paygo", checked: "2026-10-07" },
  ],
  verification: [
    { item: "النموذج", status: "verified", note: "speech-2.8-hd عبر fal.ai؛ النص حتى 5,000 حرف." },
    { item: "الأصوات", status: "verified", note: "أصوات MiniMax الجاهزة (قائمة ثابتة)، أو صوت منسوخ من تسجيل ١٠ ثوانٍ فأكثر محفوظ في مكتبة الشخص." },
    { item: "خانات الأصوات", status: "unverified", note: "لا حد منشور لعدد الأصوات المنسوخة في حساب MiniMax؛ الصوت يُحذف إن لم يُستخدم خلال ٧ أيام من نسخه (نستخدمه فور النسخ)." },
    { item: "العربية", status: "unverified", note: "مدعومة ضمن ٤٠ لغة (language_boost: Arabic)؛ جودتها تُجرَّب بالأذن." },
    { item: "السعر", status: "verified", note: `$${MINIMAX_PRICE.hdPerKChars} لكل ١٠٠٠ حرف، و$${MINIMAX_PRICE.cloneUsd} للصوت المنسوخ.` },
  ],
  notes: ["يجب إخبار المستمع أن الصوت مولّد بالذكاء الاصطناعي.", "لا يُنسخ صوت شخص إلا بإذنه."],
};

// ───────── «صوت الجواد»: the site's own voice engine (open models, Arabic, free voiceprints) ─────────

export const JAWAD_VOICE_ID = "jawad-voice";
/** A library voice only: the engine speaks from the person's own reference recording (no ready voices). */
export const JAWAD_VOICE = /^v:[0-9a-f-]{36}$/;
export const JAWAD_CLONE_KEY = "voice:clone";
/** Chatterbox on fal: $0.025 per 1,000 characters; Habibi on our own endpoint about $0.02 (an L4 at ~$1/h). */
export const JAWAD_VOICE_PRICE = { chatterboxPerKChars: 0.025, habibiPerKChars: 0.02, cloneUsd: 0.02 };
const jvMode: ModeDef = { id: "text_to_speech", label: "نص إلى كلام", refStyle: "none", refs: {}, promptRequired: true };
const jawadVoice: GeneratorDef = {
  id: JAWAD_VOICE_ID,
  name: "صوت الجواد",
  output: "audio",
  defaultSection: "audio",
  provider: { id: "jawad", label: "محرك الجواد (حبيبي · Chatterbox)" },
  model: { id: "habibi-unified", family: "Habibi-TTS / Chatterbox Multilingual", version: "2026-01" },
  api: { name: "HABIBI_URL (Hugging Face endpoint, voice-engine/habibi) · fal.ai queue · fal-ai/chatterbox/text-to-speech/multilingual", endpoint: "POST HABIBI_URL · POST https://queue.fal.run/fal-ai/chatterbox/text-to-speech/multilingual", tracking: "async", progress: "none", cancel: "none" },
  modes: [jvMode],
  options: [
    { key: "voice", label: "الصوت", kind: "choice", ltr: true, default: "", values: [], accepts: JAWAD_VOICE, picker: "voice" },
    {
      key: "engine", label: "المحرك", kind: "choice", default: "auto",
      values: [
        { value: "auto", label: "تلقائي", hint: "حبيبي إن كان مفعّلًا، وإلا Chatterbox" },
        { value: "habibi", label: "حبيبي (عربي)", hint: "مصنوع للعربية ولهجاتها" },
        { value: "chatterbox", label: "Chatterbox", hint: "٢٣ لغة منها العربية" },
      ],
    },
    {
      key: "dialect", label: "اللهجة (حبيبي)", kind: "choice", default: "UNK",
      values: [
        { value: "UNK", label: "من العينة" },
        { value: "MSA", label: "فصحى" },
        { value: "SAU", label: "سعودي" },
        { value: "UAE", label: "إماراتي" },
        { value: "IRQ", label: "عراقي" },
        { value: "EGY", label: "مصري" },
        { value: "LEV", label: "شامي" },
        { value: "OMN", label: "عُماني" },
        { value: "ALG", label: "جزائري" },
        { value: "MAR", label: "مغربي" },
        { value: "TUN", label: "تونسي" },
        { value: "SDN", label: "سوداني" },
        { value: "LBY", label: "ليبي" },
      ],
    },
    { key: "speed", label: "السرعة", kind: "choice", default: "1", values: [{ value: "0.85", label: "أبطأ" }, { value: "1", label: "عادية" }, { value: "1.15", label: "أسرع" }] },
  ],
  files: {},
  prompt: { label: "النص المنطوق", placeholder: "اكتب الكلام كما سيُنطق، بالعربي (مشكّل أو بلا تشكيل)…", max: 4000, arabic: true },
  priceKeys: [
    { key: "chars:1k", label: "كل ١٠٠٠ حرف", defaultCenti: centiFor(JAWAD_VOICE_PRICE.chatterboxPerKChars), basis: `سعر fal المنشور لـ Chatterbox Multilingual: $${JAWAD_VOICE_PRICE.chatterboxPerKChars} لكل ١٠٠٠ حرف؛ حبيبي على خادمنا نحو $${JAWAD_VOICE_PRICE.habibiPerKChars}` },
    { key: JAWAD_CLONE_KEY, label: "بصمة صوت من تسجيل (للمرة)", defaultCenti: centiFor(JAWAD_VOICE_PRICE.cloneUsd), basis: "لا نسخ عند مزوّد: التسجيل يُحفظ في مكتبتك ويُكتب ما قيل فيه مرة واحدة (كلفة الكتابة فقط)" },
  ],
  modeFor: () => jvMode,
  rules(d) {
    const notes = ["محرك الموقع نفسه: صوتك من تسجيل ١٠ ثوانٍ فأكثر، بلا حد لعدد الأصوات وبلا رسوم نسخ. يتكلم العربية بلهجاتها (حبيبي) أو ٢٣ لغة (Chatterbox)."];
    if (!d.settings.voice) notes.unshift("خذ بصمة صوتك أولًا (🎙️ بصمة صوتك) ثم اختره هنا؛ هذا المحرك يتكلم بأصوات مكتبتك فقط.");
    return { options: opt(jawadVoice.options), issues: [], notes };
  },
  price(d, _mode, table) {
    const per = table["chars:1k"];
    if (per == null) return { ok: false, reason: "سعر الكلام لم يُحدد بعد." };
    const k = Math.max(1, Math.ceil(d.prompt.length / 1000));
    return total([{ label: `${k} × ١٠٠٠ حرف`, centi: k * per }], jawadVoice.costUsd(d, jvMode));
  },
  costUsd: (d) => (Math.max(1, d.prompt.length) / 1000) * JAWAD_VOICE_PRICE.chatterboxPerKChars,
  sources: [
    { label: "Habibi-TTS — unified dialectal Arabic TTS (SJTU X-LANCE, Jan 2026): paper", url: "https://arxiv.org/abs/2601.13802", checked: "2026-10-08" },
    { label: "Habibi-TTS — models and licences on Hugging Face (MSA/EGY/IRQ/ALG/MAR: Apache 2.0; Unified/SAU/UAE: CC-BY-NC-SA)", url: "https://huggingface.co/SWivid/Habibi-TTS", checked: "2026-10-08" },
    { label: "Habibi-TTS — code (MIT) and CLI", url: "https://github.com/SWivid/Habibi-TTS", checked: "2026-10-08" },
    { label: "fal.ai — Chatterbox Multilingual (text ≤ 300 chars, voice = reference audio URL, custom_audio_language: arabic; $0.025 / 1k chars)", url: "https://fal.ai/models/fal-ai/chatterbox/text-to-speech/multilingual/api", checked: "2026-10-08" },
    { label: "Resemble AI — Chatterbox (MIT), 23 languages incl. Arabic, 10-second zero-shot cloning", url: "https://github.com/resemble-ai/chatterbox", checked: "2026-10-08" },
  ],
  verification: [
    { item: "حبيبي", status: "unverified", note: "يعمل عندما يُضبط HABIBI_URL (نقطة Hugging Face من voice-engine/habibi) وHABIBI_TOKEN؛ بدونهما يتكلم Chatterbox عبر fal." },
    { item: "الرخص", status: "verified", note: "نماذج حبيبي للفصحى والمصري والعراقي والجزائري والمغربي Apache 2.0 (تجاري)؛ الموحّد والسعودي والإماراتي CC-BY-NC-SA (غير تجاري) — قرار استخدامها للمالك." },
    { item: "العربية", status: "unverified", note: "جودة اللهجات تُجرَّب بالأذن؛ أصحاب حبيبي يقولون إنه ينافس Eleven v3." },
    { item: "السعر", status: "verified", note: `Chatterbox $${JAWAD_VOICE_PRICE.chatterboxPerKChars} لكل ١٠٠٠ حرف (fal)؛ حبيبي بسعر ساعة الخادم.` },
  ],
  notes: ["يجب إخبار المستمع أن الصوت مولّد بالذكاء الاصطناعي.", "لا تُؤخذ بصمة صوت شخص إلا بإذنه."],
};

export const GENERATORS: GeneratorDef[] = [gptImage2, seedance("2.5"), seedance("2.0"), miniTts, elevenV4, minimaxSpeech, jawadVoice, elevenSfx, elevenMusic, smartSplit];
export const generatorById = (id: string) => GENERATORS.find((g) => g.id === id);

/** The settings a generator starts with. */
export const defaultSettings = (g: GeneratorDef): Settings => Object.fromEntries(g.options.map((o) => [o.key, o.default]));

export type { RefMeta };
