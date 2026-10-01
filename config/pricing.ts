// Price, attempts and safety limits. Edit freely.

/** Booklet price in halalas (29 SAR = 2900). */
export const PRICE_HALALAS = 2900;

/** How many times a customer may generate their base character. */
export const ATTEMPTS_ALLOWED = 3;

/** Extra tries per pose after the first one fails (spec: max twice). */
export const POSE_MAX_RETRIES = 2;

/**
 * Temporary "test payment" button used until Moyasar is connected.
 * It ONLY works when this is true AND the app is not running in production,
 * so it can never be used to skip payment on the live site.
 */
export const DEV_PAYMENT_ENABLED = true;

/** Generation rate limit per user. */
export const RATE_LIMIT = { maxRequests: 30, windowMinutes: 10 };

/**
 * Rough cost estimate per generated image in USD, used for generation_logs.
 * Source: public gpt-image-2 pricing (1024x1536) as of Sep 2026, plus ~0.01 for the reference image input.
 * Update if OpenAI changes prices.
 */
export const ESTIMATED_COST_USD: Record<string, number> = {
  low: 0.015,
  medium: 0.05,
  high: 0.175,
};
