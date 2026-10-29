"use client";

// «دورة الجواد الذكي» — the sales page, made for the phone first (most buyers pay from one): the end result, the owner's reel and, right
// under it, ONE big buying panel (the price that climbs with the clock, struck usual price, the gift of زهرات, a count down and a big
// button); then the problem, the three days, what removes the risk and how to pay, as full-width bands instead of boxes; a bar with the
// price and the button stays at the bottom of a phone's screen. The payment: sign in, name and phone, the bank data to copy and
// «تم التحويل» — which tells the owner at once. Public: anyone with the link sees it; paying needs an account.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import AgreeTerms from "@/components/jawad/AgreeTerms";
import Coined from "@/components/Coined";
import Riyal from "@/components/Riyal";
import { COURSE, countdown, embedOf, hasLifetimeAccess, isLadder, offersAt, PRODUCT_ACCESS, PRODUCT_LABEL, type Bank, type Offer, type Product } from "@config/course";
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


/** riyals (49.99) → halalas, without the float's 4998.999… */
const hal = (sar: number) => Math.round(sar * 100);

/** A price drawn the way the whole site draws one: the coin's logo and the amount (no currency word), the usual price struck, the saving. */
function Price({ o, size = 26 }: { o: Offer; size?: number }) {
  return (
    <div className="cr-price">
      <Riyal halalas={hal(o.price)} was={o.was > o.price ? hal(o.was) : null} size={size} className="cr-now" />
    </div>
  );
}

/** The count down as four numbers (days only when there are any). */
function Timer({ ms }: { ms: number }) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const parts: [number, string][] = [[Math.floor(s / 86400), "يوم"], [Math.floor((s % 86400) / 3600), "ساعة"], [Math.floor((s % 3600) / 60), "دقيقة"], [s % 60, "ثانية"]];
  const shown = parts.filter(([n], i) => i > 0 || n > 0);
  return (
    <span className="cr-timer" dir="ltr" role="timer" aria-label={`الوقت المتبقي ${countdown(ms)}`}>
      {shown.map(([n, label]) => (
        <span key={label} className="cr-tick"><b>{String(n).padStart(2, "0")}</b><i>{label}</i></span>
      ))}
    </span>
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

export default function CourseLanding({ s, courseId, title, price, was, serverNow, user, orders, unlocked, buy, loginHref }: { s: PublicCourse; courseId: string; title: string; price: number; was: number; serverNow: number; user: { email: string } | null; orders: OrderView[]; unlocked: Unlocked | null; buy: Product | null; loginHref: string }) {
  const router = useRouter();
  const [skew] = useState(() => serverNow - Date.now());
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + skew), 1000);
    return () => clearInterval(t);
  }, [skew]);
  const ladder = isLadder(s, courseId);
  const cur = useMemo(() => offersAt(s, now, price, was, courseId), [s, now, price, was, courseId]);
  const video = useMemo(() => (s.videoFileUrl ? null : embedOf(s.videoUrl)), [s.videoFileUrl, s.videoUrl]);

  // coming back from signing in (?buy=…): the payment sheet is already open
  const [sheet, setSheet] = useState<{ product: Product; step: "form" | "bank" | "done" } | null>(() => (buy && user && offersAt(s, serverNow, price, was, courseId).offers.some((o) => o.product === buy) ? { product: buy, step: "form" } : null));
  const last = orders[0];
  const [name, setName] = useState(last?.name ?? "");
  const [phone, setPhone] = useState(last?.phone ?? "");
  const [order, setOrder] = useState<OrderView | null>(null);
  const [bank, setBank] = useState<Bank | null>(null);
  const [busy, setBusy] = useState(false);
  // the terms are agreed to before the subscription starts
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");
  const [group, setGroup] = useState("");
  // «عندك كود خصم؟»: the code and the price it gives (checked by the server)
  const [codeText, setCodeText] = useState("");
  const [coded, setCoded] = useState<{ code: string; price: number } | null>(null);
  async function applyCode() {
    setError("");
    setCoded(null);
    if (!codeText.trim()) return;
    try {
      setCoded(await post<{ code: string; price: number }>("/api/course/code", { courseId, code: codeText }));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function pay(product: Product) {
    setError("");
    if (!user) {
      router.push(`${loginHref}?next=${encodeURIComponent(`${COURSE.base}/${courseId}?buy=${product}`)}`);
      return;
    }
    setSheet({ product, step: "form" });
  }
  async function start() {
    if (!sheet) return;
    setBusy(true);
    setError("");
    try {
      const r = await post<{ order: OrderView; bank: Bank }>("/api/course/order", { courseId, name, phone, code: coded?.code, product: sheet.product });
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
  const offerBase = sheet ? cur.offers.find((o) => o.product === sheet.product) : null;
  const offer = offerBase && coded ? { ...offerBase, price: coded.price, was: Math.max(offerBase.was, offerBase.price) } : offerBase;

  // the offer being bought: the one chosen, else the one with a gift, else the first
  const [picked, setPicked] = useState<Product | null>(null);
  const sel = cur.offers.find((o) => o.product === picked) ?? cur.offers.find((o) => o.bonus > 0) ?? cur.offers[0] ?? null;
  const mine = sel ? statusOf(sel.product) : null;
  const canBuy = !!sel && s.payable && mine?.status !== "confirmed" && mine?.status !== "transferred";
  const go = () => sel && pay(sel.product);

  // the bottom bar of a phone gives way while the big panel (or the last call) is on the screen
  const buyRef = useRef<HTMLElement>(null);
  const endRef = useRef<HTMLElement>(null);
  const [atBuy, setAtBuy] = useState(false);
  useEffect(() => {
    const els = [buyRef.current, endRef.current].filter(Boolean) as Element[];
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const seen = new Set<Element>();
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          if (e.isIntersecting) seen.add(e.target);
          else seen.delete(e.target);
        }
        setAtBuy(seen.size > 0);
      },
      { threshold: 0.3 },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [cur.phase]);

  const NUM = ["١", "٢", "٣", "٤", "٥", "٦"];
  const urgency = left !== null && (
    <p className="cr-urgent">
      ⏳ هذا السعر ينتهي بعد <b dir="ltr">{countdown(left)}</b>
      {cur.next ? <> — <Coined text={cur.next} size={13} /></> : null}
    </p>
  );
  const cta = (extra = "") =>
    mine?.status === "confirmed" ? (
      <div className="cr-state ok">✅ اشتراكك مؤكد</div>
    ) : mine?.status === "transferred" ? (
      <div className="cr-state">⏳ تحويلك قيد التأكيد</div>
    ) : (
      <button type="button" className={`cr-cta ${extra}`} disabled={!canBuy} onClick={go}>
        <span className="cr-cta-main">{mine?.status === "started" ? "كمّل الدفع" : "اشترك الآن"}</span>
        <svg className="cr-arrow" width="22" height="22" viewBox="0 0 24 24" aria-hidden><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    );

  return (
    <div className="cr" dir="rtl">
      {unlocked && (
        <section className="cr-ok" aria-live="polite">
          <div className="cr-in">
            <h2>{unlocked.confirmed ? "✅ اشتراكك مؤكد" : "⏳ تحويلك قيد التأكيد"}</h2>
            <p>
              {unlocked.confirmed ? `أهلًا فيك في «${title}».` : "وصلنا طلبك، ونتأكد من التحويل."}{" "}
              {ladder && !unlocked.products.some(hasLifetimeAccess) && unlocked.products.includes("live")
                ? "رابط مجموعة البث المباشر تحت."
                : unlocked.confirmed ? "دورتك جاهزة في «دوراتي»." : "بعد ما يتأكد المالك من التحويل تظهر دورتك في «دوراتي» مباشرة."}
            </p>
            <div className="cr-actions">
              {unlocked.groupLink && <a className="cr-btn cr-primary" href={unlocked.groupLink} target="_blank" rel="noreferrer">{unlocked.confirmed ? "ادخل المجموعة" : "اطلب الانضمام للمجموعة"}</a>}
              {unlocked.recordedLink && unlocked.products.includes("recorded") && <a className="cr-btn" href={unlocked.recordedLink} target="_blank" rel="noreferrer">افتح الدورة المسجلة</a>}
              {unlocked.confirmed && (!ladder || unlocked.products.some(hasLifetimeAccess)) && <Link className="cr-btn cr-primary" href={LEARN.base}>📚 افتح دوراتي</Link>}
            </div>
          </div>
        </section>
      )}

      <header className="cr-hero">
        <div className="cr-in">
          <span className="cr-kicker cr-reveal">{ladder ? `${title} · مباشرة + مسجلة` : "الدورة · مسجلة"}</span>
          <h1 className="cr-reveal" style={{ ["--i" as string]: 1 }}>{s.headline}</h1>
          <p className="cr-sub cr-reveal" style={{ ["--i" as string]: 2 }}>{s.subhead}</p>

          <section className="cr-buy cr-reveal" style={{ ["--i" as string]: 3 }} id="buy" ref={buyRef} aria-label="الاشتراك">
            {cur.phase === "soon" || !sel ? (
              <div className="cr-soon">
                <b>🔔 التسجيل يفتح قريبًا</b>
                <span>مع نزول الريل على حسابي. جهّز نفسك.</span>
              </div>
            ) : (
              <>
                <div className="cr-ribbon">
                  <span>سعر الدورة</span>
                  {left !== null && <Timer ms={left} />}
                </div>
                <div className="cr-buy-body">
                  {cur.offers.length > 1 ? (
                    <div className="cr-choices" role="radiogroup" aria-label="اختر نوع الدورة">
                      {cur.offers.map((o) => {
                        const on = o.product === sel.product;
                        return (
                          <button key={o.product} type="button" role="radio" aria-checked={on} className={`cr-choice${on ? " on" : ""}`} onClick={() => setPicked(o.product)}>
                            <span className="cr-radio" aria-hidden />
                            <span className="cr-ctext">
                              <b>{o.label}</b>
                              <small>{PRODUCT_ACCESS[o.product]}</small>
                              {o.bonus > 0 && <em>🌸 + هدية {o.bonus} زهرة</em>}
                            </span>
                            <span className="cr-cprice">
                              <Riyal halalas={hal(o.price)} size={22} className="cr-cn" />
                              {o.was > o.price && <s dir="ltr">{o.was}</s>}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="cr-single">
                      <h2>{sel.label}</h2>
                      <p className="cr-mute">{PRODUCT_ACCESS[sel.product]}</p>
                      <Price o={sel} size={44} />
                    </div>
                  )}
                  {sel.bonus > 0 && <p className="cr-gift">🌸 {cur.offers.length > 1 ? "مع هذا الخيار هدية" : "هدية معك:"} {sel.bonus} زهرة (= <Coined text={`¤${sel.bonus}`} size={14} /> رصيد مجاني في الجواد)</p>}
                  {cta()}
                  {!s.payable && <p className="cr-urgent">الدفع يفتح بعد قليل.</p>}
                  {urgency}
                  <ul className="cr-trust">
                    <li>🔒 تحويل بنكي مباشر</li>
                    {hasLifetimeAccess(sel.product) && <li>♾️ تسجيل الدورة مدى الحياة</li>}
                    {sel.product !== "recorded" && <li>🎥 حضور مباشر</li>}
                    {hasLifetimeAccess(sel.product) ? <li>📚 تظهر في «دوراتي» بعد التأكيد</li> : <li>💬 رابط مجموعة البث بعد التحويل</li>}
                  </ul>
                </div>
              </>
            )}
          </section>

          {(s.videoFileUrl || video) && (
            <div className="cr-video">
              {s.videoFileUrl ? (
                <video src={s.videoFileUrl} poster={s.posterUrl ?? undefined} controls playsInline preload="metadata" />
              ) : video?.kind === "file" ? (
                <video src={video.url} poster={s.posterUrl ?? undefined} controls playsInline preload="metadata" />
              ) : (
                <iframe src={video?.url} title="مقطع الدورة" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" />
              )}
            </div>
          )}
        </div>
      </header>

      {s.problem && <section className="cr-band">
        <div className="cr-in">
          <h2 className="cr-h" data-k="المشكلة · ٠١">وش المشكلة؟</h2>
          <p className="cr-lead">{s.problem}</p>
        </div>
      </section>}

      {s.days.length > 0 && <section className="cr-band cr-alt">
        <div className="cr-in">
          <h2 className="cr-h" data-k="المحتوى · ٠٢">وش بتتعلم؟</h2>
          <ol className="cr-line">
            {s.days.map((d, i) => (
              <li key={i}>
                <span className="cr-num" aria-hidden>{NUM[i] ?? i + 1}</span>
                <div>
                  <h3>{d.title}</h3>
                  <ul>{d.points.map((p, j) => <li key={j}>{p}</li>)}</ul>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>}

      {s.risks.length > 0 && (
        <section className="cr-band">
          <div className="cr-in">
            <h2 className="cr-h" data-k="الضمان · ٠٣">تشترك وأنت مطمّن</h2>
            <ul className="cr-checks">{s.risks.map((r, i) => <li key={i}><span aria-hidden>✓</span>{r}</li>)}</ul>
          </div>
        </section>
      )}

      {s.terms && (
        <section className="cr-band cr-alt" id="terms">
          <div className="cr-in">
            <h2 className="cr-h" data-k="الشروط · ٠٤">شروط الدورة</h2>
            <p className="cr-lead">{s.terms}</p>
          </div>
        </section>
      )}

      <section className="cr-band cr-alt">
        <div className="cr-in">
          <h2 className="cr-h" data-k="الدفع · ٤ خطوات">كيف تدفع؟</h2>
          <ol className="cr-steps">
            <li><b>١</b>سجّل دخولك في الموقع (عشان نسجّل إيميلك).</li>
            <li><b>٢</b>اكتب اسمك ورقم جوالك، واضغط «اشترك الآن».</li>
            <li><b>٣</b>تظهر لك بيانات الحساب (الآيبان والسويفت): انسخها وحوّل المبلغ.</li>
            <li><b>٤</b>ارجع واضغط «تم التحويل»: بعد ما يتأكد المالك من التحويل تظهر لك الدورة مباشرة في «دوراتي».</li>
          </ol>
        </div>
      </section>

      {cur.phase !== "soon" && sel && !unlocked && (
        <section className="cr-final" ref={endRef} aria-label="ابدأ الآن">
          <div className="cr-in">
            <h2>جاهز تبدأ؟</h2>
            <div className="cr-final-price">
              <span className="cr-mute">{sel.label}</span>
              <Price o={sel} size={34} />
            </div>
            {cta()}
            {urgency}
          </div>
        </section>
      )}

      {cur.phase !== "soon" && sel && !unlocked && canBuy && (
        <div className={`cr-sticky${atBuy ? " hide" : ""}`} aria-hidden={atBuy}>
          <div className="cr-sprice">
            <Riyal halalas={hal(sel.price)} size={22} className="cr-sn" />
            {left !== null && <small dir="ltr">ينتهي بعد {countdown(left)}</small>}
          </div>
          <button type="button" className="cr-cta cr-cta-sm" onClick={go} tabIndex={atBuy ? -1 : 0}>اشترك الآن</button>
        </div>
      )}

      {sheet && (
        <div className="cr-modal" role="dialog" aria-modal="true" aria-label="الدفع">
          <div className="cr-sheet">
            <button type="button" className="cr-x" aria-label="إغلاق" onClick={() => setSheet(null)}>✕</button>
            <ol className="cr-prog" aria-label="خطوات الدفع">
              {["البيانات", "التحويل", "تم"].map((t, i) => {
                const at = sheet.step === "form" ? 0 : sheet.step === "bank" ? 1 : 2;
                return <li key={t} className={i < at ? "past" : i === at ? "now" : ""}><b>{i < at ? "✓" : NUM[i]}</b>{t}</li>;
              })}
            </ol>
            {sheet.step === "form" && (
              <>
                <h3>{PRODUCT_LABEL[sheet.product]}</h3>
                {offer && (
                  <div className="cr-sheet-price">
                    <Price o={offer} size={30} />
                    {offer.bonus > 0 && <p className="cr-gift">🌸 + هدية {offer.bonus} زهرة</p>}
                  </div>
                )}
                <div className="flex gap-2">
                  <input dir="ltr" value={codeText} onChange={(e) => { setCodeText(e.target.value); setCoded(null); }} placeholder="كود الخصم (إن وجد)" maxLength={40} />
                  <button type="button" className="cr-btn" disabled={!codeText.trim()} onClick={() => void applyCode()}>طبّق</button>
                </div>
                {coded && <p className="cr-gift">✅ انطبق الكود، سعرك <Coined text={`¤${coded.price}`} size={14} /></p>}
                <label>الاسم الثلاثي<input value={name} onChange={(e) => setName(e.target.value)} placeholder="كما في حسابك البنكي" autoComplete="name" maxLength={80} /></label>
                <label>رقم الجوال (واتساب)<input dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05xxxxxxxx" autoComplete="tel" /></label>
                <label>الإيميل<input dir="ltr" value={user?.email ?? ""} readOnly /></label>
                {error && <p className="cr-error" role="alert">{error}</p>}
                {s.terms && <p className="cr-mute">⚠️ {s.terms}</p>}
                <AgreeTerms on={agree} onChange={setAgree} what="الاشتراك" />
                <button type="button" className="cr-cta" disabled={busy || !agree || name.trim().length < 2 || phone.trim().length < 8} onClick={() => void start()}>{busy ? "…" : <span className="cr-cta-main">التالي: بيانات التحويل</span>}</button>
              </>
            )}
            {sheet.step === "bank" && order && bank && (
              <>
                <h3>حوّل المبلغ</h3>
                <p className="cr-amount"><Riyal halalas={hal(order.amount)} size={38} /></p>
                <p className="cr-mute">{PRODUCT_LABEL[order.product]}{order.bonus > 0 ? ` · + ${order.bonus} زهرة هدية` : ""} · السعر محفوظ لك {countdown(lock)}</p>
                <div className="cr-bank">
                  <Copy label="اسم صاحب الحساب" value={bank.holder} />
                  <Copy label="البنك" value={bank.bank} />
                  <Copy label="رقم الآيبان" value={bank.iban} />
                  <Copy label="رقم الحساب" value={bank.account} />
                  <Copy label="رمز السويفت" value={bank.swift} />
                </div>
                <p className="cr-mute">حوّل ثم ارجع هنا واضغط الزر. لا تضغطه قبل ما تحوّل.</p>
                {error && <p className="cr-error" role="alert">{error}</p>}
                <button type="button" className="cr-cta" disabled={busy} onClick={() => void transferred()}>{busy ? "…" : <span className="cr-cta-main">✅ تم التحويل</span>}</button>
              </>
            )}
            {sheet.step === "done" && (
              <>
                <h3>وصلنا طلبك ✅</h3>
                <p>راح نتأكد من التحويل، وبعدها {hasLifetimeAccess(sheet.product) ? "تظهر لك الدورة مباشرة في «دوراتي»" : "يوصلك موعد البث المباشر في المجموعة"}{phone ? <> (وقد نتواصل معك على <b dir="ltr">{phone}</b>)</> : null}.</p>
                {group && <a className="cr-cta" href={group} target="_blank" rel="noreferrer"><span className="cr-cta-main">اطلب الانضمام لمجموعة الواتساب</span></a>}
                <button type="button" className="cr-btn" onClick={() => setSheet(null)}>تمام</button>
              </>
            )}
          </div>
        </div>
      )}
      <p className="cr-foot"><Link href={COURSE.base}>← كل الدورات</Link> · <Link href="/jawad-ai">الجواد الذكي</Link></p>
    </div>
  );
}
