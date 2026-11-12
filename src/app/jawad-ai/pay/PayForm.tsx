"use client";

import { useState } from "react";
import { amountLabel, parseAmount, PAY_MAX, PAY_MIN } from "@/lib/pay-link";

/** The amount box and the one button: the payer types any amount, presses, and lands on Moyasar's page for exactly that. */
export default function PayForm({ initial, initialNote }: { initial: number; initialNote: string }) {
  const [raw, setRaw] = useState(amountLabel(initial));
  const [note, setNote] = useState(initialNote);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const amount = parseAmount(raw);

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (amount === null || busy) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/pay", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ amount, note }) });
      const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!r.ok || !j.url) throw new Error(j.error || "ما قدرنا نفتح صفحة الدفع، جرّب مرة ثانية.");
      window.location.assign(j.url);
    } catch (x) {
      setErr(x instanceof Error ? x.message : "صار خطأ، جرّب مرة ثانية.");
      setBusy(false);
    }
  }

  return (
    <form className="pl-card" onSubmit={pay}>
      <label className="pl-lab" htmlFor="pl-amount">المبلغ</label>
      <div className="pl-amount">
        <input
          id="pl-amount"
          inputMode="decimal"
          autoComplete="off"
          dir="ltr"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          aria-invalid={amount === null}
        />
        <span className="pl-cur">ريال</span>
      </div>
      <div className="pl-quick">
        {[50, 100, 200, 500].map((v) => (
          <button type="button" key={v} className={amount === v ? "on" : ""} onClick={() => setRaw(String(v))}>
            {v}
          </button>
        ))}
      </div>
      <label className="pl-lab" htmlFor="pl-note">اسمك أو وش الدفعة (اختياري)</label>
      <input id="pl-note" className="pl-note" maxLength={80} value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثال: إعلان ماركو" />
      {amount === null && <p className="pl-err">اكتب مبلغ من {PAY_MIN} إلى {PAY_MAX.toLocaleString("en")} ريال.</p>}
      {err && <p className="pl-err">{err}</p>}
      <button className="ld-cta pl-go" type="submit" disabled={amount === null || busy}>
        {busy ? "لحظة…" : amount === null ? "ادفع" : `ادفع ${amountLabel(amount)} ريال`}
      </button>
      <p className="ld-note pl-safe">تدفع بالبطاقة أو مدى أو Apple Pay على صفحة ميسّر الآمنة</p>
    </form>
  );
}
