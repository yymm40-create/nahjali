// «النقود الذكية»: the site's credits, priced like Higgsfield's (≈ 0.25 SAR each) on our 100% markup:
// an operation that costs us $X is charged ceil(X / COIN_COST_USD) coins. Edit freely.

export const SMART_COIN = {
  name: "النقود الذكية",
  one: "نقدة ذكية",
  /** What the customer pays for one coin (SAR, before VAT). */
  priceSar: 0.25,
  /** Our markup on cost: 1 = 100% (the price is twice the cost). */
  markup: 1,
  usdToSar: 3.75,
} as const;

/** The cost to us behind one coin, in USD (0.25 SAR ÷ 2 ÷ 3.75 ≈ $0.033). */
export const COIN_COST_USD = SMART_COIN.priceSar / (1 + SMART_COIN.markup) / SMART_COIN.usdToSar;

/** Coins for an operation that costs us `usd` (never less than 1). */
export const coinsFor = (usd: number) => Math.max(1, Math.ceil(usd / COIN_COST_USD - 1e-9));

/** One-time pass (no subscription), like Higgsfield's small pass. */
export const ONE_TIME_PASS = { key: "try", name: "تجربة", priceSar: 10, coins: 40, note: "مرة وحدة، ما تتجدد · تكفي فيديو قصير" } as const;

/**
 * Monthly subscriptions. Each month's coins are added at the start of the month and expire at its end if unused.
 * Prices are on the 100% markup (our profit = 50% of the price); `topUps`: may buy extra coins (10–500 SAR).
 */
export const PLANS = [
  {
    key: "starter",
    name: "البداية",
    monthlySar: 49,
    coins: 200,
    topUps: false,
    features: ["كل أقسام صناعة الأفلام", "فيديو حتى 720p", "فيديو واحد بنفس الوقت", "تعديلين في كل مرحلة"],
  },
  {
    key: "creator",
    name: "المبدع",
    monthlySar: 119,
    coins: 520,
    topUps: true,
    popular: true,
    features: ["كل أقسام صناعة الأفلام", "فيديو حتى 1080p", "فيديوين بنفس الوقت", "«المخرج الخارق»", "شحن نقود إضافية متى ما تبي", "تعديلات أكثر في كل مرحلة"],
  },
  {
    key: "studio",
    name: "الاستوديو",
    monthlySar: 239,
    coins: 1100,
    topUps: true,
    features: ["كل مميزات المبدع", "٤ فيديوهات بنفس الوقت", "أولوية في التوليد", "شحن نقود إضافية متى ما تبي", "أعلى حدود التعديل"],
  },
] as const;
export type PlanKey = (typeof PLANS)[number]["key"];

/**
 * Yearly billing: a discount so that our monthly profit is 35% of the (discounted) price instead of 50%.
 * The cost behind a monthly price P is P / (1 + markup); the yearly monthly price is that cost / (1 − 0.35).
 */
export const YEARLY_PROFIT_SHARE = 0.35;
export function yearlyPrice(monthlySar: number) {
  const perMonth = Math.round(monthlySar / (1 + SMART_COIN.markup) / (1 - YEARLY_PROFIT_SHARE));
  return { perMonth, total: perMonth * 12, savePct: Math.round((1 - perMonth / monthlySar) * 100) };
}

/** Extra coins (subscribers of المبدع / الاستوديو): any amount in this range, at the coin's price. */
export const TOP_UP = { minSar: 10, maxSar: 500, stepSar: 5 } as const;
export const topUpCoins = (sar: number) => Math.floor(sar / SMART_COIN.priceSar);

/** Automatic top-up: when the balance falls below `belowCoins`, the chosen amount is charged to the saved card. */
export const AUTO_TOP_UP = { belowCoins: 40, amountsSar: [20, 50, 100, 200] } as const;
