"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminPost, uploadPublic } from "./client";

/** Logo (upload / replace / back to the shipped one) and the accent colour. */
export default function BrandAdmin({ logoUrl, custom, accent }: { logoUrl: string; custom: boolean; accent: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [color, setColor] = useState(accent);
  const [progress, setProgress] = useState<number | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <section className="jw-panel space-y-4 p-4">
        <h2 className="font-semibold">الشعار</h2>
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt="الشعار الحالي" className="size-24 rounded-full bg-jw-bg-2 object-contain" />
          <div className="space-y-1 text-sm text-jw-muted">
            <p>{custom ? "شعار مرفوع من لوحة التحكم." : "الشعار المرفق مع الكود."}</p>
            <p className="text-xs">يظهر في الرأس، وأيقونة المتصفح، وصفحة الدخول، ومعاينة المشاركة، وبطاقة الدخول في الصفحة الرئيسية.</p>
          </div>
        </div>
        <label className="jw-btn cursor-pointer">
          {progress != null ? `يُرفع ${Math.round(progress * 100)}%` : "ارفع شعارًا جديدًا"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) run(async () => adminPost("logo", { path: await uploadPublic("logo", "brand", f, setProgress) }));
            }}
          />
        </label>
        {custom && (
          <button type="button" className="jw-btn jw-btn-quiet" disabled={busy} onClick={() => run(() => adminPost("logo", { path: null }))}>
            رجوع للشعار المرفق
          </button>
        )}
        <p className="text-xs text-jw-faint">PNG أو JPG أو WEBP حتى 5MB؛ الأفضل مربع بخلفية شفافة.</p>
      </section>

      <section className="jw-panel space-y-4 p-4">
        <h2 className="font-semibold">لون الإبراز</h2>
        <p className="text-sm text-jw-muted">لون واحد للأزرار والتحديد. اختر ما يناسب شعارك؛ الافتراضي مأخوذ من توهج الشعار وليس قرارًا نهائيًا.</p>
        <div className="flex items-center gap-3">
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-14 cursor-pointer rounded border border-jw-line-strong bg-transparent" aria-label="اختر اللون" />
          <input className="jw-input w-32" dir="ltr" value={color} onChange={(e) => setColor(e.target.value)} />
          <span className="h-10 flex-1 rounded-lg" style={{ background: color }} aria-hidden />
        </div>
        <button type="button" className="jw-btn jw-btn-primary" disabled={busy || color === accent} onClick={() => run(() => adminPost("accent", { accent: color }))}>
          احفظ اللون
        </button>
      </section>
      {error && <p className="error-box md:col-span-2" role="alert">{error}</p>}
    </div>
  );
}
