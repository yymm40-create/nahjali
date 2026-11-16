"use client";

import { useEffect, useRef, useState } from "react";

// Moyasar's form (Moyasar.js): the card number goes from the buyer's browser straight to Moyasar, never to our server.
const MPF = "https://cdn.moyasar.com/mpf/1.19.0";
// Apple Pay accepts cards from these countries (Moyasar's default is Saudi Arabia only)
const GCC = ["SA", "KW", "IQ", "BH", "AE", "QA", "OM"];

type MoyasarInit = (config: Record<string, unknown>) => void;
const moyasar = () => (window as unknown as { Moyasar?: { init: MoyasarInit } }).Moyasar;

function loadMoyasar(): Promise<void> {
  if (moyasar()) return Promise.resolve();
  if (!document.querySelector(`link[href="${MPF}/moyasar.css"]`)) {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = `${MPF}/moyasar.css`;
    document.head.appendChild(css);
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `${MPF}/moyasar.js`;
    s.async = true;
    s.onload = () => (moyasar() ? resolve() : reject(new Error("no Moyasar")));
    s.onerror = () => reject(new Error("moyasar.js failed"));
    document.head.appendChild(s);
  });
}

const sar = (halalas: number) => (halalas % 100 === 0 ? String(halalas / 100) : (halalas / 100).toFixed(2));

export default function CheckoutForm(p: { amount: number; description: string; kind: string; refId: string; publishableKey: string; callbackUrl: string; back: string; applePay: boolean }) {
  const [err, setErr] = useState("");
  const [ready, setReady] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    loadMoyasar()
      .then(() => {
        moyasar()!.init({
          element: ".mysr-form",
          amount: p.amount,
          currency: "SAR",
          description: p.description,
          publishable_api_key: p.publishableKey,
          callback_url: p.callbackUrl,
          language: "ar",
          methods: p.applePay ? ["applepay", "creditcard"] : ["creditcard"],
          supported_networks: ["mada", "visa", "mastercard"],
          // which purchase this payment is for: the return and the webhook settle it by this, checked against our own record
          metadata: { kind: p.kind, ref: p.refId },
          ...(p.applePay ? { apple_pay: { country: "SA", label: "الجواد الذكي", validate_merchant_url: "https://api.moyasar.com/v1/applepay/initiate", supported_countries: GCC } } : {}),
        });
        setReady(true);
      })
      .catch(() => setErr("ما قدرنا نحمّل نموذج الدفع؛ حدّث الصفحة أو جرّب بعد شوي."));
  }, [p.amount, p.description, p.kind, p.refId, p.publishableKey, p.callbackUrl, p.applePay]);

  return (
    <div className="pl-card co-card">
      <div className="co-sum">
        <span className="co-what">{p.description}</span>
        <b className="co-amount" dir="ltr">
          {sar(p.amount)} <small>SAR</small>
        </b>
      </div>
      <div className="co-form" dir="ltr">
        <div className="mysr-form" />
        {!ready && !err && <p className="co-wait">لحظة، نجهّز نموذج الدفع…</p>}
      </div>
      {err && <p className="pl-err">{err}</p>}
      <p className="ld-note pl-safe">مدى، فيزا، ماستركارد{p.applePay ? "، Apple Pay" : ""} · بيانات بطاقتك تروح لميسّر مباشرة ولا تمر على خوادمنا</p>
      <a className="co-back" href={p.back}>
        رجوع
      </a>
    </div>
  );
}
