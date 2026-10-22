"use client";

import { useState } from "react";
import { postJson } from "@/lib/fetch";

interface Found {
  phone: string;
  name: string;
  source: string;
  at: string;
  wa: string | null;
}

export default function Contact() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<{ email: string; found: Found[]; errors: number } | null>(null);

  const look = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setRes(null);
    try {
      setRes(await postJson<{ email: string; found: Found[]; errors: number }>("/api/admin/contact", { email }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر البحث.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={look} className="card flex flex-wrap items-center gap-2 p-4">
        <input className="field min-w-0 flex-1" dir="ltr" type="email" inputMode="email" autoComplete="off" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="إيميل الشخص" required />
        <button type="submit" className="btn btn-primary min-h-11 px-5" disabled={busy || !email.trim()}>
          {busy ? "أدوّر…" : "ابحث عن رقمه"}
        </button>
      </form>
      {error && <p role="alert" className="card border-red-500/40 p-3 text-sm font-bold text-red-400">{error}</p>}
      {res && res.found.length > 0 && (
        <ul className="space-y-2">
          {res.found.map((f) => (
            <li key={f.phone} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="space-y-0.5">
                <div className="text-lg font-extrabold" dir="ltr">{f.phone}</div>
                <div className="text-xs font-bold text-muted">
                  {f.name ? `${f.name} · ` : ""}{f.source} · {new Date(f.at).toLocaleDateString("ar", { day: "numeric", month: "long", year: "numeric" })}
                </div>
              </div>
              {f.wa ? (
                <a href={f.wa} target="_blank" rel="noopener noreferrer" className="btn btn-primary min-h-11 px-5">💬 افتح واتساب</a>
              ) : (
                <span className="text-xs font-bold text-muted">الرقم ما يبدو رقم جوال صحيح</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {res && res.found.length === 0 && (
        <p className="card p-4 text-sm font-bold text-muted">
          {res.errors ? "تعذّر البحث في جدول من الجدولين (ممكن ملف SQL ما انشغّل)." : `ما لقيت رقمًا لـ ${res.email}. الموقع ما يطلب الجوال عند التسجيل أو إدخال الكود، وما يتحفظ إلا لما أحد يطلب الدورة أو يشحن رصيد؛ فهذا الشخص ما ترك رقمه عندنا.`}
        </p>
      )}
    </div>
  );
}
