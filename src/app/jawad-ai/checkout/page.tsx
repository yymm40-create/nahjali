import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { applePayOn, formEnabled, publishableKey, readTicket } from "@/lib/credits/checkout";
import CheckoutForm from "./CheckoutForm";
import "@/components/jawad/landing.css";
import "../pay/pay.css";
import "./checkout.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "إتمام الدفع", robots: { index: false } };

/**
 * «صفحة الدفع»: Moyasar's own card form inside our site (src/lib/credits/checkout.ts). The ticket in the address says what is
 * being paid for; it is signed, so the amount and the line shown are ours.
 */
export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t = "" } = await searchParams;
  const ticket = readTicket(t);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "www.aljawadai.app";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;
  return (
    <div className="ld pl" dir="rtl">
      <header className="ld-hero pl-hero">
        <div className="ld-in">
          {ticket && formEnabled() ? (
            <>
              <h1>
                إتمام <span className="ld-grad">الدفع</span>
              </h1>
              <CheckoutForm
                amount={ticket.a}
                description={ticket.d}
                kind={ticket.k}
                refId={ticket.ref}
                publishableKey={publishableKey()}
                callbackUrl={`${origin}/api/checkout/return?k=${ticket.k}${ticket.k === "pay" && ticket.ref ? `&r=${encodeURIComponent(ticket.ref)}` : ""}`}
                back={ticket.back}
                applePay={applePayOn()}
              />
            </>
          ) : (
            <>
              <h1>رابط الدفع انتهى</h1>
              <p className="ld-sub">ارجع للصفحة اللي كنت فيها واضغط الدفع مرة ثانية.</p>
              <Link className="ld-cta" href="/jawad-ai">الصفحة الرئيسية</Link>
            </>
          )}
        </div>
      </header>
    </div>
  );
}
