"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/fetch";
import SmartCoin from "@/components/SmartCoin";

/**
 * «🔴 النقود الحمراء»: the e-mails that pay the platform's own price — what the provider charges us, 0٪ profit, no
 * rounding to half a riyal (only to the halala). Their coin is red everywhere, and every price they see is that price.
 */
export default function RedCoins({ emails }: { emails: string[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(mail: string, on: boolean) {
    setBusy(true);
    setError("");
    try {
      await postJson("/api/admin/access", { action: "red", email: mail.trim(), on });
      if (on) setEmail("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الحفظ.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card space-y-3 border-red-400/60 p-4" aria-label="النقود الحمراء">
      <h2 className="flex items-center gap-2 text-xl font-bold">
        <SmartCoin size={22} tone="red" /> النقود الحمراء: بسعر المنصة مباشرة
      </h2>
      <p className="text-sm font-bold text-muted">
        اكتب الإيميل: كل شي يشتريه يصير بسعر الأداة نفسها مباشرة، ربحك منه ٠٪، وبدون تقريب لنص ريال (بالهللة فقط)، وكلاود بمدخلاته ومخرجاته الفعلية. نقوده تطلع حمراء بدل الزرقاء، والأسعار اللي تطلع له كلها بهالسعر.
      </p>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (email.trim()) send(email, true);
        }}
      >
        <input className="field min-w-0 flex-1" dir="ltr" type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="إيميل للنقود الحمراء" />
        <button className="btn min-h-12 bg-red-600 px-5 text-white" disabled={busy || !email.trim()}>
          + أضفه
        </button>
      </form>
      {error && <p className="text-sm font-bold text-red-600">{error}</p>}
      {emails.length ? (
        <ul className="space-y-2">
          {emails.map((e) => (
            <li key={e} className="flex flex-wrap items-center gap-2 rounded-2xl border border-line p-3">
              <SmartCoin size={16} tone="red" />
              <b className="min-w-0 flex-1 truncate" dir="ltr">{e}</b>
              <button type="button" className="btn btn-ghost min-h-9 px-3 text-xs" disabled={busy} aria-label={`شيل ${e} من النقود الحمراء`} onClick={() => confirm(`نرجّع ${e} للسعر العادي؟`) && send(e, false)}>
                ✗ رجّعه للسعر العادي
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-center text-sm font-bold text-muted">ما فيه أحد بالنقود الحمراء للحين.</p>
      )}
    </section>
  );
}
