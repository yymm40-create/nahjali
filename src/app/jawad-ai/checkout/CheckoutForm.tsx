"use client";

import { useEffect, useRef, useState } from "react";

// Moyasar's form (Moyasar.js): the card number goes from the buyer's browser straight to Moyasar, never to our server.
const MPF = "https://cdn.moyasar.com/mpf/1.19.0";
// Apple Pay's label goes to Moyasar as the merchant's display_name, which takes ASCII only: an Arabic label fails the
// merchant check and the Apple Pay sheet closes as soon as it opens (16 Nov 2026).
// Apple Pay accepts cards from these countries (Moyasar's default is Saudi Arabia only)
const GCC = ["SA", "KW", "IQ", "BH", "AE", "QA", "OM"];

type MoyasarInit = (config: Record<string, unknown>) => void;
const moyasar = () => (window as unknown as { Moyasar?: { init: MoyasarInit } }).Moyasar;

// TEMPORARY diagnosis of Apple Pay closing at once (16 Nov 2026): every step Apple Pay reports (the session's options,
// the merchant check's answer, a cancel and its sessionError) goes to /api/checkout/applepay-log, read in the server log.
function diagnoseApplePay() {
  const w = window as unknown as { ApplePaySession?: (new (v: number, r: unknown) => EventTarget & Record<string, unknown>) & { __diag?: boolean } };
  const Base = w.ApplePaySession;
  if (!Base || Base.__diag) return;
  const t0 = Date.now();
  const log = (step: string, data?: unknown) => {
    try {
      const body = JSON.stringify({ step, ms: Date.now() - t0, host: location.host, data });
      if (!navigator.sendBeacon?.("/api/checkout/applepay-log", body)) void fetch("/api/checkout/applepay-log", { method: "POST", body, keepalive: true });
    } catch {
      /* diagnosis only */
    }
  };
  const err = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message}` : String(e));
  class Diag extends (Base as unknown as new (v: number, r: unknown) => Record<string, unknown> & EventTarget) {
    constructor(v: number, r: unknown) {
      log("new", { v, r });
      try {
        super(v, r);
      } catch (e) {
        log("new-failed", err(e));
        throw e;
      }
      const self = this as unknown as Record<string, (...a: unknown[]) => unknown>;
      for (const m of ["completeMerchantValidation", "completePayment", "abort", "begin"]) {
        const f = self[m];
        if (typeof f === "function")
          self[m] = (...a: unknown[]) => {
            const d = a[0] as Record<string, unknown> | undefined;
            log(m, m === "completeMerchantValidation" ? { keys: d ? Object.keys(d) : null, domainName: d?.domainName, displayName: d?.displayName } : a[0]);
            try {
              return f.apply(this, a);
            } catch (e) {
              log(`${m}-threw`, err(e));
              throw e;
            }
          };
      }
      this.addEventListener("cancel", (e) => log("cancel", (e as unknown as { sessionError?: unknown }).sessionError ?? null));
      this.addEventListener("validatemerchant", (e) => log("validatemerchant", (e as unknown as { validationURL?: string }).validationURL));
      this.addEventListener("paymentauthorized", () => log("paymentauthorized"));
    }
  }
  Object.assign(Diag, { canMakePayments: (Base as unknown as { canMakePayments: () => boolean }).canMakePayments, supportsVersion: (Base as unknown as { supportsVersion: (n: number) => boolean }).supportsVersion, STATUS_SUCCESS: 0, STATUS_FAILURE: 1, __diag: true });
  for (const k of Object.getOwnPropertyNames(Base)) if (!(k in Diag)) try { Object.defineProperty(Diag, k, Object.getOwnPropertyDescriptor(Base, k)!); } catch { /* read-only */ }
  w.ApplePaySession = Diag as unknown as typeof Base;
  window.addEventListener("error", (e) => log("window-error", `${e.message}`));
  window.addEventListener("unhandledrejection", (e) => log("rejection", err(e.reason)));
  log("ready");
}

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
    if (p.applePay) diagnoseApplePay();
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
          ...(p.applePay ? { apple_pay: { country: "SA", label: "JAWAD AI", validate_merchant_url: "https://api.moyasar.com/v1/applepay/initiate", supported_countries: GCC } } : {}),
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
