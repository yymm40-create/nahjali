import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { checkoutUrl, formEnabled } from "@/lib/credits/checkout";
import { createInvoice, halalas, moyasarEnabled } from "@/lib/credits/moyasar";
import { amountLabel, cleanNote, parseAmount, PAY_MAX, PAY_MIN } from "@/lib/pay-link";
import { SUPPORT_DONE_PATH, SUPPORT_PATH, SUPPORT_REF, supportLine } from "@/lib/mahdi/support";

export const dynamic = "force-dynamic";

/**
 * «ادفع بالمبلغ اللي تبيه»: body { amount, note? } → { url } of Moyasar's invoice page for exactly that amount in riyals.
 * Open to everyone (no sign-in): it is a plain payment to JAWAD AI, not a balance top-up, so nothing is added anywhere —
 * the owner sees the payment in Moyasar's dashboard. With `for: "mahdi"` it is «ادعم التطبيق» of «لأجل المهدي» (src/lib/mahdi/support.ts):
 * the line says «دعم لأجل المهدي», the payment's ref is "mahdi", and «رجوع» and the end of the payment are the app's own pages.
 */
export const POST = handle(async (req: Request) => {
  if (!moyasarEnabled()) throw new UserError("الدفع بالبطاقة غير متاح الحين، تواصل معنا.", 503);
  const b = (await req.json().catch(() => ({}))) as { amount?: unknown; note?: unknown; for?: unknown };
  const amount = parseAmount(b.amount);
  if (amount === null) throw new UserError(`اكتب مبلغ بالريال من ${PAY_MIN} إلى ${PAY_MAX.toLocaleString("en")}.`, 400);
  const note = cleanNote(b.note);
  const origin = new URL(req.url).origin;
  const mahdi = b.for === SUPPORT_REF;
  const description = mahdi ? supportLine(note) : `دفعة للجواد الذكي ${amountLabel(amount)} ريال${note ? ` — ${note}` : ""}`;
  const back = `${mahdi ? SUPPORT_PATH : "/jawad-ai/pay"}?amount=${amountLabel(amount)}`;
  // our own page with Moyasar's form (the Payments API); the invoice page only without its key
  if (formEnabled()) return NextResponse.json({ url: checkoutUrl(origin, { k: "pay", ref: mahdi ? SUPPORT_REF : "", a: halalas(amount), d: description, back }) });
  const inv = await createInvoice({
    amount,
    description,
    successUrl: `${origin}${mahdi ? SUPPORT_DONE_PATH : "/jawad-ai/pay/done"}`,
    backUrl: `${origin}${back}`,
  });
  return NextResponse.json({ url: inv.url });
});
