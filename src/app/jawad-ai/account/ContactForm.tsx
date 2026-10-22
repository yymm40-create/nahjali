"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** The name and WhatsApp number; saved on the account, then on to `next`. */
export default function ContactForm({ name: n0, phone: p0, next, first }: { name: string; phone: string; next: string; first: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(n0);
  const [phone, setPhone] = useState(p0.startsWith("+966") ? `0${p0.slice(4)}` : p0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        setSaved(false);
        const res = await fetch("/api/account/contact", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, phone }) }).catch(() => null);
        const body = (await res?.json().catch(() => ({}))) as { error?: string };
        if (res?.ok) {
          if (first || next !== "/jawad-ai") {
            router.replace(next);
            router.refresh();
            return;
          }
          setSaved(true);
          router.refresh();
        } else setError(body?.error ?? "تعذّر الحفظ. جرّب مرة ثانية.");
        setBusy(false);
      }}
    >
      <label className="block space-y-1">
        <span className="text-sm font-semibold">الاسم الكامل</span>
        <input className="jw-input w-full" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} required placeholder="مثال: يوسف أحمد" />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-semibold">رقم الجوال (واتساب)</span>
        <input className="jw-input w-full" dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" required placeholder="05xxxxxxxx" />
      </label>
      {error && <p className="error-box text-sm" role="alert">{error}</p>}
      {saved && <p className="text-sm text-jw-muted" role="status">انحفظ ✅</p>}
      <button className="jw-btn-primary w-full" disabled={busy || name.trim().length < 2 || phone.trim().length < 8}>{busy ? "لحظة…" : first ? "احفظ وابدأ ←" : "احفظ"}</button>
    </form>
  );
}
