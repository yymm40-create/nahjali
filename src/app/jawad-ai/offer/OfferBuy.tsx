"use client";

import { useState } from "react";
import Riyal from "@/components/Riyal";
import { OFFER10 } from "@config/jawad/offer10";

/** The one button: signed out → sign in first; signed in → Moyasar's page for 10 riyals. */
export default function OfferBuy({ login }: { login: string | null }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function buy() {
    if (login) return window.location.assign(login);
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/jawad/offer10", { method: "POST" });
      const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!r.ok || !j.url) throw new Error(j.error || "ما قدرنا نفتح صفحة الدفع، جرّب مرة ثانية.");
      window.location.assign(j.url);
    } catch (x) {
      setErr(x instanceof Error ? x.message : "صار خطأ، جرّب مرة ثانية.");
      setBusy(false);
    }
  }
  return (
    <>
      <button type="button" className="ld-cta ox-go" onClick={buy} disabled={busy}>
        {busy ? "لحظة…" : <>{login ? "سجّل دخول واشترك بـ" : "اشترك الحين بـ"}<Riyal halalas={OFFER10.priceSar * 100} size={18} /></>}
      </button>
      {err && <p className="ox-err">{err}</p>}
    </>
  );
}
