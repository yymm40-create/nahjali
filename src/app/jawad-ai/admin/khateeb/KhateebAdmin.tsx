"use client";

import { useState } from "react";
import { postJson } from "@/lib/fetch";
import { KHATEEB, METHOD_MAX, POEMS_MAX } from "@config/jawad/khateeb";
import ReferenceAdmin from "./ReferenceAdmin";

interface Settings {
  slug: string;
  hasPassword: boolean;
  version: number;
  method: string;
  poems: string;
  ready: boolean;
}

export default function KhateebAdmin({ initial }: { initial: Settings }) {
  const [s, setS] = useState(initial);
  const [slug, setSlug] = useState(initial.slug);
  const [password, setPassword] = useState("");
  const [method, setMethod] = useState(initial.method);
  const [poems, setPoems] = useState(initial.poems);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);

  const link = s.slug && typeof window !== "undefined" ? `${window.location.origin}${KHATEEB.base}/${s.slug}` : "";

  const save = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await postJson<Settings>("/api/khateeb/admin", body);
      setS(r);
      setSlug(r.slug);
      setMsg({ t: ok });
      return true;
    } catch (e) {
      setMsg({ t: e instanceof Error ? e.message : "تعذّر الحفظ.", bad: true });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const copy = () => {
    if (link) navigator.clipboard?.writeText(link).then(() => setMsg({ t: "انسخ الرابط ✅" })).catch(() => null);
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">{KHATEEB.icon} {KHATEEB.name}</h1>
        <p className="mt-1 text-sm text-jw-muted">قسم مخفي: ما يظهر في أي قائمة، ولا يدخله إلا اللي عنده الرابط وكلمة السر. نفس «الطالب الذكي» بمساعده «الشيخ»، مربوط بـ«الذكاء الإسلامي».</p>
      </header>
      {msg && <p className={`rounded-lg p-3 text-sm font-bold ${msg.bad ? "bg-jw-danger/10 text-jw-danger" : "bg-jw-ok/10 text-jw-ok"}`} role="status">{msg.t}</p>}
      {!s.ready && <p className="rounded-lg border border-jw-warn/40 bg-jw-warn/10 p-3 text-sm">شغّل ملف <span dir="ltr">supabase/migrations/0065_khateeb.sql</span> في Supabase أول.</p>}

      <section className="jw-panel space-y-3 p-4">
        <h2 className="font-semibold">🔗 الرابط السري</h2>
        {s.slug ? (
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-jw-surface-2 p-2 text-sm" dir="ltr">{link}</code>
            <button type="button" className="jw-btn" onClick={copy}>📋 انسخ</button>
          </div>
        ) : (
          <p className="text-sm text-jw-muted">ما فيه رابط للحين: القسم غير موجود لأحد. اضغط «سوّ رابطًا جديدًا».</p>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <button type="button" className="jw-btn jw-btn-primary" disabled={busy || !s.ready} onClick={() => (!s.slug || confirm("الرابط القديم يتوقف فورًا. تكمل؟")) && save({ newSlug: true }, "انسوّى رابط جديد، وأرسله لمن تبي.")}>
            {s.slug ? "🔄 غيّر الرابط (عشوائي)" : "✨ سوّ رابطًا جديدًا"}
          </button>
          <label className="space-y-1 text-xs text-jw-muted">أو اكتب كلمتك أنت (إنجليزي صغير وأرقام وشرطات، ٦–٤٠)
            <input className="jw-input" dir="ltr" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="my-minbar" />
          </label>
          <button type="button" className="jw-btn" disabled={busy || !slug.trim() || slug === s.slug} onClick={() => save({ slug }, "انحفظت كلمة الرابط.")}>احفظ</button>
        </div>
      </section>

      <section className="jw-panel space-y-3 p-4">
        <h2 className="font-semibold">🔑 كلمة السر</h2>
        <p className="text-sm text-jw-muted">{s.hasPassword ? "فيه كلمة سر مضبوطة (ما تنعرض). اكتب كلمة جديدة لتغييرها، ومن كان داخل يحتاج يدخل بها من جديد." : "ما فيه كلمة سر للحين: القسم مقفل على الكل لين تحط واحدة."}</p>
        <div className="flex flex-wrap items-end gap-2">
          <input className="jw-input max-w-xs" type="text" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="كلمة السر الجديدة" aria-label="كلمة السر الجديدة" />
          <button type="button" className="jw-btn jw-btn-primary" disabled={busy || password.length < 4 || !s.ready} onClick={async () => (await save({ password }, "انحفظت كلمة السر.")) && setPassword("")}>احفظ كلمة السر</button>
        </div>
      </section>

      <section className="jw-panel space-y-3 p-4">
        <h2 className="font-semibold">📜 طريقة الشيخ في صياغة الخطبة</h2>
        <p className="text-sm text-jw-muted">اكتب هنا ترتيب الخطبة وأجزاءها وأسلوبها وطولها، والشيخ يمشي عليها في كل خطبة (تقدر تلصق نص ملف الـPDF). فاضية = يكتب على القواعد العامة.</p>
        <textarea className="jw-textarea" rows={14} value={method} maxLength={METHOD_MAX} onChange={(e) => setMethod(e.target.value)} aria-label="طريقة صياغة الخطبة" />
        <button type="button" className="jw-btn jw-btn-primary" disabled={busy || method === s.method} onClick={() => save({ method }, "انحفظت الطريقة.")}>احفظ الطريقة</button>
      </section>

      <ReferenceAdmin />

      <section className="jw-panel space-y-3 p-4">
        <h2 className="font-semibold">🪶 الأشعار والأبيات</h2>
        <p className="text-sm text-jw-muted">الأبيات اللي تبي الشيخ يستشهد بها، بنصها وقائلها. ما يؤلف بيتًا ولا ينسبه لأحد من عنده، ويأخذ منها بس.</p>
        <textarea className="jw-textarea" rows={14} value={poems} maxLength={POEMS_MAX} onChange={(e) => setPoems(e.target.value)} aria-label="الأشعار" />
        <button type="button" className="jw-btn jw-btn-primary" disabled={busy || poems === s.poems} onClick={() => save({ poems }, "انحفظت الأشعار.")}>احفظ الأشعار</button>
      </section>
    </div>
  );
}
