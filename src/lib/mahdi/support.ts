// «ادعم التطبيق» (/mahdi/support): a member asked «اريد زر لدعم تطبيق المهدي او طريقه ادعم هذا التطبيق بما استطيع». It reuses the
// site's free-amount payment link (/api/pay, src/lib/pay-link.ts) with `for: "mahdi"`: the payment line says «دعم لأجل المهدي», its
// metadata ref is "mahdi", and the payer comes back to the app's own thank-you page. Nothing is added to any balance.

/** The support page in the app. */
export const SUPPORT_PATH = "/mahdi/support";
/** Where the payer lands after paying (it reads the payment from Moyasar again). */
export const SUPPORT_DONE_PATH = "/mahdi/support/done";
/** The `for` of /api/pay and the payment's metadata ref. */
export const SUPPORT_REF = "mahdi";
/** The quick amounts (riyals). */
export const SUPPORT_AMOUNTS = [10, 25, 50, 100] as const;
/** The amount the page opens on. */
export const SUPPORT_DEFAULT = 25;
/** The line on the payment (Moyasar's dashboard and the checkout page). */
export const supportLine = (note: string) => `دعم لأجل المهدي${note ? ` — ${note}` : ""}`;
