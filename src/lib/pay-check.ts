// Server only: what Moyasar really says about a free-amount payment (never what the URL says), for the done pages of
// «ادفع بالمبلغ اللي تبيه» (/jawad-ai/pay/done) and «ادعم التطبيق» (/mahdi/support/done).

import { getInvoice, getPayment, moyasarEnabled } from "@/lib/credits/moyasar";

/** Paid and how much (riyals), or not paid. `id` is a payment (the form) or an invoice id; `invoiceId` the invoice page's. */
export async function checkPayment(id: string, invoiceId: string): Promise<{ paid: boolean; amount: number | null }> {
  if (!moyasarEnabled() || (!id && !invoiceId)) return { paid: false, amount: null };
  if (id) {
    const p = await getPayment(id).catch(() => null);
    if (p && p.id === id) return { paid: p.status === "paid" && p.currency === "SAR", amount: Number.isFinite(p.amount) ? p.amount / 100 : null };
  }
  const inv = await getInvoice(invoiceId || id).catch(() => null);
  if (inv && inv.id) return { paid: inv.status === "paid" && inv.currency === "SAR", amount: Number.isFinite(inv.amount) ? inv.amount / 100 : null };
  return { paid: false, amount: null };
}
