// «النقود الذكية»: the site's money, counted in RIYALS. The wallet holds halalas (1 riyal = 100 halalas; whole numbers
// in the database), every price is shown in riyals, and the customer's price is built like this:
//   cost (what the provider charges us, in dollars) → riyals at the dollar rate → rounded UP to the step (half a
//   riyal) → plus our profit (the margin, rounded up to the step too). Next to it the «was» price: the same with the
//   full margin, struck through — the launch discount. The owner sets the rate, the step and both margins from
//   /admin/limits; the defaults below hold until then. Pure (pages and server alike).

import { CLAUDE_MARGIN_PCT, HAIDARA_MAX_MARGIN_PCT } from "./claude-models";

export const SMART_COIN = {
  name: "النقود الذكية",
  one: "ريال",
  /** one wallet unit, in riyals (a halala) */
  unitSar: 0.01,
} as const;

/** «نقود الفريق الذكي»: a series' own wallet in team mode (same units: halalas). */
export const TEAM_COIN = {
  name: "نقود الفريق الذكي",
  one: "ريال فريق",
} as const;

export interface Pricing {
  /** riyals per dollar */
  usdToSar: number;
  /** prices are rounded up to this (halalas): 50 = half a riyal */
  stepHalalas: number;
  /** our profit on the cost, in percent — what the customer pays now (the launch discount) */
  marginPct: number;
  /** the full margin, in percent — the struck «was» price */
  wasMarginPct: number;
  /** our profit on a GPT Image 2 PICTURE (the studio's GPT Image 2, the film's sheets, the student's pages, covers, booklets…), in percent; the other picture models take the general margin */
  imageMarginPct: number;
  /** our profit on a VIDEO someone makes (Seedance, Kling, lip-sync, upscaling…), in percent */
  videoMarginPct: number;
}

/**
 * The owner's margins (21 October 2026): GPT Image 2's pictures 30٪, videos 40٪ (Seedance, Kling…; «سيدنس الواقعي» its
 * own 10٪, config/jawad/generators.ts), Claude's own work and «حيدرا ماكس» 60٪ since 26 October 2026 (its real usage + 60٪, `claudeHalalas`),
 * everything else (the other picture models, sound, the owner's fixed fees) the general 40٪. The struck «كان» price keeps
 * the same gap above each as the general one does (+30 points).
 */
export const DEFAULT_PRICING: Pricing = { usdToSar: 3.75, stepHalalas: 50, marginPct: 40, wasMarginPct: 70, imageMarginPct: 30, videoMarginPct: 40 };

/** What a price is for: its profit follows it. "max" is «حيدرا ماكس»'s work: priced like Claude's (its real usage), at its own profit. */
export type PriceKind = "image" | "video" | "claude" | "max" | "other";
/** Claude's own work (a robot's reply, or «حيدرا ماكس»'s program): its real usage plus its profit, to the halala only. */
export const isClaudeKind = (kind: PriceKind): kind is "claude" | "max" => kind === "claude" || kind === "max";

let current: Pricing = { ...DEFAULT_PRICING };

/** The pricing in force (the server sets it from the owner's settings; the browser from what the page was given). */
export const getPricing = (): Pricing => current;
export function setPricing(p: Partial<Pricing> | null | undefined) {
  const n = { ...DEFAULT_PRICING, ...(p ?? {}) };
  current = {
    usdToSar: n.usdToSar > 0 ? n.usdToSar : DEFAULT_PRICING.usdToSar,
    stepHalalas: Number.isInteger(n.stepHalalas) && n.stepHalalas >= 1 ? n.stepHalalas : DEFAULT_PRICING.stepHalalas,
    marginPct: n.marginPct >= 0 ? n.marginPct : DEFAULT_PRICING.marginPct,
    wasMarginPct: n.wasMarginPct >= 0 ? n.wasMarginPct : DEFAULT_PRICING.wasMarginPct,
    imageMarginPct: n.imageMarginPct >= 0 ? n.imageMarginPct : DEFAULT_PRICING.imageMarginPct,
    videoMarginPct: n.videoMarginPct >= 0 ? n.videoMarginPct : DEFAULT_PRICING.videoMarginPct,
  };
}

/**
 * «أسبوع العرض» (the owner, 26 October 2026): every profit except Claude's work (the robots and «حيدرا ماكس», 60٪) is 10٪
 * until `until` — over the owner's settings too — and then the margins above come back by themselves. The struck «كان»
 * price keeps its gap above the profit in force, so during the week it shows the usual price.
 */
export const PROMO = { marginPct: 10, until: Date.parse("2026-11-02T21:00:00Z") } as const;
// the tests price at the usual margins unless one sets the clock (setPromoClock)
let promoClock = () => (typeof process !== "undefined" && process.env.VITEST ? Infinity : Date.now());
export const setPromoClock = (now: () => number) => {
  promoClock = now;
};
export const promoActive = (now = promoClock()) => now < PROMO.until;

/** The profit (percent) on a kind of price. Claude's and «حيدرا ماكس»'s are fixed by the owner (see `claudeHalalas`). */
export const marginFor = (kind: PriceKind, p = current) =>
  kind === "claude" ? CLAUDE_MARGIN_PCT : kind === "max" ? HAIDARA_MAX_MARGIN_PCT : promoActive() ? PROMO.marginPct : kind === "image" ? p.imageMarginPct : kind === "video" ? p.videoMarginPct : p.marginPct;
/** The struck «was» margin of a kind: the same gap above it as the general one. */
export const wasMarginFor = (kind: PriceKind, p = current) => marginFor(kind, p) + Math.max(0, p.wasMarginPct - p.marginPct);

/** The dollars behind one halala of cost at the default rate (the generators' default prices are in hundredths of it). */
export const COIN_COST_USD = SMART_COIN.unitSar / DEFAULT_PRICING.usdToSar;

/** A cost in dollars, in halalas (rounded up to the halala). */
export const costHalalas = (usd: number, p = current) => Math.max(0, Math.ceil(usd * p.usdToSar * 100 - 1e-9));

/** A price table's lines (the cost, in hundredths of a halala) as halalas at cost: no profit, up to the halala, at least one. */
export const costOfLines = (lines: { centi: number }[]) => Math.max(1, Math.ceil(lines.reduce((sum, l) => sum + l.centi, 0) / 100 - 1e-9));

/** Rounded UP to the step: 45 halalas → 50 (half a riyal); 110 → 150. */
export const roundUpStep = (halalas: number, p = current) => (halalas <= 0 ? 0 : Math.ceil(halalas / p.stepHalalas - 1e-9) * p.stepHalalas);

/** What the customer pays for a cost in halalas: the cost rounded up to the step, plus the profit rounded up to it. */
export function sellHalalas(cost: number, p = current, marginPct = p.marginPct) {
  if (cost <= 0) return 0;
  return roundUpStep(cost, p) + roundUpStep((cost * marginPct) / 100, p);
}

/** What the customer pays for a cost in halalas of this kind (Claude and «حيدرا ماكس»: the cost + their profit, only to the halala). */
export const sellKind = (cost: number, kind: PriceKind = "other", p = current) =>
  isClaudeKind(kind) ? (cost > 0 ? Math.max(1, Math.ceil((cost * (100 + marginFor(kind, p))) / 100 - 1e-9)) : 0) : sellHalalas(cost, p, marginFor(kind, p));

/** The struck «was» price (the full margin) for the same cost (none for Claude: its price is never discounted). */
export const wasHalalas = (cost: number, p = current, kind: PriceKind = "other") => (isClaudeKind(kind) ? sellKind(cost, kind, p) : sellHalalas(cost, p, wasMarginFor(kind, p)));

/** The customer's price, in halalas, for an operation of this kind that costs us `usd` (0 for nothing). */
export const coinsFor = (usd: number, kind: PriceKind = "other") => (isClaudeKind(kind) ? claudeHalalas(usd, current, kind) : sellHalalas(costHalalas(usd), current, marginFor(kind)));

/**
 * What a robot's conversation costs the person: Claude's real usage of the chosen model plus the platform's profit
 * (40٪; «حيدرا ماكس»'s programs 70٪) and nothing else — no rounding up to the step (that would be a bigger profit on a
 * small reply), only to the halala.
 */
export function claudeHalalas(usd: number, p = current, kind: "claude" | "max" = "claude"): number {
  if (!(usd > 0)) return 0;
  return Math.max(1, Math.ceil((usd * p.usdToSar * 100 * (100 + marginFor(kind, p))) / 100 - 1e-9));
}

/** Halalas as riyals in text: 250 → «2.50», 1000 → «10». */
export function fmtSar(halalas: number | null | undefined): string {
  const n = Math.round(Number(halalas) || 0) / 100;
  return Number.isInteger(n) ? n.toLocaleString("en") : n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * A price inside a sentence: «¤2.50». No currency WORD ever follows a price on the site — the coin's logo stands for it —
 * and a sentence is plain text, so the pages that show it swap «¤2.50» for the logo and the amount (components/Coined.tsx).
 */
export const COIN_MARK = "¤";
export const coinStr = (halalas: number | null | undefined) => `${COIN_MARK}${fmtSar(halalas)}`;

/** The saving the «was» price shows (percent, rounded). */
export const savingPct = (price: number, was: number) => (was > price && was > 0 ? Math.round((1 - price / was) * 100) : 0);

/** One-time pass (no subscription). */
export const ONE_TIME_PASS = { key: "try", name: "تجربة", priceSar: 10, coins: 1000, note: "مرة وحدة، ما تتجدد · رصيد ١٠ ريال" } as const;

/**
 * Monthly subscriptions: the month's credit (in halalas) equals the price, added at the start of the month and
 * expiring at its end if unused. The profit is inside every price (the margin), not in the plan.
 */
export const PLANS = [
  {
    key: "starter",
    name: "البداية",
    monthlySar: 49,
    coins: 4900,
    topUps: false,
    features: ["كل أقسام صناعة الأفلام", "فيديو حتى 720p", "فيديو واحد بنفس الوقت", "تعديلين في كل مرحلة"],
  },
  {
    key: "creator",
    name: "المبدع",
    monthlySar: 119,
    coins: 11900,
    topUps: true,
    popular: true,
    features: ["كل أقسام صناعة الأفلام", "فيديو حتى 1080p", "فيديوين بنفس الوقت", "«المخرج الخارق»", "شحن رصيد إضافي متى ما تبي", "تعديلات أكثر في كل مرحلة"],
  },
  {
    key: "studio",
    name: "الاستوديو",
    monthlySar: 239,
    coins: 23900,
    topUps: true,
    features: ["كل مميزات المبدع", "٤ فيديوهات بنفس الوقت", "أولوية في التوليد", "شحن رصيد إضافي متى ما تبي", "أعلى حدود التعديل"],
  },
] as const;
export type PlanKey = (typeof PLANS)[number]["key"];

/**
 * «المكتبة»: an add-on on its own (with or without a plan). It opens the person's library in JAWAD AI: their own voices
 * (designed from a description, or their very voice from a recording), characters and places as pictures (made from a
 * description, or from their own picture), each mentioned by «@name» in any prompt. Making things still costs like any
 * generation; the add-on is what keeps them. The owner always has it.
 */
export const LIBRARY_ADDON = {
  key: "library",
  name: "المكتبة",
  monthlySar: 50,
  features: [
    "صمّم صوتك الخاص من الوصف، أو احفظ بصمة صوتك أنت من تسجيل",
    "احفظ شخصياتك وأماكنك كصور: تصنعها من الوصف أو من صورة عندك",
    "منشن أي واحد منها بـ «@اسمه» في البرومبت مباشرة",
    "تستخدمها في الصور والفيديو والكلام وصانع الأفلام",
  ],
} as const;

/** Yearly billing: two months free. */
export function yearlyPrice(monthlySar: number) {
  const total = monthlySar * 10;
  const perMonth = Math.round(total / 12);
  return { perMonth, total, savePct: Math.round((1 - perMonth / monthlySar) * 100) };
}

/** Extra credit (subscribers of المبدع / الاستوديو): any amount in this range, riyal for riyal. */
export const TOP_UP = { minSar: 10, maxSar: 500, stepSar: 5 } as const;
export const topUpCoins = (sar: number) => Math.round(sar * 100);

/** Automatic top-up: when the balance falls below `belowCoins` (halalas), the chosen amount is charged to the saved card. */
export const AUTO_TOP_UP = { belowCoins: 1000, amountsSar: [20, 50, 100, 200] } as const;
