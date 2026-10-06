"use client";

import Link from "next/link";
import { useState } from "react";
import { postJson } from "@/lib/fetch";
import { createClient } from "@/lib/supabase/client";

export default function DeleteAccount({ email }: { email: string }) {
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/account/delete", { confirm: word });
      await createClient().auth.signOut().catch(() => {});
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر.");
    } finally {
      setBusy(false);
    }
  };

  if (done)
    return (
      <div className="card mt-6 space-y-3 p-6 text-center">
        <h1 className="display text-3xl">انحذف حسابك</h1>
        <p className="font-bold text-muted">حذفنا حسابك وكل بياناته. نتمنى نشوفك مرة ثانية.</p>
        <Link href="/" className="btn btn-ghost">الرئيسية</Link>
      </div>
    );

  return (
    <div className="card mt-6 space-y-4 p-6">
      <h1 className="display text-3xl">حذف حسابي</h1>
      <p className="font-bold">
        الحساب: <span dir="ltr">{email}</span>
      </p>
      <div className="rounded-2xl border-2 border-red-500/40 bg-red-500/10 p-4 text-sm font-bold leading-7">
        <p>بنحذف نهائيًا، وما يرجع:</p>
        <ul className="list-disc ps-5">
          <li>حسابك وتسجيل دخولك</li>
          <li>كتيباتك وطلباتك</li>
          <li>أعمالك في الجواد الذكي، ومشاريع حيدرة كت والأفلام</li>
          <li>رصيدك من النقود الذكية وسجله</li>
          <li>محادثاتك مع المساعدين</li>
        </ul>
        <p className="mt-2">نزّل أي شي تبيه قبل الحذف.</p>
      </div>
      <label className="block space-y-1 font-bold">
        <span>للتأكيد اكتب: احذف</span>
        <input className="field w-full" value={word} onChange={(e) => setWord(e.target.value)} placeholder="احذف" autoComplete="off" />
      </label>
      {error && <p className="error-box">{error}</p>}
      <button type="button" className="btn w-full bg-red-600 text-white disabled:opacity-50" disabled={word.trim() !== "احذف" || busy} onClick={go}>
        {busy ? "نحذف…" : "احذف حسابي نهائيًا"}
      </button>
    </div>
  );
}
