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

/** Packages shown on /coins (buying is enabled once payments are connected). */
export const COIN_PACKAGES = [
  { key: "try", name: "تجربة", priceSar: 10, coins: 40, note: "تكفي فيديو قصير" },
  { key: "starter", name: "البداية", priceSar: 49, coins: 200, note: "" },
  { key: "creator", name: "المبدع", priceSar: 119, coins: 520, note: "٤٪ زيادة", popular: true },
  { key: "studio", name: "الاستوديو", priceSar: 239, coins: 1100, note: "١٥٪ زيادة" },
] as const;
