import type { Metadata } from "next";
import { amountLabel, cleanNote, parseAmount, PAY_DEFAULT } from "@/lib/pay-link";
import PayForm from "./PayForm";
import "@/components/jawad/landing.css";
import "./pay.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "ادفع للجواد الذكي",
  description: "اكتب المبلغ وادفع بالبطاقة أو مدى أو Apple Pay على صفحة الدفع الآمنة.",
};

/**
 * «ادفع بالمبلغ اللي تبيه»: a public payment link (no sign-in). Opens on 100 riyals, or on ?amount=… (a link the owner sends,
 * e.g. /jawad-ai/pay?amount=250), and an optional ?note=…; the payer can change the amount before paying.
 */
export default async function PayPage({ searchParams }: { searchParams: Promise<{ amount?: string; note?: string }> }) {
  const { amount, note } = await searchParams;
  const initial = parseAmount(amount ?? "") ?? PAY_DEFAULT;
  return (
    <div className="ld pl" dir="rtl">
      <header className="ld-hero pl-hero">
        <div className="ld-in">
          <span className="ld-eyebrow"><i aria-hidden />الجواد الذكي · دفع آمن</span>
          <h1>
            ادفع <span className="ld-grad">بالمبلغ</span> اللي تبيه
          </h1>
          <p className="ld-sub">اكتب المبلغ، واضغط ادفع، وتنتقل لصفحة الدفع بنفس المبلغ ({amountLabel(initial)} ريال مكتوبة لك، وتقدر تغيّرها).</p>
          <PayForm initial={initial} initialNote={cleanNote(note)} />
        </div>
      </header>
    </div>
  );
}
