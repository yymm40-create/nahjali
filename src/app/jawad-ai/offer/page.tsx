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
  title: "عرض الـ٢٥ ريال · صور وفيديوهات بقيمة ١٠٠ ريال",
  description: "اشترك بـ٢٥ ريال: Nano Banana Pro بلا حدود يوم كامل بدقة 1K، و٢٠ صورة GPT Image 2، و٤ فيديوهات Seedance 2.0 (فلم دقيقة). العرض لفترة محدودة.",
  openGraph: { images: ["/jawad-ai/offer/hero.jpg"] },
};

const ICON: Record<string, string> = { nano: "🍌", gpt: "🎨", seedance: "🎬" };

/**
 * What each part of the offer costs on the site at its usual price (the studio's own quotes, 16 Nov 2026): Nano Banana Pro
 * 1K ¤1.5 a picture, GPT Image 2 ¤1 a picture, Seedance 2.0 15 s at 480p ¤6.5. «بقيمة ١٠٠ ريال» = 4 videos (26) + 20 pictures
 * (20) + 36 Nano pictures (54) — and Nano is without a limit for the day, so it is «وأكثر».
 */
const VALUE: Record<string, { usual: string; worth: number }> = {
  nano: { usual: "الصورة عادةً ١٫٥ ريال", worth: 54 },
  gpt: { usual: "الصورة عادةً ١ ريال", worth: 20 },
  seedance: { usual: "الفيديو ١٥ ثانية عادةً ٦٫٥ ريال", worth: 26 },
};

const FAQ: [string, string][] = [
  ["متى تبدأ المدة؟", "من لحظة الدفع: نانو بنانا برو بلا حدود ٢٤ ساعة، والصور والفيديوهات خلال ٤٨ ساعة."],
  ["كيف أستخدمها مجانًا؟", "افتح الاستوديو الإبداعي واختر المولّد. نانو بنانا برو على دقة 1K، وسيدنس ٢.٠ على 480p، وما ينخصم من رصيدك شي."],
  ["هل يتجدد الاشتراك ويسحب من بطاقتي؟", "لا. دفعة وحدة ٢٥ ريال وبس، ما فيه تجديد ولا سحب ثاني."],
  ["وش أقدر أسوي فيه؟", "شخصيات وشيتات، صور إعلانية، بوسترات، وفلم أنمي أو سينمائي مدته دقيقة من ٤ فيديوهات (كل فيديو لين ١٥ ثانية)."],
  ["كيف أدفع؟", "بطاقة، مدى، أو Apple Pay. الدفع عن طريق ميسّر، وبيانات بطاقتك ما تمر على خوادمنا."],
];

/** «عرض الـ٢٥ ريال» (config/jawad/offer10.ts): open to everyone; buying needs sign-in; after paying it shows what is left. */
export default async function OfferPage({ searchParams }: { searchParams: Promise<{ paid?: string; unpaid?: string }> }) {
  const sp = await searchParams;
  const { user } = await jawadSession();
  const grants = user ? await offer10Status(user.id).catch(() => []) : [];
  const phase = offer10Phase();
  const open = phase === "open";
  const before = phase === "before";
  const bought = grants.length > 0;
  const login = user ? null : jawadLogin(OFFER10.path);
  const worth = Object.values(VALUE).reduce((a, v) => a + v.worth, 0);
  return (
    <div className="ld ox" dir="rtl">
      <header className="ox-hero">
        <div className="ox-hero-bg" aria-hidden />
        <div className="ld-in ox-hero-in">
          {bought ? (
            <span className="ox-tag ox-tag-ok">✓ العرض شغّال في حسابك</span>
          ) : (
            <span className="ox-tag"><i aria-hidden />{open ? "عرض لفترة محدودة · ينتهي قريب" : before ? "العرض يبدأ قريب" : "انتهى وقت العرض"}</span>
          )}
          <h1 className="ox-h1">
            صور وفيديوهات
            <br />
            بقيمة <s className="ox-was">١٠٠ ريال</s>
            <br />
            <span className="ox-fire">بـ <Riyal halalas={OFFER10.priceSar * 100} size={52} className="ox-fire-rl" /> بس!</span>
          </h1>
          <p className="ox-sub">نانو بنانا برو بلا حدود يوم كامل، و٢٠ صورة GPT Image 2، و٤ فيديوهات سيدنس ٢.٠ = فلم كامل مدته دقيقة.</p>
          {!bought && (open || before) && <Countdown to={before ? offer10Start() : offer10End()} label={before ? "يبدأ العرض بعد" : "ينتهي العرض بعد"} />}
          {!bought && open && (
            <div className="ox-hero-buy">
              <OfferBuy login={login} />
              <p className="ox-pay">مدى · فيزا · ماستركارد · Apple Pay — دفعة وحدة، بدون تجديد</p>
            </div>
          )}
          {!bought && !open && !before && <p className="ox-closed">انتهى وقت العرض. تابعنا عشان ما يفوتك اللي بعده.</p>}
        </div>
      </header>

      {sp.paid && bought && <p className="ox-ok">تم الدفع ✓ العرض شغّال في حسابك الحين.</p>}
      {sp.unpaid && !bought && <p className="ox-err">ما وصلنا الدفع. إذا انخصم منك، تواصل معنا ونضبطها لك.</p>}

      <section className="ld-sec ox-sec">
        <div className="ld-in">
          <h2 className="ox-h2">{bought ? "وش باقي لك" : "وش تاخذ بالـ٢٥ ريال؟"}</h2>
          <ul className="ox-cards">
            {OFFER10_GRANTS.map((g) => {
              const mine = grants.find((x) => x.key === g.key);
              const v = VALUE[g.key];
              return (
                <li key={g.key} className={`ox-card ox-${g.key}`}>
                  <div className="ox-card-top">
                    <span className="ox-ic" aria-hidden>{ICON[g.key]}</span>
                    {!mine && v && <span className="ox-worth">قيمتها {v.worth}{g.key === "nano" ? "+" : ""} ريال</span>}
                  </div>
                  <h3 dir="ltr">{g.name}</h3>
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
                    v && <p className="ox-usual">{v.usual}</p>
                  )}
                </li>
              );
            })}
          </ul>
          {!bought && (
            <div className="ox-sum">
              <span>القيمة لو دفعتها بالسعر العادي</span>
              <s>{worth}+ ريال</s>
              <span>مع العرض</span>
              <b><Riyal halalas={OFFER10.priceSar * 100} size={30} /></b>
            </div>
          )}
        </div>
      </section>

      <section className="ld-sec ox-sec ox-show">
        <div className="ld-in">
          <h2 className="ox-h2">هذا سويناه بالعرض نفسه 👇</h2>
          <p className="ox-sec-sub">شخصيتين ومكان بنانو بنانا برو، وبعدها فيديو ١٥ ثانية بسيدنس ٢.٠ بدقة 480p — نفس اللي تاخذه.</p>
          <div className="ox-show-grid">
            <figure className="ox-vid">
              <video src="/jawad-ai/offer/fight.mp4" poster="/jawad-ai/offer/fight.jpg" autoPlay muted loop playsInline preload="metadata" />
              <figcaption>🎬 Seedance 2.0 · ١٥ ثانية · 480p</figcaption>
            </figure>
            <div className="ox-sheets">
              {[
                ["raad", "رعد ⚡"],
                ["naar", "نار 🔥"],
                ["rooftop", "المكان"],
              ].map(([k, t]) => (
                <figure key={k} className="ox-sheet">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/jawad-ai/offer/${k}.jpg`} alt={`شيت ${t} بنانو بنانا برو`} loading="lazy" />
                  <figcaption>🍌 {t}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="ld-sec ox-sec">
        <div className="ld-in">
          <h2 className="ox-h2">٣ خطوات وتبدأ</h2>
          <ol className="ox-steps">
            <li><b>١</b><span>اشترك بـ٢٥ ريال</span><small>بطاقة، مدى أو Apple Pay</small></li>
            <li><b>٢</b><span>افتح الاستوديو الإبداعي</span><small>العرض يشتغل في حسابك على طول</small></li>
            <li><b>٣</b><span>اختر المولّد واصنع</span><small>نانو 1K وسيدنس 480p مجانًا</small></li>
          </ol>
        </div>
      </section>

      <section className="ld-sec ox-sec">
        <div className="ld-in">
          <h2 className="ox-h2">أسئلة سريعة</h2>
          <div className="ox-faq">
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
          {!bought && open && (
            <div className="ox-end">
              <p>الفرصة ما تتكرر — <b>٢٥ ريال</b> بدل ١٠٠</p>
              <OfferBuy login={login} />
            </div>
          )}
        </div>
      </section>

      {!bought && open && (
        <div className="ox-sticky">
          <div className="ox-sticky-p">
            <s>١٠٠</s>
            <Riyal halalas={OFFER10.priceSar * 100} size={22} />
          </div>
          <OfferBuy login={login} compact />
        </div>
      )}
    </div>
  );
}
