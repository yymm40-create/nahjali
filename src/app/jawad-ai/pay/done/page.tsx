import type { Metadata } from "next";
import Link from "next/link";
import { checkPayment } from "@/lib/pay-check";
import { amountLabel } from "@/lib/pay-link";
import "@/components/jawad/landing.css";
import "../pay.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "تم الدفع", robots: { index: false } };

/** Where Moyasar sends the payer back after the invoice page (it appends the payment `id`). */
export default async function PayDonePage({ searchParams }: { searchParams: Promise<{ id?: string; invoice_id?: string }> }) {
  const { id = "", invoice_id = "" } = await searchParams;
  const r = await checkPayment(id.slice(0, 80), invoice_id.slice(0, 80));
  return (
    <div className="ld pl" dir="rtl">
      <header className="ld-hero pl-hero">
        <div className="ld-in">
          {r.paid ? (
            <>
              <div className="pl-ok" aria-hidden>✓</div>
              <h1>
                تم الدفع <span className="ld-grad">بنجاح</span>
              </h1>
              {r.amount !== null && <p className="ld-sub">وصلنا {amountLabel(r.amount)} ريال، الله يعطيك العافية.</p>}
              <Link className="ld-cta" href="/jawad-ai">الصفحة الرئيسية</Link>
            </>
          ) : (
            <>
              <h1>ما تأكد الدفع</h1>
              <p className="ld-sub">إذا انخصم المبلغ من بطاقتك تواصل معنا، وإذا ما انخصم جرّب مرة ثانية.</p>
              <Link className="ld-cta" href={r.amount ? `/jawad-ai/pay?amount=${amountLabel(r.amount)}` : "/jawad-ai/pay"}>جرّب مرة ثانية</Link>
            </>
          )}
        </div>
      </header>
    </div>
  );
}
