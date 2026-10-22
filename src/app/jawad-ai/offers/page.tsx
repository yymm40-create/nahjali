import type { Metadata } from "next";
import Link from "next/link";
import Riyal from "@/components/Riyal";
import { loadCreditSettings } from "@/lib/credits/settings";
import { waLink } from "@config/course";
import { CREDITS } from "@config/credits";
import { OFFERS } from "@config/jawad/offers";
import OfferButtons from "./OfferButtons";
import "@/components/jawad/landing.css";
import "./offers.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "عروض الإطلاق",
  description: "ثلاث نتائج جاهزة بالريال من الجواد الذكي، بدون اشتراك: إعلان متجرك بوجهك وصوتك، لعبة لطفلك باسمه، وحزمة الاختبار النهائي — تطلبها على واتساب ويرد عليك إنسان.",
};

/** «عروض الإطلاق»: three finished results at a riyal price, in the front page's colours, open to everyone (no sign-in). */
export default async function OffersPage() {
  // the owner's WhatsApp number (the credit settings); none set → the first button opens the section instead
  const whatsapp = (await loadCreditSettings().catch(() => null))?.whatsapp || null;
  return (
    <div className="ld of" dir="rtl">
      <header className="ld-hero of-hero">
        <div className="ld-in">
          <span className="ld-eyebrow"><i aria-hidden />عروض الإطلاق · أول ٣٠ عميل</span>
          <h1>
            نتيجة جاهزة <span className="ld-grad">بالريال</span>، مب اشتراك
          </h1>
          <p className="ld-note of-line">بدون اشتراك · تدفع بالريال · رصيدك ما ينتهي · يرد عليك إنسان</p>
        </div>
      </header>

      <section className="ld-sec of-sec">
        <div className="ld-in">
          <ul className="of-cards">
            {OFFERS.map((o) => (
              <li key={o.key} className="of-card">
                <h2>{o.title}</h2>
                <p className="of-price">
                  <Riyal halalas={o.priceSar * 100} size={26} className="of-pn" />
                  <small>{o.priceNote}</small>
                </p>
                <ul className="of-bullets">
                  {o.bullets.map((b) => <li key={b}>{b}</li>)}
                </ul>
                <OfferButtons offerKey={o.key} href={o.href} wa={whatsapp ? waLink(whatsapp, o.whatsappText) : null} />
              </li>
            ))}
          </ul>
          <p className="of-promise">ما عجبك؟ نعيدها مرة مجانًا. وأي توليد يفشل يرجع رصيده.</p>
          <Link href={CREDITS.base} className="ld-more">أو اشحن رصيدك وسوّها بنفسك</Link>
        </div>
      </section>
    </div>
  );
}
