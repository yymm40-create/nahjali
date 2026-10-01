// Price, attempts and safety limits. Edit freely.

export type QualityKey = "low" | "medium" | "high";

/**
 * Quality tiers the customer chooses from. `price_halalas` is the booklet price (29 SAR = 2900);
 * the key is passed to OpenAI as the image quality.
 */
export const QUALITY_TIERS: Record<QualityKey, { label: string; description: string; price_halalas: number }> = {
  low: { label: "جودة أساسية", description: "سريعة ومناسبة للمعاينة والطباعة الصغيرة", price_halalas: 1900 },
  medium: { label: "جودة متوسطة", description: "تفاصيل أوضح وألوان أجمل", price_halalas: 2900 },
  high: { label: "جودة عالية", description: "أعلى دقة وتفاصيل، الأفضل للطباعة", price_halalas: 3900 },
};

export const DEFAULT_QUALITY: QualityKey = "medium";

/**
 * Free trial mode: no payment step, orders are free and the UI says "جرّب مجانًا".
 * Each account can make at most FREE_TRIAL_MAX_ORDERS free orders (image generation costs real money).
 */
export const FREE_TRIAL = true;
export const FREE_TRIAL_MAX_ORDERS = 2;

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
 * Temporary email (magic link) sign-in, for testing before Google sign-in is set up.
 * Turn off once Google works.
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
