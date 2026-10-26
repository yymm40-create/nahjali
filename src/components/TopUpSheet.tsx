"use client";

// «خلص رصيدك» (the owner, 26 October 2026): wherever on the site an operation is refused because the wallet is short
// (a picture, a video, a robot's reply, a student's step…), no bare error — a sheet says what it costs and offers to pay
// exactly that («ادفع ¤N بس», a top-up of exactly-what-is-missing, exact-<riyals>) or to pick a package. It watches every
// answer the site's own API gives: a 402 that carries `topup` ({ need, balance, what } in halalas, src/lib/api.ts
// shortBalance), or an older one whose message speaks of the balance. The payment opens in a new tab, so the work on
// this page stays as it is.

import { useEffect, useState } from "react";
import { CREDITS, exactSar } from "@config/credits";
import Riyal from "@/components/Riyal";

interface Ask {
  /** riyals to pay to cover it (0: unknown — the packages only) */
  sar: number;
  what: string;
  /** halalas the operation costs, when known */
  need: number;
}

const EVENT = "jw:topup";
let patched = false;

function watchFetch() {
  if (patched || typeof window === "undefined") return;
  patched = true;
  const plain = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const res = await plain(...args);
    if (res.status === 402) {
      const url = typeof args[0] === "string" ? args[0] : args[0] instanceof URL ? args[0].href : args[0].url;
      if (url.startsWith("/") || url.startsWith(window.location.origin)) {
        void res
          .clone()
          .json()
          .then((b: { error?: unknown; topup?: { need?: unknown; balance?: unknown; what?: unknown } }) => {
            const t = b?.topup;
            const msg = typeof b?.error === "string" ? b.error : "";
            if (t && Number(t.need) > 0) {
              const need = Number(t.need);
              const balance = Number(t.balance) || 0;
              window.dispatchEvent(new CustomEvent<Ask>(EVENT, { detail: { need, sar: exactSar(need - Math.max(0, balance)), what: typeof t.what === "string" ? t.what : "" } }));
            } else if (/رصيد/.test(msg) && !/الفريق/.test(msg)) {
              window.dispatchEvent(new CustomEvent<Ask>(EVENT, { detail: { need: 0, sar: 0, what: "" } }));
            }
          })
          .catch(() => {});
      }
    }
    return res;
  };
}

export default function TopUpSheet() {
  const [ask, setAsk] = useState<Ask | null>(null);
  useEffect(() => {
    watchFetch();
    const on = (e: Event) => setAsk((e as CustomEvent<Ask>).detail);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  useEffect(() => {
    if (!ask) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAsk(null);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [ask]);
  if (!ask) return null;

  const exactHref = `${CREDITS.base}?pack=exact-${ask.sar}${ask.what ? `&for=${encodeURIComponent(ask.what)}` : ""}`;
  return (
    <div role="dialog" aria-modal="true" aria-label="خلص رصيدك" dir="rtl" onClick={() => setAsk(null)} style={{ position: "fixed", inset: 0, zIndex: 2147483000, background: "rgba(8, 6, 24, 0.62)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "16px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, borderRadius: 24, padding: "22px 20px calc(20px + env(safe-area-inset-bottom, 0px))", background: "linear-gradient(160deg, #2a1259 0%, #3b0f4a 55%, #4a1622 100%)", color: "#fff", boxShadow: "0 24px 60px rgba(0,0,0,.45)", display: "flex", flexDirection: "column", gap: 12, textAlign: "center", marginBlock: "auto" }}>
        <div style={{ fontSize: 40, lineHeight: 1 }} aria-hidden>🪙</div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>ترى خلص رصيدك</h2>
        {ask.sar > 0 ? (
          <p style={{ margin: 0, color: "rgba(255,255,255,.8)", lineHeight: 1.7 }}>
            {ask.what ? `تكلفة ${ask.what}` : "تكلفة هالعملية"} تقريبًا <Riyal halalas={ask.need} size={16} />. تبي تعبّي بمقدارها بس؟
          </p>
        ) : (
          <p style={{ margin: 0, color: "rgba(255,255,255,.8)", lineHeight: 1.7 }}>اشحن رصيدك وكمّل من نفس المكان.</p>
        )}
        {ask.sar > 0 && (
          <a href={exactHref} target="_blank" rel="noreferrer" onClick={() => setAsk(null)} style={{ display: "block", borderRadius: 16, padding: "14px 16px", background: "#ff8a1f", color: "#fff", fontWeight: 800, fontSize: 18, textDecoration: "none" }}>
            ادفع <Riyal halalas={ask.sar * 100} size={18} /> بس ←
          </a>
        )}
        <a href={CREDITS.base} target="_blank" rel="noreferrer" onClick={() => setAsk(null)} style={{ display: "block", borderRadius: 16, padding: "12px 16px", background: "rgba(255,255,255,.12)", color: "#fff", fontWeight: 700, textDecoration: "none" }}>
          شوف الباقات (رصيد مجاني أكثر)
        </a>
        <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,.65)" }}>تنفتح صفحة الدفع في تبويب جديد، وشغلك هنا يظل مثل ما هو. بعد الدفع ارجع واضغط مرة ثانية.</p>
        <button type="button" onClick={() => setAsk(null)} style={{ background: "none", border: 0, color: "rgba(255,255,255,.7)", fontWeight: 700, padding: 6, cursor: "pointer" }}>لاحقًا</button>
      </div>
    </div>
  );
}
