import Link from "next/link";
import { Amount } from "@/components/mahdi/support/SupportView";
import { t } from "@/lib/mahdi/i18n";
import { SUPPORT_PATH } from "@/lib/mahdi/support";
import { checkPayment } from "@/lib/pay-check";
import { amountLabel } from "@/lib/pay-link";

export const dynamic = "force-dynamic";
export const metadata = { title: t.support.title, robots: { index: false } };

const S = t.support;

/**
 * Where «ادعم التطبيق» ends (src/lib/credits/checkout.ts → landing, or the invoice page's success URL): the payment is READ
 * from Moyasar (never trusted from the URL), then a thank-you and the way back into the app, or «جرّب مرة ثانية».
 */
export default async function SupportDonePage({ searchParams }: { searchParams: Promise<{ id?: string; invoice_id?: string }> }) {
  const { id = "", invoice_id = "" } = await searchParams;
  const r = await checkPayment(id.slice(0, 80), invoice_id.slice(0, 80));
  return (
    <section className="m-card space-y-4 p-6 text-center">
      {r.paid ? (
        <>
          <div className="text-5xl" aria-hidden="true">
            🤲
          </div>
          <h1 className="m-display text-3xl">{S.thanksTitle}</h1>
          {r.amount !== null && (
            <p className="flex items-center justify-center gap-2 text-lg font-semibold">
              {S.thanksAmount} <Amount riyals={r.amount} size={20} />
            </p>
          )}
          <p className="m-muted leading-relaxed">{S.thanksBody}</p>
          <p className="font-semibold">{S.pray}</p>
          <Link href="/mahdi" className="m-btn m-btn-primary w-full">
            {S.backToApp}
          </Link>
        </>
      ) : (
        <>
          <h1 className="m-display text-2xl">{S.notPaidTitle}</h1>
          <p className="m-muted leading-relaxed">{S.notPaidBody}</p>
          <Link href={r.amount ? `${SUPPORT_PATH}?amount=${amountLabel(r.amount)}` : SUPPORT_PATH} className="m-btn m-btn-primary w-full">
            {S.tryAgain}
          </Link>
          <Link href="/mahdi" className="m-btn m-btn-quiet w-full">
            {S.backToApp}
          </Link>
        </>
      )}
    </section>
  );
}
