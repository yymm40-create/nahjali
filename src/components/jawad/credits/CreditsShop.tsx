"use client";

// «اشحن رصيدك» — the packages of balance, made for the phone first: pick one (the featured one is chosen to start with), one big
// button, then the same three steps as the course: name and phone → the bank data to copy → «تم التحويل». After that: «يوصلك الرصيد
// بعد قليل إن شاء الله»; if it takes long, a WhatsApp chat with the owner, the message already written.

import Link from "next/link";
import AgreeTerms from "@/components/jawad/AgreeTerms";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Riyal from "@/components/Riyal";
import { bonusPct, CREDITS, type Pack } from "@config/credits";
import type { Bank } from "@config/course";

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

const NUM = ["١", "٢", "٣"];

export default function CreditsShop({
  packs, featured, payable, hasSupport, user, balance, owner, waiting, initialPack, loginHref, lastName, lastPhone,
}: {
  packs: Pack[];
  featured: string;
  payable: boolean;
  hasSupport: boolean;
  user: { email: string } | null;
  /** null for the owners (no limit) or when it can't be read */
  balance: number | null;
  owner: boolean;
  waiting: Waiting[];
  initialPack: string | null;
  loginHref: string;
  lastName: string;
  lastPhone: string;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState(initialPack ?? featured);
  const sel = packs.find((p) => p.id === picked) ?? packs[0];
  // coming back from signing in (?pack=…): the payment sheet is already open
  const [step, setStep] = useState<"form" | "bank" | "done" | null>(() => (initialPack && user ? "form" : null));
  const [name, setName] = useState(lastName);
  const [phone, setPhone] = useState(lastPhone);
  const [order, setOrder] = useState<Order | null>(null);
  const [bank, setBank] = useState<Bank | null>(null);
  const [support, setSupport] = useState("");
  const [busy, setBusy] = useState(false);
  // the terms are read (or at least agreed to) before any money moves
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");

  function buy() {
    setError("");
    if (!user) {
      router.push(`${loginHref}?next=${encodeURIComponent(`${CREDITS.base}?pack=${sel.id}`)}`);
      return;
    }
    setStep("form");
  }
  async function start() {
    setBusy(true);
    setError("");
    try {
      const r = await post<{ order: Order; bank: Bank }>("/api/credits/order", { pack: sel.id, name, phone });
      setOrder(r.order);
      setBank(r.bank);
      setStep("bank");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function transferred() {
    if (!order) return;
    setBusy(true);
    setError("");
    try {
      const r = await post<{ support: string }>("/api/credits/transferred", { orderId: order.id });
      setSupport(r.support ?? "");
      setStep("done");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // the bottom bar of a phone gives way while the packages are on the screen
  const listRef = useRef<HTMLElement>(null);
  const [atList, setAtList] = useState(false);
  useEffect(() => {
    const el = listRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setAtList(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const cta = (extra = "") => (
    <button type="button" className={`cr-cta ${extra}`} disabled={!payable} onClick={buy}>
      <span className="cr-cta-main">اشحن الآن</span>
      <span className="cs-cta-price" dir="ltr"><Riyal halalas={sel.price * 100} size={20} /></span>
    </button>
  );

  return (
    <div className="cr cs" dir="rtl">
      <header className="cr-hero cs-hero">
        <div className="cr-in">
          <span className="cr-eyebrow"><i className="cr-dot" aria-hidden />رصيد الجواد الذكي</span>
          <h1>اشحن رصيدك وابدأ تصنع</h1>
          <p className="cr-sub">صور وفيديوهات وأصوات وتصاميم بالذكاء الاصطناعي. ادفع مرة وحدة بتحويل بنكي، وكل ما زادت الباقة زاد رصيدك المجاني.</p>
          {user && (
            <p className="cs-balance">
              رصيدك الحالي: {owner ? <b dir="ltr">∞</b> : <Riyal halalas={balance ?? 0} size={18} className="cs-bal" />}
            </p>
          )}
        </div>
      </header>

      {waiting.length > 0 && (
        <section className="cs-waiting">
          <div className="cr-in">
            {waiting.map((w) => (
              <p key={w.id}>
                ⏳ طلب شحن باقة «{w.packName}» قيد التأكيد. يوصلك الرصيد بعد قليل إن شاء الله.
                {w.support && <> <a href={w.support} target="_blank" rel="noreferrer">طال الوقت؟ راسلنا على واتساب</a></>}
              </p>
            ))}
          </div>
        </section>
      )}

      <section className="cs-packs" ref={listRef} aria-label="الباقات">
        <div className="cr-in cs-in">
          <div className="cs-list" role="radiogroup" aria-label="اختر الباقة" style={{ ["--n" as string]: packs.length }}>
            {packs.map((p) => {
              const on = p.id === sel.id;
              const star = p.id === featured;
              const bonus = bonusPct(p);
              return (
                <button key={p.id} type="button" role="radio" aria-checked={on} className={`cs-pack${on ? " on" : ""}${star ? " star" : ""}`} onClick={() => setPicked(p.id)}>
                  {p.tag && <span className="cs-tag">{p.tag}</span>}
                  <span className="cr-radio" aria-hidden />
                  <span className="cs-name">
                    <b>{p.name}</b>
                    {p.note && <small>{p.note}</small>}
                  </span>
                  <span className="cs-price"><Riyal halalas={p.price * 100} size={24} className="cs-pn" /></span>
                  <span className="cs-get">
                    يوصلك رصيد <Riyal halalas={p.credit * 100} size={15} className="cs-gn" />
                    {bonus > 0 && <em>+{bonus}٪ مجانًا</em>}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="cs-buy">
            {cta()}
            {!payable && <p className="cr-urgent">الدفع يفتح بعد قليل إن شاء الله.</p>}
            <ul className="cr-trust">
              <li>🔒 تحويل بنكي مباشر</li>
              <li>⚡ يوصلك الرصيد بعد التأكيد</li>
              <li>↩️ التوليد الفاشل يرجع رصيده</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="cr-band cr-alt">
        <div className="cr-in">
          <h2 className="cr-h">كيف تشحن؟ ٣ خطوات</h2>
          <ol className="cr-steps">
            <li><b>١</b>اختر الباقة واضغط «اشحن الآن»، واكتب اسمك وجوالك.</li>
            <li><b>٢</b>تظهر لك بيانات الحساب: انسخها وحوّل المبلغ، ثم اضغط «تم التحويل».</li>
            <li><b>٣</b>نتأكد من التحويل وينضاف الرصيد لحسابك بعد قليل إن شاء الله.</li>
          </ol>
        </div>
      </section>

      <section className="cr-band">
        <div className="cr-in">
          <h2 className="cr-h">أسئلة سريعة</h2>
          <dl className="cs-faq">
            <dt>وش أقدر أسوي بالرصيد؟</dt>
            <dd>كل أقسام الجواد: صور، فيديو، أصوات وموسيقى، أفلام، مونتاج حيدرة، المحتوى مع محمد باقر، التصاميم مع كاظم، وتحرير الصور مع زهراء. سعر كل عملية يظهر لك قبل ما تضغط «توليد».</dd>
            <dt>متى يوصلني الرصيد؟</dt>
            <dd>بعد ما نتأكد من وصول التحويل، عادةً خلال وقت قصير إن شاء الله.{hasSupport ? " وإذا طال الوقت تقدر تراسلنا على واتساب من نفس الصفحة." : ""}</dd>
            <dt>لو فشل التوليد؟</dt>
            <dd>يرجع رصيده لك تلقائيًا.</dd>
          </dl>
          <p className="cs-back"><Link href="/jawad-ai">← ارجع للجواد الذكي</Link></p>
        </div>
      </section>

      {!step && (
        <div className={`cr-sticky${atList ? " hide" : ""}`} aria-hidden={atList}>
          <div className="cr-sprice">
            <span className="cs-sname">باقة {sel.name}</span>
            <Riyal halalas={sel.price * 100} size={22} className="cr-sn" />
          </div>
          <button type="button" className="cr-cta cr-cta-sm" disabled={!payable} onClick={buy} tabIndex={atList ? -1 : 0}>اشحن الآن</button>
        </div>
      )}

      {step && (
        <div className="cr-modal" role="dialog" aria-modal="true" aria-label="الدفع">
          <div className="cr-sheet">
            <button type="button" className="cr-x" aria-label="إغلاق" onClick={() => setStep(null)}>✕</button>
            <ol className="cr-prog" aria-label="خطوات الدفع">
              {["البيانات", "التحويل", "تم"].map((t, i) => {
                const at = step === "form" ? 0 : step === "bank" ? 1 : 2;
                return <li key={t} className={i < at ? "past" : i === at ? "now" : ""}><b>{i < at ? "✓" : NUM[i]}</b>{t}</li>;
              })}
            </ol>
            {step === "form" && (
              <>
                <h3>باقة {sel.name}</h3>
                <div className="cs-sheet-sum">
                  <span>تحوّل</span>
                  <Riyal halalas={sel.price * 100} size={26} className="cs-sum-n" />
                  <span>ويوصلك رصيد</span>
                  <Riyal halalas={sel.credit * 100} size={26} className="cs-sum-n" />
                </div>
                <label>الاسم الثلاثي<input value={name} onChange={(e) => setName(e.target.value)} placeholder="كما في حسابك البنكي" autoComplete="name" maxLength={80} /></label>
                <label>رقم الجوال (واتساب)<input dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05xxxxxxxx" autoComplete="tel" /></label>
                <label>الإيميل<input dir="ltr" value={user?.email ?? ""} readOnly /></label>
                {error && <p className="cr-error" role="alert">{error}</p>}
                <AgreeTerms on={agree} onChange={setAgree} what="الشحن" />
                <button type="button" className="cr-cta" disabled={busy || !agree || name.trim().length < 2 || phone.trim().length < 8} onClick={() => void start()}>{busy ? "…" : <span className="cr-cta-main">التالي: بيانات التحويل</span>}</button>
              </>
            )}
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
                <p className="cr-mute">حوّل ثم اضغط الزر. لا تضغطه قبل ما تحوّل.</p>
                {error && <p className="cr-error" role="alert">{error}</p>}
                <button type="button" className="cr-cta" disabled={busy} onClick={() => void transferred()}>{busy ? "…" : <span className="cr-cta-main">✅ تم التحويل</span>}</button>
              </>
            )}
            {step === "done" && (
              <>
                <h3>وصلنا طلبك ✅</h3>
                <p className="cs-done">بعد قليل إن شاء الله يوصلك الرصيد في حسابك، ونبلغك على الواتساب.</p>
                {support ? (
                  <p className="cs-done-small">
                    إذا طال الوقت، اضغط الرابط وراسلنا أنك حوّلت:
                    <a className="cr-btn cs-wa" href={support} target="_blank" rel="noreferrer">💬 راسلنا على واتساب</a>
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
