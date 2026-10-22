"use client";

// «اشحن رصيدك» — the packages as pricing cards (a row of three on a computer, stacked on a phone with the featured one first), each
// with its price rolling in like an odometer the first time the cards come into view, what the balance makes, and ONE button that pays:
// - not signed in → sign in, then back here with ?pack=<id>;
// - signed in but the account has no name / WhatsApp number yet → /jawad-ai/account asks them once, then back here with ?pack=<id>;
// - else straight to Paylink (card, mada, Apple Pay, STC Pay) — the server reads the name and number from the account.
// Back here with ?pack=<id> and everything ready, that package's payment starts by itself (the person already chose it).
// Without the Paylink keys but with the bank transfer on, the button makes the order and opens the bank data to copy.
//
// The ads (src/lib/track.ts, a no-op without a pixel): ViewContent when the page opens, InitiateCheckout when the order is made,
// Purchase back from Paylink paid or at «✅ تم التحويل» (its event_id is the order id, so the owner's confirm sent from the server is
// counted once) and Lead when the WhatsApp link is opened. The visitor's source travels with the order.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Riyal from "@/components/Riyal";
import SmartCoin from "@/components/SmartCoin";
import { bonusPct, CREDITS, packYield, supportLink, type Pack, type UnitPrices } from "@config/credits";
import { waLink, type Bank } from "@config/course";
import { track, visitorSource } from "@/lib/track";

interface Waiting {
  id: string;
  packName: string;
  price: number;
  credit: number;
  support: string;
}
interface Order {
  id: string;
  packName: string;
  price: number;
  credit: number;
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(j.error ?? "تعذّر تنفيذ الطلب.");
  return j;
}

function Copy({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  if (!value) return null;
  return (
    <div className="cr-bankrow">
      <span>{label}</span>
      <b dir="ltr">{value}</b>
      <button
        type="button"
        className="cr-copy"
        aria-label={`انسخ ${label}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setDone(true);
            setTimeout(() => setDone(false), 1800);
          } catch {
            /* the value is on screen: it can be selected by hand */
          }
        }}
      >
        {done ? "✓ تم" : "نسخ"}
      </button>
    </div>
  );
}

/** A price whose digits roll up from 0 like an odometer once `on` (each column spins a full turn, then lands on its digit). */
function Roll({ value, on, delay }: { value: number; on: boolean; delay: number }) {
  const text = Math.round(value).toLocaleString("en");
  return (
    <span className="pr-roll" aria-label={text} dir="ltr">
      {text.split("").map((c, i) =>
        /\d/.test(c) ? (
          <span key={i} className="pr-col" aria-hidden>
            <i style={{ transform: `translateY(-${on ? 10 + Number(c) : 0}em)`, transitionDelay: `${delay + i * 70}ms` }}>
              {Array.from({ length: 20 }, (_, k) => <b key={k}>{k % 10}</b>)}
            </i>
            {/* the digit itself, invisible, gives the column its width */}
            <b className="pr-w">{c}</b>
          </span>
        ) : (
          <span key={i} aria-hidden>{c}</span>
        ),
      )}
    </span>
  );
}

/** Four check lines per package: what its balance makes at today's prices (each on its own), topped up with what every package has. */
function features(credit: number, units: UnitPrices | null | undefined): string[] {
  const out: string[] = [];
  if (units) {
    const y = packYield(credit, units);
    if (y.images > 0) out.push(`${y.images} صورة تقريبًا`);
    if (y.videos > 0) out.push(`أو ${y.videos} فيديو ٥ ثواني`);
    if (y.scenes > 0) out.push(y.scenes === 1 ? "أو مشهد سينمائي كامل" : `أو ${y.scenes} مشاهد سينمائية`);
    if (y.summaries > 0) out.push(y.summaries === 1 ? "أو ملخص من ملف PDF قصير" : `أو ${y.summaries} ملخصات من ملفات PDF`);
  }
  if (out[0]?.startsWith("أو ")) out[0] = out[0].slice(3);
  for (const extra of ["يشتغل في كل أقسام الجواد", "التوليد الفاشل يرجع رصيده", "سعر كل عملية يبين لك قبل ما تبدأ"]) if (out.length < 4) out.push(extra);
  return out.slice(0, 4);
}

export default function CreditsShop({
  packs, featured, bankOk = false, card = false, back = null, hasSupport, whatsapp = "", user, contactOk, balance, owner, waiting, initialPack, loginHref, units,
}: {
  packs: Pack[];
  /** what a standard picture, a 5-second 720p video, a scene and a summary cost now: the check lines on each card */
  units?: UnitPrices | null;
  featured: string;
  /** the bank transfer is set up (the owner's bank data) */
  bankOk?: boolean;
  /** Paylink is set up: one tap to card, mada, Apple Pay, STC Pay */
  card?: boolean;
  /** coming back from Paylink: the order that is paid (its balance is added) or null when the payment was not confirmed */
  back?: { paid: { id: string; packName: string; price: number } | null } | null;
  hasSupport: boolean;
  /** the owner's WhatsApp number (the credit settings): «أرسل الإيصال على واتساب» in the bank step (empty: no button) */
  whatsapp?: string;
  user: { email: string } | null;
  /** the account has a name and a WhatsApp number (the payment reads them from there) */
  contactOk: boolean;
  /** null for the owners (no limit) or when it can't be read */
  balance: number | null;
  owner: boolean;
  waiting: Waiting[];
  initialPack: string | null;
  loginHref: string;
}) {
  const router = useRouter();
  const payable = card || bankOk;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  // the bank transfer (only when Paylink is not set up): the bank data to copy → «تم التحويل» → done
  const [step, setStep] = useState<"bank" | "done" | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [bank, setBank] = useState<Bank | null>(null);
  const [support, setSupport] = useState("");

  const there = (id: string) => `${CREDITS.base}?pack=${id}`;

  async function pay(id: string) {
    if (busy || !payable) return;
    setError("");
    if (!user) {
      router.push(`${loginHref}?next=${encodeURIComponent(there(id))}`);
      return;
    }
    if (!contactOk) {
      router.push(`/jawad-ai/account?next=${encodeURIComponent(there(id))}`);
      return;
    }
    setBusy(id);
    try {
      if (card) {
        const r = await post<{ order: Order; url: string }>("/api/credits/paylink", { pack: id, source: visitorSource() });
        track("InitiateCheckout", { value: r.order.price, currency: "SAR", content_name: r.order.packName });
        window.location.assign(r.url);
        return; // the spinner stays until the browser leaves
      }
      const r = await post<{ order: Order; bank: Bank }>("/api/credits/order", { pack: id, source: visitorSource() });
      track("InitiateCheckout", { value: r.order.price, currency: "SAR", content_name: r.order.packName });
      setOrder(r.order);
      setBank(r.bank);
      setStep("bank");
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(null);
  }

  // back from signing in / filling the account with ?pack=<id>: that package's payment starts by itself, once (the address loses
  // its ?pack first, so going back from Paylink does not start it again)
  const auto = useRef(false);
  useEffect(() => {
    if (auto.current || !initialPack || !user || !contactOk || !payable || back) return;
    auto.current = true;
    window.history.replaceState(null, "", CREDITS.base);
    void pay(initialPack);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, []);

  // back from Paylink with a paid order: the browser's Purchase (the server's confirm sent the same event_id, counted once)
  const paid = back?.paid ?? null;
  useEffect(() => {
    if (paid) track("Purchase", { value: paid.price, currency: "SAR", content_name: paid.packName, event_id: paid.id });
  }, [paid]);

  async function transferred() {
    if (!order) return;
    setBusy(order.id);
    setError("");
    try {
      const r = await post<{ support: string }>("/api/credits/transferred", { orderId: order.id });
      setSupport(r.support ?? "");
      setStep("done");
      // the purchase as the buyer declares it; the owner's confirm repeats it from the server with the same id (counted once)
      track("Purchase", { value: order.price, currency: "SAR", content_name: order.packName, event_id: order.id });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  // the ads: the packages were seen; a WhatsApp chat opened is a lead
  useEffect(() => {
    track("ViewContent", { content_name: "credits" });
  }, []);
  const lead = () => track("Lead", { content_name: "whatsapp" });

  // the prices roll in the first time the cards are on the screen (at once when motion is turned down)
  const gridRef = useRef<HTMLDivElement>(null);
  const [rolled, setRolled] = useState(false);
  useEffect(() => {
    const el = gridRef.current;
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!el || calm || typeof IntersectionObserver === "undefined") {
      const t = requestAnimationFrame(() => setRolled(true));
      return () => cancelAnimationFrame(t);
    }
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      setRolled(true);
      io.disconnect();
    }, { rootMargin: "0px 0px -15% 0px" }); // any part of the cards (the grid is far taller than a phone's screen)
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // the bank step: a picture of the receipt goes to the owner on WhatsApp (when he set his number), the message already written
  const receipt = hasSupport && whatsapp && order && user ? supportLink({ packs, featured, whatsapp }, { id: order.id, packName: order.packName, price: order.price, email: user.email }) : "";

  return (
    <div className="cr cs" dir="rtl">
      <header className="cr-hero cs-hero">
        <div className="cr-in">
          <span className="cr-kicker cr-reveal">الرصيد · الباقات</span>
          <h1 className="cr-reveal" style={{ ["--i" as string]: 1 }}>اشحن رصيدك <em>وابدأ تصنع</em></h1>
          <p className="cr-sub cr-reveal" style={{ ["--i" as string]: 2 }}>
            صور وفيديوهات وأصوات وتصاميم بالذكاء الاصطناعي. اختر باقتك وادفع بضغطة وحدة، وكل ما كبرت الباقة زاد رصيدك المجاني.
          </p>
          {user && (
            <p className="cs-balance">
              رصيدك الحالي: {owner ? <b dir="ltr">∞</b> : <Riyal halalas={balance ?? 0} size={18} className="cs-bal" />}
            </p>
          )}
        </div>
      </header>

      {paid && (
        <section className="cs-waiting">
          <div className="cr-in"><p>✅ تم الدفع، وانضاف رصيد باقة «{paid.packName}» لحسابك. <Link href="/jawad-ai">ابدأ الإبداع ←</Link></p></div>
        </section>
      )}
      {back && !paid && (
        <section className="cs-waiting">
          <div className="cr-in">
            <p>ما وصلنا تأكيد الدفع بعد. إذا انخصم منك مبلغ، يوصلك الرصيد خلال دقائق؛ وإذا تأخر راسلنا.{whatsapp && <> <a href={waLink(whatsapp, "السلام عليكم، دفعت بالبطاقة في الجواد الذكي وما وصلني الرصيد")} target="_blank" rel="noreferrer" onClick={lead}>راسلنا على واتساب</a></>}</p>
          </div>
        </section>
      )}

      {waiting.length > 0 && (
        <section className="cs-waiting">
          <div className="cr-in">
            {waiting.map((w) => (
              <p key={w.id}>
                ⏳ طلب شحن باقة «{w.packName}» قيد التأكيد. يوصلك الرصيد بعد قليل إن شاء الله.
                {w.support && <> <a href={w.support} target="_blank" rel="noreferrer" onClick={lead}>طال الوقت؟ راسلنا على واتساب</a></>}
              </p>
            ))}
          </div>
        </section>
      )}

      <section className="pr" aria-label="الباقات">
        <div className="pr-grid" ref={gridRef}>
          {packs.map((p, i) => {
            const star = p.id === featured;
            const bonus = bonusPct(p);
            const mine = busy === p.id;
            return (
              <article key={p.id} className={`pr-card${star ? " star" : ""}${p.id === packs.find((q) => q.id !== featured)?.id ? " lead" : ""}`} aria-label={`باقة ${p.name}`}>
                <div className="pr-top">
                  <h2 className="pr-name">{p.name}</h2>
                  {star ? <span className="pr-pill">الأكثر طلبًا</span> : p.tag ? <span className="pr-pill soft">{p.tag}</span> : null}
                </div>
                {p.note && <p className="pr-note">{p.note}</p>}
                <div className="pr-price">
                  <SmartCoin size={26} className="pr-mark" />
                  <Roll value={p.price} on={rolled} delay={i * 140} />
                </div>
                <p className="pr-get">
                  يوصلك رصيد <Riyal halalas={p.credit * 100} size={14} className="pr-gn" />
                  {bonus > 0 && <em>+{bonus}٪ مجانًا</em>}
                </p>
                <hr className="pr-hr" />
                <ul className="pr-list">
                  {features(p.credit, units).map((l) => (
                    <li key={l}><i aria-hidden>✓</i>{l}</li>
                  ))}
                </ul>
                <button type="button" className={`pr-btn${payable ? "" : " off"}`} disabled={!payable || (!!busy && !mine)} aria-busy={mine} onClick={() => void pay(p.id)}>
                  {mine ? <span className="pr-spin" aria-label="جاري التحويل للدفع" /> : !payable ? "الدفع يفتح بعد قليل إن شاء الله" : star ? "ادفع الآن ←" : "ادفع الآن"}
                </button>
              </article>
            );
          })}
        </div>

        <div className="pr-foot">
          {error && <p className="cr-error" role="alert">{error}</p>}
          {payable && (
            <>
              <p className="pr-pay">{card ? "💳 بطاقة · مدى · Apple Pay · STC Pay — الدفع آمن عبر Paylink" : "🏦 تحويل بنكي — ينضاف الرصيد بعد ما نتأكد من التحويل"}</p>
              <p className="pr-terms">
                بالدفع توافق على{" "}
                <Link href="/terms" target="_blank" rel="noreferrer">الشروط والأحكام</Link>{" "}
                و<Link href="/privacy" target="_blank" rel="noreferrer">سياسة الخصوصية</Link>
              </p>
            </>
          )}
        </div>
      </section>

      <section className="cr-band">
        <div className="cr-in">
          <h2 className="cr-h" data-k="أسئلة · سريعة">قبل ما تشحن</h2>
          <dl className="cs-faq">
            <div><dt>وش أقدر أسوي بالرصيد؟</dt>
            <dd>كل أقسام الجواد: صور، فيديو، أصوات وموسيقى، أفلام، مونتاج حيدرة، الطالب الذكي، المحتوى مع محمد باقر، التصاميم مع كاظم، وتحرير الصور مع زهراء. سعر كل عملية يظهر لك قبل ما تضغط «توليد».</dd></div>
            <div><dt>متى يوصلني الرصيد؟</dt>
            <dd>{card ? "على طول بعد ما يتأكد الدفع." : "بعد ما نتأكد من وصول التحويل، عادةً خلال وقت قصير إن شاء الله."}{hasSupport ? " وإذا تأخر تقدر تراسلنا على واتساب من نفس الصفحة." : ""}</dd></div>
            <div><dt>لو فشل التوليد؟</dt>
            <dd>يرجع رصيده لك تلقائيًا.</dd></div>
          </dl>
          <p className="cs-back"><Link href="/jawad-ai">← ارجع للجواد الذكي</Link></p>
        </div>
      </section>

      {step && (
        <div className="cr-modal" role="dialog" aria-modal="true" aria-label="التحويل البنكي">
          <div className="cr-sheet">
            <button type="button" className="cr-x" aria-label="إغلاق" onClick={() => setStep(null)}>✕</button>
            {step === "bank" && order && bank && (
              <>
                <h3>حوّل المبلغ</h3>
                <p className="cr-amount"><Riyal halalas={order.price * 100} size={38} /></p>
                <p className="cr-mute">باقة {order.packName} · يوصلك رصيد {order.credit}</p>
                <div className="cr-bank">
                  <Copy label="اسم صاحب الحساب" value={bank.holder} />
                  <Copy label="البنك" value={bank.bank} />
                  <Copy label="رقم الآيبان" value={bank.iban} />
                  <Copy label="رقم الحساب" value={bank.account} />
                  <Copy label="رمز السويفت" value={bank.swift} />
                </div>
                <p className="cr-mute">حوّل المبلغ، أرسل صورة الإيصال على واتساب، ثم اضغط «تم التحويل» — نضيف الرصيد عادةً خلال ساعة (٨ص–١٢م بتوقيت السعودية)</p>
                {receipt && (
                  <a className="cr-btn cs-wa" href={receipt} target="_blank" rel="noreferrer" onClick={() => track("Lead", { content_name: "whatsapp-receipt" })}>
                    📲 أرسل الإيصال على واتساب
                  </a>
                )}
                {error && <p className="cr-error" role="alert">{error}</p>}
                <button type="button" className="cr-cta" disabled={!!busy} onClick={() => void transferred()}>{busy ? "…" : <span className="cr-cta-main">✅ تم التحويل</span>}</button>
                <p className="cr-mute cs-trust">✅ أي توليد يفشل يرجع رصيده تلقائيًا</p>
              </>
            )}
            {step === "done" && (
              <>
                <h3>وصلنا طلبك ✅</h3>
                <p className="cs-done">بعد قليل إن شاء الله يوصلك الرصيد في حسابك، ونبلغك على الواتساب.</p>
                {support ? (
                  <p className="cs-done-small">
                    إذا طال الوقت، اضغط الرابط وراسلنا أنك حوّلت:
                    <a className="cr-btn cs-wa" href={support} target="_blank" rel="noreferrer" onClick={lead}>💬 راسلنا على واتساب</a>
                  </p>
                ) : null}
                <Link className="cr-btn" href="/jawad-ai">ارجع للجواد الذكي</Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
