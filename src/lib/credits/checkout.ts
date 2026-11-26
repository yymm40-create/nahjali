// «صفحة الدفع» (/jawad-ai/checkout): Moyasar's own card form (Moyasar.js, the Payments API) inside our site, in place of Moyasar's
// hosted invoice page — Moyasar enables GCC cards only for a direct API integration (ticket 127941, November 2026). Server only.
//
// Every purchase (the balance, a course, the offer, the free-amount link) makes its order as before and sends the buyer here with a
// signed ticket: what it is for (`k` + `ref`), the amount in halalas, the line shown, and where «رجوع» goes. The form puts `kind` and
// `ref` on the payment's metadata. When Moyasar sends the buyer back (/api/checkout/return?id=…) or POSTs its webhook, the payment is
// READ from Moyasar and settled by its metadata — each purchase checks status, currency and the amount against ITS OWN record, so
// nothing in the URL, the ticket or the body is trusted, and one payment can only ever open the order it was made for.
//   NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY — pk_live_… (or pk_test_…) from the Moyasar dashboard; without it the old invoice page stays.
//   Apple Pay shows by default: www.aljawadai.app is registered in Moyasar's «نطاقات Apple Pay» (4 November 2026) and the site serves
//   /.well-known/apple-developer-merchantid-domain-association. NEXT_PUBLIC_MOYASAR_APPLE_PAY=0 hides it.

import { createHmac, timingSafeEqual } from "node:crypto";
import { moyasarEnabled, type Payment } from "./moyasar";

export type CheckoutKind = "credits" | "course" | "offer10" | "unlim" | "pay";
export const CHECKOUT_KINDS: readonly CheckoutKind[] = ["credits", "course", "offer10", "unlim", "pay"];

export interface Ticket {
  k: CheckoutKind;
  /** the order id (credits, course), the account id (offer10), «account|pass|hours» («لامحدود»), "" (pay) */
  ref: string;
  /** halalas */
  a: number;
  /** the line on the page and on Moyasar's payment */
  d: string;
  /** a path on our site for «رجوع» */
  back: string;
  /** expiry, ms */
  exp: number;
}

export const publishableKey = () => process.env.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY?.trim() ?? "";
/** Is the in-site form set up (the secret key to read payments, the publishable key for the form)? */
export const formEnabled = () => moyasarEnabled() && /^pk_(live|test)_/.test(publishableKey());
export const applePayOn = () => process.env.NEXT_PUBLIC_MOYASAR_APPLE_PAY?.trim() !== "0";

const secret = () => process.env.JAWAD_WEBHOOK_SECRET || createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").update("moyasar-checkout").digest("hex");
const mac = (body: string) => createHmac("sha256", secret()).update(body).digest("base64url");

/** The ticket for the page, signed (a day by default: an order's price is not kept longer). */
export function signTicket(t: Omit<Ticket, "exp">, now = Date.now(), ttlMs = 24 * 3600_000): string {
  const body = Buffer.from(JSON.stringify({ ...t, d: t.d.slice(0, 250), exp: now + ttlMs })).toString("base64url");
  return `${body}.${mac(body)}`;
}

/** The ticket back, or null when it is not ours, changed, or old. */
export function readTicket(token: unknown, now = Date.now()): Ticket | null {
  if (typeof token !== "string" || token.length > 2000) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const want = Buffer.from(mac(body));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const t = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Ticket;
    if (!CHECKOUT_KINDS.includes(t.k) || typeof t.ref !== "string" || !Number.isInteger(t.a) || t.a < 100 || typeof t.d !== "string") return null;
    if (typeof t.back !== "string" || !t.back.startsWith("/") || t.back.startsWith("//")) return null;
    if (!(t.exp > now)) return null;
    return t;
  } catch {
    return null;
  }
}

/** Our page for this purchase. */
export const checkoutUrl = (origin: string, t: Omit<Ticket, "exp">) => `${origin}/jawad-ai/checkout?t=${encodeURIComponent(signTicket(t))}`;

/** Is this payment really paid, in riyals, for exactly this many halalas, made on our form for this purchase? */
export const formPaymentPaid = (p: Payment, kind: CheckoutKind, ref: string, halalas: number) =>
  p.status === "paid" && p.currency === "SAR" && p.amount === halalas && p.metadata.kind === kind && p.metadata.ref === ref;

/** Where the buyer lands after a purchase of this kind, paid or not. */
export function landing(kind: CheckoutKind | "", paid: boolean, extra: { ref?: string; courseId?: string; paymentId?: string; coursePath?: string; offerPath?: string; unlimitedPath?: string } = {}): string {
  const flag = paid ? "paid" : "unpaid";
  switch (kind) {
    case "credits":
      return `/jawad-ai/credits?${flag}=${encodeURIComponent(extra.ref || "1")}`;
    case "course":
      return `${extra.coursePath ?? "/jawad-ai/course"}${extra.courseId ? `/${extra.courseId}` : ""}?${flag}=1`;
    case "offer10":
      return `${extra.offerPath ?? "/jawad-ai/offer"}?${flag}=1`;
    case "unlim":
      return `${extra.unlimitedPath ?? "/jawad-ai/unlimited"}?${flag}=1`;
    case "pay":
      return `/jawad-ai/pay/done${extra.paymentId ? `?id=${encodeURIComponent(extra.paymentId)}` : ""}`;
    default:
      return "/jawad-ai";
  }
}
