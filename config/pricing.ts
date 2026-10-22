// Price, attempts and safety limits. Edit freely.

export type QualityKey = "low" | "medium" | "high";

/**
 * Quality tiers the customer chooses from. `price_halalas` is the booklet price (29 SAR = 2900);
 * the key is passed to OpenAI as the image quality.
 */
export const QUALITY_TIERS: Record<QualityKey, { label: string; description: string; price_halalas: number; available: boolean }> = {
  low: { label: "جودة أساسية", description: "سريعة ومناسبة للمعاينة والطباعة الصغيرة", price_halalas: 1900, available: false },
  medium: { label: "جودة متوسطة", description: "تفاصيل أوضح وألوان أجمل", price_halalas: 2900, available: true },
  high: { label: "جودة عالية", description: "أعلى دقة وتفاصيل، الأفضل للطباعة", price_halalas: 3900, available: false },
};

export const DEFAULT_QUALITY: QualityKey = "medium";

/**
 * Free trial mode: no payment step, orders are free and the UI says "جرّب مجانًا".
 * Each account can make at most FREE_TRIAL_MAX_ORDERS free orders in total; those «السماح» lets into the booklet have no limit.
 */
export const FREE_TRIAL = true;
export const FREE_TRIAL_MAX_ORDERS = 1;

/** How many times a customer may generate their base character. */
export const ATTEMPTS_ALLOWED = 3;

/** Extra tries per pose after the first one fails (spec: max twice). */
export const POSE_MAX_RETRIES = 2;

/**
 * Temporary "test payment" button used until Moyasar is connected (only when FREE_TRIAL is false).
 * It ONLY works when this is true AND the app is not running in production,
 * so it can never be used to skip payment on the live site.
 */
export const DEV_PAYMENT_ENABLED = true;

/**
 * Email (magic link) sign-in next to Google's, on both sign-in pages. On: Google's sign-in often breaks inside the Instagram /
 * TikTok / Snapchat in-app browsers, and the link needs nothing beyond the Supabase keys in .env.example (Cloudflare's Turnstile
 * check is optional: it shows only when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set).
 */
export const EMAIL_LOGIN_ENABLED = true;

/** Generation rate limit per user. */
export const RATE_LIMIT = { maxRequests: 30, windowMinutes: 10 };

/**
 * Rough cost estimate per generated image in USD, used for generation_logs.
 * Source: public gpt-image-2 pricing (1024x1536) as of Sep 2026, plus ~0.01 for the reference image input.
 * Update if OpenAI changes prices.
 */
export const ESTIMATED_COST_USD: Record<QualityKey, number> = {
  low: 0.015,
  medium: 0.05,
  high: 0.175,
};

export const isQuality = (q: unknown): q is QualityKey => typeof q === "string" && q in QUALITY_TIERS;

/**
 * The bank-transfer way of paying on «اشحن رصيدك» (the bank data, «تم التحويل», the owner's confirm). On for everyone while card payment is being
 * tested; set to false to hide it once the card works.
 */
export const BANK_TRANSFER_ENABLED = true;

/**
 * Card payment (Paylink) for EVERYONE. While false, only the owners see the card button (to test it with the Paylink keys) and
 * everyone else sees «الدفع بالبطاقة يتفعّل قريبًا إن شاء الله» and pays by bank transfer; the server refuses card payment to
 * anyone else too. Set to true once a test payment went through.
 */
export const CARD_PAYMENT_PUBLIC = false;
