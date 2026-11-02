"use client";

// «اسمح للأدمن بالدخول على مشروعك»: wherever the owner is on the site, a request waiting for his answer shows here
// (lib/film/admin-access.ts). Allowed: the admin opens the project in his own film maker and works on it directly.

import { useEffect, useState } from "react";
import { api, postJson } from "@/lib/fetch";

type Pending = { id: string; projectId: string; title: string; at: string };

export default function AdminAccessPrompt() {
  const [pending, setPending] = useState<Pending[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const load = () => api<{ pending: Pending[] }>("/api/film/access").then((r) => alive && setPending(r.pending ?? [])).catch(() => {});
    load();
    const onShow = () => !document.hidden && load();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onShow);
    };
  }, []);

  const r = pending[0];
  if (!r) return null;

  async function answer(allow: boolean) {
    setBusy(true);
    setError("");
    try {
      await postJson("/api/film/access", { action: "answer", id: r.id, allow });
      setPending((p) => p.slice(1));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div dir="rtl" role="dialog" aria-label="طلب دخول على مشروعك" className="fixed inset-x-3 bottom-4 z-[400] mx-auto max-w-md rounded-2xl border-2 border-amber-400 bg-white p-4 text-slate-900 shadow-2xl">
      <p className="text-base font-extrabold">🔑 الأدمن يطلب الدخول على مشروعك</p>
      <p className="mt-1 text-sm font-bold">«{r.title}» في صانع الأفلام</p>
      <p className="mt-2 text-xs font-bold leading-6 text-slate-600">
        لو سمحت له، يفتح المشروع عنده ويقدر يعدّل فيه، وكل تعديل يسويه يصير في مشروعك نفسه. تكلفة شغله عليه هو، ما تنخصم من رصيدك. وتقدر توقف السماح متى ما تبي من صفحة المشروع.
      </p>
      {error && <p className="mt-2 text-xs font-bold text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" className="min-h-11 flex-1 rounded-xl bg-emerald-600 px-3 text-sm font-extrabold text-white disabled:opacity-60" disabled={busy} onClick={() => void answer(true)}>✅ اسمح له</button>
        <button type="button" className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-extrabold disabled:opacity-60" disabled={busy} onClick={() => void answer(false)}>لا، ما أسمح</button>
      </div>
      {pending.length > 1 && <p className="mt-2 text-center text-[11px] font-bold text-slate-500">وبعده {pending.length - 1} طلبات ثانية</p>}
    </div>
  );
}
