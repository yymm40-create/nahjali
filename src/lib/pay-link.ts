// «ادفع بالمبلغ اللي تبيه» (/jawad-ai/pay): a public payment link at any amount the payer types (default 100 SAR), paid on
// Moyasar's own invoice page. It is a plain payment to JAWAD AI (a client paying for a service), NOT a balance top-up.

/** The amount the page opens on when the link carries none. */
export const PAY_DEFAULT = 100;
/** Moyasar takes at least 1 SAR (100 halalas). */
export const PAY_MIN = 1;
/** A ceiling so a typo does not open a giant invoice. */
export const PAY_MAX = 100_000;

const ARABIC = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN = "۰۱۲۳۴۵۶۷۸۹";

/**
 * What the payer typed → riyals with at most two decimals, or null when it is not a usable amount.
 * Takes Arabic and Persian digits, «٫» or «,» as the decimal point, and spaces or thousands separators.
 */
export function parseAmount(input: unknown): number | null {
  if (typeof input === "number") return valid(input);
  if (typeof input !== "string") return null;
  let s = input.trim();
  for (let i = 0; i < 10; i++) s = s.replaceAll(ARABIC[i], String(i)).replaceAll(PERSIAN[i], String(i));
  s = s.replace(/[\s٬’']/g, "").replace(/ريال|ر\.س|sar|﷼/gi, "");
  // «1,250» is a thousands comma; «12,5» or «12٫5» is a decimal point
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");
  s = s.replace(/[٫,]/g, ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return valid(Number(s));
}

function valid(n: number): number | null {
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n * 100) / 100;
  if (r < PAY_MIN || r > PAY_MAX) return null;
  return r;
}

/** «100» or «12.50» for the button and the invoice. */
export const amountLabel = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

/** A note the payer may add (who they are / what it is for), kept short and on one line for the invoice description. */
export function cleanNote(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, 80);
}
