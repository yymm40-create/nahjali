"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, postJson } from "@/lib/fetch";

interface Data {
  visibility: "owner" | "codes" | "all";
  persona: { text: string; edited: boolean };
  cutout: boolean;
}
const URL = "/api/photo/admin";
const VIS: { id: Data["visibility"]; label: string; hint: string }[] = [
  { id: "owner", label: "أنا فقط", hint: "القسم مخفي عن غيرك" },
  { id: "codes", label: "من عنده صلاحية «زهراء»", hint: "بإيميل في «السماح» أو بكود، ويدخل في الكود السري الشامل" },
  { id: "all", label: "كل من يدخله الموقع", hint: "أي شخص مسموح له بشي في الموقع" },
];

/** The owner's view of «زهراء فوتو ماستر»: who may open it and her template. */
export default function PhotoAdmin() {
  const [d, setD] = useState<Data | null>(null);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<Data>(URL);
      setD(r);
      setText(r.persona.text);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "تعذّر التحميل.");
    }
  }, []);
  useEffect(() => {
    let on = true;
    api<Data>(URL).then((r) => { if (on) { setD(r); setText(r.persona.text); } }).catch((e) => { if (on) setErr(e instanceof Error ? e.message : "تعذّر التحميل."); });
    return () => { on = false; };
  }, []);

  const act = async (body: Record<string, unknown>, done: string) => {
    setErr(null);
    setMsg(null);
    try {
      await postJson(URL, body);
      setMsg(done);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "تعذّر التنفيذ.");
    }
  };

  if (!d) return <p className="text-sm font-bold text-muted">{err ?? "…"}</p>;
  return (
    <div className="space-y-6">
      {err && <p className="error-box">{err}</p>}
      {msg && <p className="text-sm font-bold text-teal">{msg}</p>}

      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">من يفتح «زهراء فوتو ماستر»؟</h2>
        <p className="text-sm font-bold text-muted">لازم يظهر القسم نفسه في <Link className="underline" href="/jawad-ai/admin/sections">أقسام الجواد</Link> (القسم مبني تلقائيًا ويظهر حسب هذا الخيار).</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {VIS.map((v) => (
            <button key={v.id} type="button" aria-pressed={d.visibility === v.id} className={`rounded-2xl border-2 p-3 text-start ${d.visibility === v.id ? "border-sky-400 bg-sky-400/10" : "border-line"}`} onClick={() => void act({ action: "visibility", value: v.id }, "تم ✅")}>
              <span className="block font-extrabold">{v.label}</span>
              <span className="block text-xs font-bold text-muted">{v.hint}</span>
            </button>
          ))}
        </div>
        <p className="text-xs font-bold text-muted">قص الخلفية بجواد: {d.cutout ? "✅ مفعّل" : "❌ غير مفعّل (ينقص FAL_KEY في Vercel)"}</p>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">قالب «زهراء» {d.persona.edited ? "(معدّل منك)" : "(الأصلي)"}</h2>
        <p className="text-sm font-bold text-muted">هذا نص شخصيتها وطريقة عملها. قواعد المنصة وأدواتها وقائمة الخطوط تُضاف دائمًا بعده ولا تُحذف.</p>
        <textarea className="field min-h-[320px] w-full" dir="auto" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" disabled={text.trim().length < 200} onClick={() => void act({ action: "persona_save", text }, "انحفظ القالب ✅")}>احفظ القالب</button>
          {d.persona.edited && <button type="button" className="btn btn-ghost" onClick={() => window.confirm("نرجع للقالب الأصلي؟") && void act({ action: "persona_reset" }, "رجع القالب الأصلي")}>ارجع للأصلي</button>}
        </div>
      </section>
    </div>
  );
}
