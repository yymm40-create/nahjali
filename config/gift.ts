// «هدية التسجيل» — the launch night's offer (the owner's words): every e-mail that signs in gets 6 riyals of free balance,
// once only, until 6 in the morning (Saudi time). Pure (page and server alike).

export const SIGNUP_GIFT = {
  /** what lands in the wallet (halalas) */
  halalas: 600,
  /** the offer ends (Saudi time) */
  until: "2026-10-11T06:00:00+03:00",
  label: "🎁 هدية التسجيل",
} as const;

/** Is the offer still on? */
export const giftOpen = (now = Date.now()) => now < new Date(SIGNUP_GIFT.until).getTime();
