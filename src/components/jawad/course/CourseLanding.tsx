"use client";

// «دورة الجواد الذكي» — the sales page: the end result first, the owner's reel, what the three days hold, what removes the risk, the
// price that climbs with the clock (struck usual price, the gift of زهرات, a count down), and the payment: sign in, name and phone,
// the bank data to copy, and «تم التحويل» — which tells the owner at once. Public: anyone with the link sees it; paying needs an account.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Coined from "@/components/Coined";
import Riyal from "@/components/Riyal";
import { COURSE, countdown, embedOf, offersAt, PRODUCT_LABEL, type Bank, type Offer, type Product } from "@config/course";
import { LEARN } from "@config/learn";
import type { PublicCourse } from "@/lib/course/settings";

export interface OrderView {
  id: string;
  product: Product;
  status: "started" | "transferred" | "confirmed" | "rejected";
  amount: number;
  bonus: number;
  lockedUntil: string;
  name: string;
  phone: string;
}
export interface Unlocked {
  /** the owner has seen the money (else: the transfer is waiting for him) */
  confirmed: boolean;
  products: Product[];
  groupLink: string;
  recordedLink: string;
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(j.error ?? "تعذّر تنفيذ الطلب.");
  return j;
}


/** A price drawn the way the whole site draws one: the coin's logo and the amount (no currency word), the usual price struck, the saving. */
function Price({ o }: { o: Offer }) {
  return (
    <div className="cr-price">
      <Riyal halalas={o.price * 100} was={o.was > o.price ? o.was * 100 : null} size={26} className="cr-now" />
    </div>
  );
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

export default function CourseLanding({ s, serverNow, user, orders, unlocked, buy, loginHref }: { s: PublicCourse; serverNow: number; user: { email: string } | null; orders: OrderView[]; unlocked: Unlocked | null; buy: Product | null; loginHref: string }) {
  const router = useRouter();
  const [skew] = useState(() => serverNow - Date.now());
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + skew), 1000);
    return () => clearInterval(t);
  }, [skew]);
  const cur = useMemo(() => offersAt(s, now), [s, now]);
  const video = useMemo(() => (s.videoFileUrl ? null : embedOf(s.videoUrl)), [s.videoFileUrl, s.videoUrl]);

  // coming back from signing in (?buy=…): the payment sheet is already open
  const [sheet, setSheet] = useState<{ product: Product; step: "form" | "bank" | "done" } | null>(() => (buy && user && offersAt(s, serverNow).offers.some((o) => o.product === buy) ? { product: buy, step: "form" } : null));
  const last = orders[0];
  const [name, setName] = useState(last?.name ?? "");
  const [phone, setPhone] = useState(last?.phone ?? "");
  const [order, setOrder] = useState<OrderView | null>(null);
  const [bank, setBank] = useState<Bank | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [group, setGroup] = useState("");

  function pay(product: Product) {
    setError("");
    if (!user) {
      router.push(`${loginHref}?next=${encodeURIComponent(`${COURSE.base}?buy=${product}`)}`);
      return;
    }
    setSheet({ product, step: "form" });
  }
  async function start() {
    if (!sheet) return;
    setBusy(true);
    setError("");
    try {
      const r = await post<{ order: OrderView; bank: Bank }>("/api/course/order", { product: sheet.product, name, phone });
      setOrder(r.order);
      setBank(r.bank);
      setSheet({ ...sheet, step: "bank" });
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
      const r = await post<{ groupLink?: string }>("/api/course/transferred", { orderId: order.id });
      setGroup(r.groupLink ?? "");
      setSheet((x) => (x ? { ...x, step: "done" } : x));
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const statusOf = (p: Product) => orders.find((o) => o.product === p || (o.product === "combo" && o.status === "confirmed"));
  const left = cur.endsAt ? cur.endsAt - now : null;
  const lock = order ? Math.max(0, new Date(order.lockedUntil).getTime() - now) : 0;
  const offer = sheet ? cur.offers.find((o) => o.product === sheet.product) : null;

  return (
    <div className="cr" dir="rtl">
      {unlocked && (
        <section className="cr-sec cr-ok" aria-live="polite">
          <h2>{unlocked.confirmed ? "✅ اشتراكك مؤكد" : "⏳ تحويلك قيد التأكيد"}</h2>
          <p>
            {unlocked.confirmed ? `أهلًا فيك في ${COURSE.name}.` : "وصلنا طلبك، ونتأكد من التحويل."}{" "}
            {unlocked.groupLink ? "اطلب الانضمام لمجموعة الواتساب من هنا، ويقبلك المالك بعد التأكد من التحويل:" : "بنرسل لك رابط المجموعة قريبًا."}
          </p>
          <div className="cr-actions">
            {unlocked.groupLink && <a className="cr-btn cr-primary" href={unlocked.groupLink} target="_blank" rel="noreferrer">{unlocked.confirmed ? "ادخل المجموعة" : "اطلب الانضمام للمجموعة"}</a>}
            {unlocked.recordedLink && unlocked.products.includes("recorded") && <a className="cr-btn" href={unlocked.recordedLink} target="_blank" rel="noreferrer">افتح الدورة المسجلة</a>}
            {unlocked.confirmed && <Link className="cr-btn cr-primary" href={LEARN.base}>📚 افتح دروسي</Link>}
          </div>
        </section>
      )}

      <header className="cr-hero">
        <span className="cr-eyebrow">{COURSE.name} · ٣ أيام · مباشرة ومسجلة</span>
        <h1>{s.headline}</h1>
        <p>{s.subhead}</p>
        {cur.phase !== "soon" && left !== null && (
          <div className="cr-clock" role="timer" aria-label="الوقت المتبقي على السعر">⏳ السعر ينتهي بعد <b dir="ltr">{countdown(left)}</b></div>
        )}
        {cur.phase === "soon" && <div className="cr-clock">🔔 التسجيل يفتح قريبًا مع نزول الريل</div>}
        {cur.phase !== "soon" && <a className="cr-btn cr-primary cr-big" href="#price">اشترك الآن</a>}
      </header>

      {(s.videoFileUrl || video) && (
        <section className="cr-sec cr-video">
          {s.videoFileUrl ? (
            <video src={s.videoFileUrl} poster={s.posterUrl ?? undefined} controls playsInline preload="metadata" />
          ) : video?.kind === "file" ? (
            <video src={video.url} poster={s.posterUrl ?? undefined} controls playsInline preload="metadata" />
          ) : (
            <iframe src={video?.url} title="مقطع الدورة" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" />
          )}
        </section>
      )}

      <section className="cr-sec">
        <h2>وش المشكلة؟</h2>
        <p>{s.problem}</p>
      </section>

      <section className="cr-sec">
        <h2>وش بتتعلم في ٣ أيام</h2>
        <div className="cr-days">
          {s.days.map((d, i) => (
            <article key={i} className="cr-day">
              <h3>{d.title}</h3>
              <ul>{d.points.map((p, j) => <li key={j}>{p}</li>)}</ul>
            </article>
          ))}
        </div>
      </section>

      {s.risks.length > 0 && (
        <section className="cr-sec">
          <h2>تشترك وأنت مطمّن</h2>
          <ul className="cr-risks">{s.risks.map((r, i) => <li key={i}>✅ {r}</li>)}</ul>
        </section>
      )}

      <section className="cr-sec" id="price">
        <h2>الأسعار</h2>
        {cur.phase === "soon" ? (
          <p className="cr-muted">التسجيل ما بدأ للحين. ترقّب نزول الريل على حسابي.</p>
        ) : (
          <>
            <p className="cr-muted">{cur.phase === "A" ? "عرض أول يوم: الدورة كاملة (مباشرة + مسجلة) بسعر واحد." : cur.phase === "B" ? "اليوم الثاني: اختر المباشرة أو المسجلة." : "الأسعار الحالية."} {cur.next && left !== null ? <>(<Coined text={cur.next} size={14} />)</> : null}</p>
            <div className="cr-offers">
              {cur.offers.map((o) => {
                const mine = statusOf(o.product);
                return (
                  <article key={o.product} className="cr-offer">
                    <h3>{o.label}</h3>
                    {o.product === "combo" && <p className="cr-muted">حضور مباشر + التسجيل مدى الحياة.</p>}
                    {o.product === "live" && <p className="cr-muted">حضور مباشر، والتسجيل لك مدى الحياة.</p>}
                    {o.product === "recorded" && <p className="cr-muted">تشوفها بوقتك، مدى الحياة.</p>}
                    <Price o={o} />
                    {o.bonus > 0 && <p className="cr-gift">🌸 هدية: {o.bonus} زهرة (= <Coined text={`¤${o.bonus}`} size={14} /> رصيد مجاني في الجواد)</p>}
                    {mine?.status === "confirmed" ? (
                      <span className="cr-state ok">✅ اشتراكك مؤكد</span>
                    ) : mine?.status === "transferred" ? (
                      <span className="cr-state">⏳ تحويلك قيد التأكيد</span>
                    ) : (
                      <button type="button" className="cr-btn cr-primary" disabled={!s.payable} onClick={() => pay(o.product)}>{mine?.status === "started" ? "كمّل الدفع" : "ادفع الآن"}</button>
                    )}
                  </article>
                );
              })}
            </div>
            {!s.payable && <p className="cr-muted">الدفع يفتح بعد قليل.</p>}
          </>
        )}
      </section>

      <section className="cr-sec">
        <h2>كيف تدفع؟</h2>
        <ol className="cr-steps">
          <li>سجّل دخولك في الموقع (عشان نسجّل إيميلك).</li>
          <li>اكتب اسمك ورقم جوالك، واضغط «ادفع الآن».</li>
          <li>تظهر لك بيانات الحساب (الآيبان والسويفت) وتنسخها وتحوّل المبلغ.</li>
          <li>ارجع واضغط «تم التحويل»: يظهر لك رابط مجموعة الواتساب، ويقبلك المالك فيها بعد التأكد من التحويل.</li>
        </ol>
      </section>

      {cur.phase !== "soon" && !unlocked && (
        <div className="cr-sticky">
          <span>{left !== null ? <>⏳ <b dir="ltr">{countdown(left)}</b></> : "الأسعار الحالية"}</span>
          <a className="cr-btn cr-primary" href="#price">اشترك</a>
        </div>
      )}

      {sheet && (
        <div className="cr-modal" role="dialog" aria-modal="true" aria-label="الدفع">
          <div className="cr-sheet">
            <button type="button" className="cr-x" aria-label="إغلاق" onClick={() => setSheet(null)}>✕</button>
            {sheet.step === "form" && (
              <>
                <h3>{PRODUCT_LABEL[sheet.product]}</h3>
                {offer && <Price o={offer} />}
                <label>الاسم الثلاثي<input value={name} onChange={(e) => setName(e.target.value)} placeholder="كما في حسابك البنكي" autoComplete="name" maxLength={80} /></label>
                <label>رقم الجوال (واتساب)<input dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05xxxxxxxx" autoComplete="tel" /></label>
                <label>الإيميل<input dir="ltr" value={user?.email ?? ""} readOnly /></label>
                {error && <p className="cr-error" role="alert">{error}</p>}
                <button type="button" className="cr-btn cr-primary" disabled={busy || name.trim().length < 2 || phone.trim().length < 8} onClick={() => void start()}>{busy ? "…" : "ادفع الآن"}</button>
              </>
            )}
            {sheet.step === "bank" && order && bank && (
              <>
                <h3>حوّل المبلغ</h3>
                <p className="cr-amount"><Riyal halalas={order.amount * 100} size={34} /></p>
                <p className="cr-muted">{PRODUCT_LABEL[order.product]}{order.bonus > 0 ? ` · + ${order.bonus} زهرة هدية` : ""} · السعر محفوظ لك {countdown(lock)}</p>
                <div className="cr-bank">
                  <Copy label="اسم صاحب الحساب" value={bank.holder} />
                  <Copy label="البنك" value={bank.bank} />
                  <Copy label="رقم الآيبان" value={bank.iban} />
                  <Copy label="رقم الحساب" value={bank.account} />
                  <Copy label="رمز السويفت" value={bank.swift} />
                </div>
                <p className="cr-muted">حوّل ثم ارجع هنا واضغط الزر. لا تضغطه قبل ما تحوّل.</p>
                {error && <p className="cr-error" role="alert">{error}</p>}
                <button type="button" className="cr-btn cr-primary" disabled={busy} onClick={() => void transferred()}>{busy ? "…" : "✅ تم التحويل"}</button>
              </>
            )}
            {sheet.step === "done" && (
              <>
                <h3>وصلنا طلبك ✅</h3>
                <p>راح نتأكد من التحويل ونتواصل معك على الواتساب {phone ? <b dir="ltr">{phone}</b> : null}. الحين اطلب الانضمام لمجموعة الدورة، ويقبلك المالك بعد ما يتأكد من التحويل.</p>
                {group && <a className="cr-btn cr-primary" href={group} target="_blank" rel="noreferrer">اطلب الانضمام لمجموعة الواتساب</a>}
                <button type="button" className="cr-btn" onClick={() => setSheet(null)}>تمام</button>
              </>
            )}
          </div>
        </div>
      )}
      <p className="cr-foot"><Link href="/jawad-ai">الجواد الذكي</Link></p>
    </div>
  );
}
