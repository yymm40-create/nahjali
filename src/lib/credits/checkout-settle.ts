// The return and the webhook of «صفحة الدفع» (src/lib/credits/checkout.ts): the payment is READ from Moyasar by its id, and its
// metadata says which purchase it is for; that purchase checks it against its own record. Server only.

import { settleCourseFormPayment } from "@/lib/course/orders";
import { settleOffer10Payment } from "@/lib/jawad/server/offer10";
import { COURSE } from "@config/course";
import { OFFER10 } from "@config/jawad/offer10";
import { CHECKOUT_KINDS, landing, type CheckoutKind } from "./checkout";
import { getPayment, moyasarEnabled } from "./moyasar";
import { settleCreditFormPayment } from "./orders";

const kindOf = (v: unknown): CheckoutKind | "" => (CHECKOUT_KINDS.includes(v as CheckoutKind) ? (v as CheckoutKind) : "");

/** Settles the purchase behind this payment (once, however many times it runs) and says where the buyer goes. */
export async function settleFormPayment(paymentId: string, hint = ""): Promise<{ kind: CheckoutKind | ""; paid: boolean; to: string }> {
  const id = paymentId.trim().slice(0, 80);
  const fallback = kindOf(hint);
  const paths = { coursePath: COURSE.base, offerPath: OFFER10.path };
  const unpaid = { kind: fallback, paid: false, to: landing(fallback, false, { ...paths, paymentId: fallback === "pay" ? id : undefined }) };
  if (!moyasarEnabled() || !/^[0-9a-f-]{36}$/i.test(id)) return unpaid;
  const p = await getPayment(id).catch((e) => {
    console.error("checkout getPayment", id, e);
    return null;
  });
  if (!p || p.id !== id) return unpaid;
  const kind = kindOf(p.metadata.kind) || fallback;
  const ref = p.metadata.ref ?? "";
  switch (kind) {
    case "credits": {
      const r = await settleCreditFormPayment(ref, p);
      return { kind, paid: !!r?.paid, to: landing(kind, !!r?.paid, { ...paths, ref: r?.order.id }) };
    }
    case "course": {
      const r = await settleCourseFormPayment(ref, p);
      return { kind, paid: !!r?.paid, to: landing(kind, !!r?.paid, { ...paths, courseId: r?.order.courseId ?? undefined }) };
    }
    case "offer10": {
      const paid = await settleOffer10Payment(ref, p);
      return { kind, paid, to: landing(kind, paid, paths) };
    }
    case "pay":
      // a plain payment to JAWAD AI: nothing to add; the done page reads the payment again and shows it
      return { kind, paid: p.status === "paid", to: landing(kind, p.status === "paid", { paymentId: id }) };
    default:
      return unpaid;
  }
}
