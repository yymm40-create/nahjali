// «الجواد الذكي» — the front page for a visitor who is not signed in, built the way the big AI studios open theirs (Higgsfield,
// OpenArt): a promo strip, one clear promise with two buttons, a moving strip of real results, every tool as a card, the strongest
// models by name, three steps, the packages, short answers, and one last call. Server component; mobile first.
//
// Made for a cold visitor from an Instagram / TikTok / Snapchat ad: the offer (the free first picture, while it is on) in the strip
// and on the button, today's real unit prices under the buttons, an optional vertical video (JAWAD.heroVideoUrl), and a WhatsApp
// pill to ask a human before paying (when the owner's number is set in the credit settings).

import type { ReactNode } from "react";
import Link from "next/link";
import Riyal from "@/components/Riyal";
import AdVideo from "@/components/jawad/AdVideo";
import LandingWhatsApp from "@/components/jawad/LandingWhatsApp";
import { bonusPct, CREDITS, type Pack, type UnitPrices } from "@config/credits";
import { waLink } from "@config/course";
import { giftOpen, SIGNUP_GIFT } from "@config/gift";
import { JAWAD } from "@config/jawad/brand";
import "./landing.css";

export interface LandingTool {
  href: string;
  icon: string;
  name: string;
  line: string;
  tint: string;
}

export default function Landing({ loginHref, samples, tools, models, packs, featured, freeImageOn = false, units = null, whatsapp = "" }: {
  loginHref: string;
  samples: string[];
  tools: LandingTool[];
  models: string[];
  packs: Pack[];
  featured: string;
  /** the signup free picture is on for an account made today: the offer goes in the strip and on the button */
  freeImageOn?: boolean;
  /** what a picture, a 5-second video and a scene cost now (null: the price line falls back to the cheapest package) */
  units?: UnitPrices | null;
  /** the owner's WhatsApp number from the credit settings (empty: no pill) */
  whatsapp?: string;
}) {
  const show = (() => {
    const i = Math.max(0, packs.findIndex((p) => p.id === featured));
    // the cheap way in, the featured one, and the biggest
    return [...new Set([packs[0], packs[i], packs[packs.length - 1]])].filter(Boolean);
  })();
  // the strip runs twice so it loops without a gap
  const strip = samples.length ? [...samples, ...samples] : [];
  // today's real prices under the buttons; a thing whose price is not known is left out
  const prices: ReactNode[] = [];
  if (units && units.image > 0) prices.push(<>الصورة من <Riyal halalas={units.image} size={13} /></>);
  if (units && units.video5 > 0) prices.push(<>فيديو ٥ ثواني من <Riyal halalas={units.video5} size={13} /></>);
  if (units && units.scene > 0) prices.push(<>مشهد سينمائي كامل بـ <Riyal halalas={units.scene} size={13} /></>);
  const cheapest = packs.length ? packs.reduce((a, b) => (b.price < a.price ? b : a)) : null;
  if (!prices.length && cheapest) prices.push(<>باقات من <Riyal halalas={cheapest.price * 100} size={13} /></>);
  return (
    <div className="ld" dir="rtl">
      {freeImageOn ? (
        <Link href={loginHref} className="ld-promo">🎁 سجّل وخذ <b>أول صورة مجانًا</b> — بدون بطاقة</Link>
      ) : giftOpen() ? (
        <Link href={loginHref} className="ld-promo">🎁 سجّل الحين وخذ <b><Riyal halalas={SIGNUP_GIFT.halalas} size={14} /> مجانًا</b> في رصيدك — العرض لين ٦ الصبح بس</Link>
      ) : (
        <Link href={CREDITS.base} className="ld-promo">🎁 كل ما كبرت الباقة زاد رصيدك المجاني — <b>شوف الباقات</b></Link>
      )}

      <header className="ld-hero">
        <div className="ld-in">
          <span className="ld-eyebrow"><i aria-hidden />استوديو عربي بالذكاء الاصطناعي</span>
          <h1>
            من فكرتك إلى <span className="ld-grad">صورة وفيديو وتصميم</span>
            <br />
            بالعربي، وفي دقائق
          </h1>
          <p className="ld-sub">اكتب اللي تبيه بلهجتك، وروبوتات الجواد تصنعه لك: صور، فيديوهات، أصوات، أفلام، محتوى يبيع، تصاميم ومونتاج — كله في مكان واحد.</p>
          <div className="ld-actions">
            <Link href={loginHref} className="ld-cta">{freeImageOn ? "جرّب مجانًا ←" : "سجّل وابدأ ←"}</Link>
            <Link href={CREDITS.base} className="ld-ghost">شوف الباقات</Link>
          </div>
          {prices.length > 0 && (
            <p className="ld-prices">
              {prices.map((p, i) => <span key={i}>{p}</span>)}
            </p>
          )}
          <p className="ld-note">بدون اشتراك · تدفع بالريال · رصيدك ما ينتهي · يرد عليك إنسان</p>
          {JAWAD.heroVideoUrl && (
            <div className="ld-video">
              <AdVideo src={JAWAD.heroVideoUrl} poster={null} label="الجواد الذكي في ثواني" />
            </div>
          )}
        </div>
        {strip.length > 0 && (
          <div className="ld-strip" aria-hidden>
            <div className="ld-track" style={{ ["--n" as string]: samples.length }}>
              {strip.map((u, i) => (
                // eslint-disable-next-line @next/next/no-img-element -- the owner's sample pictures from storage
                <img key={i} src={u} alt="" loading={i < 6 ? "eager" : "lazy"} />
              ))}
            </div>
          </div>
        )}
      </header>

      <section className="ld-sec">
        <div className="ld-in">
          <h2 className="ld-h">كل أدواتك في مكان واحد</h2>
          <p className="ld-lead">كل قسم له روبوت يفهمك ويسوي الشغل معك خطوة بخطوة.</p>
          <ul className="ld-tools">
            {tools.map((t) => (
              <li key={t.href + t.name}>
                <Link href={t.href} className="ld-tool" style={{ ["--t" as string]: t.tint }}>
                  <span className="ld-ticon" aria-hidden>{t.icon}</span>
                  <b>{t.name}</b>
                  <span>{t.line}</span>
                  <em>جرّبه ←</em>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {models.length > 0 && (
        <section className="ld-sec ld-alt">
          <div className="ld-in">
            <h2 className="ld-h">أقوى النماذج في العالم، بين يديك</h2>
            <p className="ld-lead">ما تحتاج تشترك في كل موقع لحاله: نفس المولدات العالمية، برصيد واحد.</p>
            <ul className="ld-models">
              {models.map((m) => <li key={m} dir="ltr">{m}</li>)}
            </ul>
          </div>
        </section>
      )}

      <section className="ld-sec">
        <div className="ld-in">
          <h2 className="ld-h">كيف تبدأ؟</h2>
          <ol className="ld-steps">
            <li><b>١</b><span><strong>سجّل</strong>بإيميلك أو حساب جوجل، في ثواني.</span></li>
            <li><b>٢</b><span><strong>اشحن رصيدك</strong>اختر باقتك وحوّل، وينضاف رصيدك بعد التأكيد.</span></li>
            <li><b>٣</b><span><strong>اصنع</strong>اكتب فكرتك، وشوف السعر قبل ما تضغط «توليد».</span></li>
          </ol>
        </div>
      </section>

      {show.length > 0 && (
        <section className="ld-sec ld-alt">
          <div className="ld-in">
            <h2 className="ld-h">باقات تناسبك</h2>
            <p className="ld-lead">تدفع مرة وحدة، وكل ما كبرت الباقة زاد رصيدك المجاني.</p>
            <div className="ld-packs">
              {show.map((p) => (
                <Link key={p.id} href={`${CREDITS.base}?pack=${p.id}`} className={`ld-pack${p.id === featured ? " star" : ""}`}>
                  {p.tag && <span className="ld-tag">{p.tag}</span>}
                  <b>{p.name}</b>
                  <span className="ld-pprice"><Riyal halalas={p.price * 100} size={22} className="ld-pn" /></span>
                  <span className="ld-pget">رصيد <Riyal halalas={p.credit * 100} size={14} />{bonusPct(p) > 0 && <em>+{bonusPct(p)}٪</em>}</span>
                </Link>
              ))}
            </div>
            <Link href={CREDITS.base} className="ld-more">كل الباقات ←</Link>
          </div>
        </section>
      )}

      <section className="ld-sec">
        <div className="ld-in">
          <h2 className="ld-h">أسئلة سريعة</h2>
          <div className="ld-faq">
            <details>
              <summary>وش هو الجواد الذكي؟</summary>
              <p>استوديو عربي يجمع أدوات الذكاء الاصطناعي في مكان واحد: صور وفيديو وأصوات وأفلام ومونتاج ومحتوى وتصاميم، مع روبوتات تفهم لهجتك وتشتغل معك.</p>
            </details>
            <details>
              <summary>كيف أدفع؟</summary>
              <p>تختار باقة الرصيد وتحوّل بتحويل بنكي، وتضغط «تم التحويل»، وينضاف رصيدك بعد ما نتأكد من وصول المبلغ.</p>
            </details>
            <details>
              <summary>كم سعر الصورة أو الفيديو؟</summary>
              <p>كل عملية لها سعرها حسب المولد والجودة والمدة، ويظهر لك على زر «توليد» قبل ما تضغط. ما ينخصم شي بدون علمك.</p>
            </details>
            <details>
              <summary>لو فشل التوليد؟</summary>
              <p>يرجع رصيده لك تلقائيًا.</p>
            </details>
            <details>
              <summary>ما أعرف أستخدم الذكاء الاصطناعي، يناسبني؟</summary>
              <p>إيه. اكتب بلهجتك عادي، والروبوتات تسألك اللي تحتاجه. وإذا احترت في أي شي اضغط على «سلمان» تحت الشاشة ويجاوبك.</p>
            </details>
          </div>
        </div>
      </section>

      <section className="ld-final">
        <div className="ld-in">
          <h2>جاهز تصنع أول شي لك؟</h2>
          <Link href={loginHref} className="ld-cta">{freeImageOn ? "جرّب مجانًا ←" : "ابدأ الآن ←"}</Link>
        </div>
      </section>

      <footer className="ld-foot">
        <Link href="/terms">الشروط والأحكام</Link>
        <Link href="/privacy">سياسة الخصوصية</Link>
        <span>الجواد الذكي © ٢٠٢٦</span>
      </footer>

      {whatsapp && <LandingWhatsApp href={waLink(whatsapp, "السلام عليكم، عندي سؤال عن الجواد الذكي")} />}
    </div>
  );
}
