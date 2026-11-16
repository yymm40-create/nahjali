import type { Metadata } from "next";
import { jawadLogin, jawadSession } from "@/lib/jawad/server/access";
import { offer10Status } from "@/lib/jawad/server/offer10";
import { OFFER10, OFFER10_GRANTS, offer10End, offer10Phase, offer10Start } from "@config/jawad/offer10";
import Riyal from "@/components/Riyal";
import OfferBuy from "./OfferBuy";
import Countdown from "./Countdown";
import TryModel from "@/components/jawad/models/TryModel";
import "@/components/jawad/landing.css";
import "./offer.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "عرض الـ١٠ ريال",
  description: "اشترك بـ١٠ ريال: Nano Banana Pro بلا حدود يوم كامل، و٢٠ صورة GPT Image 2، و٣ فيديوهات Seedance 2.0 مجانية. العرض ٤٨ ساعة بس.",
};

const ICON: Record<string, string> = { nano: "🍌", gpt: "🎨", seedance: "🎬" };

/** «عرض الـ١٠ ريال» (config/jawad/offer10.ts): open to everyone; buying needs sign-in; after paying it shows what is left. */
export default async function OfferPage({ searchParams }: { searchParams: Promise<{ paid?: string; unpaid?: string }> }) {
  const sp = await searchParams;
  const { user } = await jawadSession();
  const grants = user ? await offer10Status(user.id).catch(() => []) : [];
  const phase = offer10Phase();
  const open = phase === "open";
  const before = phase === "before";
  return (
    <div className="ld ox" dir="rtl">
      <header className="ld-hero ox-hero">
        <div className="ld-in">
          <span className="ld-eyebrow"><i aria-hidden />عرض لمدة ٤٨ ساعة بس</span>
          <h1>
            اشترك بـ <Riyal halalas={OFFER10.priceSar * 100} size={40} className="ld-grad ox-rl" />
            <br />
            وخذ أقوى ٣ مولّدات مجانًا
          </h1>
          {grants.length === 0 && (open || before) && <Countdown to={before ? offer10Start() : offer10End()} label={before ? "يبدأ العرض بعد" : "ينتهي العرض بعد"} />}
          {grants.length === 0 && !open && !before && <p className="ox-closed">انتهى وقت العرض. تابعنا عشان ما يفوتك اللي بعده.</p>}
        </div>
      </header>

      <section className="ld-sec ox-sec">
        <div className="ld-in">
          {sp.paid && grants.length > 0 && <p className="ox-ok">تم الدفع ✓ العرض شغّال في حسابك الحين.</p>}
          {sp.unpaid && grants.length === 0 && <p className="ox-err">ما وصلنا الدفع. إذا انخصم منك، تواصل معنا ونضبطها لك.</p>}
          <ul className="ox-cards">
            {OFFER10_GRANTS.map((g) => {
              const mine = grants.find((x) => x.key === g.key);
              return (
                <li key={g.key} className={`ox-card ox-${g.key}`}>
                  <span className="ox-ic" aria-hidden>{ICON[g.key]}</span>
                  <h2 dir="ltr">{g.name}</h2>
                  <p className="ox-line">{g.line}</p>
                  {mine ? (
                    <>
                      <p className="ox-left">
                        {!mine.active ? "انتهى" : mine.left == null ? `بلا حدود لين ${new Date(mine.until).toLocaleString("ar-SA-u-nu-arab", { timeZone: "Asia/Riyadh", weekday: "long", hour: "numeric", minute: "2-digit" })}` : `باقي لك ${mine.left} ${g.unit} من ${mine.cap}`}
                      </p>
                      {mine.active && <TryModel id={g.generatorId} name={g.name} className="ld-cta ox-try" />}
                      {mine.active && g.resolution && <p className="ox-note">اختر الدقة {g.resolution} عشان يطلع مجاني</p>}
                    </>
                  ) : (
                    <p className="ox-free">مجاني مع العرض</p>
                  )}
                </li>
              );
            })}
          </ul>
          {grants.length === 0 && open && (
            <div className="ox-buy">
              <p className="ox-price">
                <Riyal halalas={OFFER10.priceSar * 100} size={40} className="ox-pn" /> بس · مرة وحدة
              </p>
              <OfferBuy login={user ? null : jawadLogin(OFFER10.path)} />
              <p className="ld-note ox-safe">تدفع بالبطاقة أو مدى أو Apple Pay على صفحة ميسّر الآمنة. المدة تبدأ من لحظة الدفع.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
