"use client";

import { useCallback, useEffect, useState } from "react";
import { api, postJson } from "@/lib/fetch";
import { bonusPct, type CreditSettings, type Pack } from "@config/credits";
import { waLink } from "@config/course";

interface Order {
  id: string;
  email: string;
  name: string;
  phone: string;
  packName: string;
  price: number;
  credit: number;
  status: "started" | "transferred" | "confirmed" | "rejected";
  transferredAt: string | null;
  creditedAt: string | null;
  createdAt: string;
}
interface Data {
  settings: CreditSettings;
  orders: Order[];
  telegram: boolean;
}
const URL = "/api/credits/admin";
const STATUS: Record<Order["status"], string> = { started: "بدأ ولم يحوّل", transferred: "ضغط تم التحويل", confirmed: "مؤكد ✅ (انضاف الرصيد)", rejected: "مرفوض ❌" };
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("ar-SA-u-ca-gregory-nu-latn", { dateStyle: "short", timeStyle: "short" }) : "");

/** The owner's view of «اشحن رصيدك»: the packages (prices and balance), the WhatsApp number, and the orders. */
export default function CreditsAdmin() {
  const [d, setD] = useState<Data | null>(null);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [featured, setFeatured] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [filter, setFilter] = useState<"" | Order["status"]>("transferred");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async (form = false, f: "" | Order["status"] = filter) => {
    try {
      const r = await api<Data>(`${URL}${f ? `?status=${f}` : ""}`);
      setD(r);
      if (form) {
        setPacks(r.settings.packs);
        setFeatured(r.settings.featured);
        setWhatsapp(r.settings.whatsapp);
      }
      setErr("");
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [filter]);
  useEffect(() => {
    let on = true;
    api<Data>(`${URL}?status=transferred`)
      .then((r) => { if (on) { setD(r); setPacks(r.settings.packs); setFeatured(r.settings.featured); setWhatsapp(r.settings.whatsapp); } })
      .catch((e) => on && setErr((e as Error).message));
    return () => { on = false; };
  }, []);
  useEffect(() => {
    const t = setInterval(() => void load(false), 20_000);
    return () => clearInterval(t);
  }, [load]);

  async function act(body: Record<string, unknown>, done = "تم ✅") {
    setErr("");
    setMsg("");
    try {
      const r = await postJson<{ settings?: CreditSettings; already?: boolean }>(URL, body);
      if (r.settings) {
        setPacks(r.settings.packs);
        setFeatured(r.settings.featured);
        setWhatsapp(r.settings.whatsapp);
      }
      setMsg(r.already ? "كان مؤكدًا من قبل." : done);
      await load(false);
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  const setPack = (i: number, patch: Partial<Pack>) => setPacks((ps) => ps.map((p, k) => (k === i ? { ...p, ...patch } : p)));

  if (!d) return <p className="font-bold text-muted">{err || "…"}</p>;
  return (
    <div className="space-y-6">
      {err && <p className="rounded-lg bg-red-500/10 p-3 text-sm font-bold text-red-500">{err}</p>}
      {msg && <p className="rounded-lg bg-emerald-500/10 p-3 text-sm font-bold text-emerald-600">{msg}</p>}
      {!d.telegram && <p className="rounded-lg bg-amber-500/10 p-3 text-sm font-bold">⚠️ تيليجرام غير مربوط: الطلبات تظهر هنا فقط. اربطه من «دورة الجواد».</p>}

      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">🔔 طلبات الشحن</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          {(["transferred", "started", "confirmed", "rejected", ""] as const).map((f) => (
            <button key={f || "all"} type="button" className={`chip ${filter === f ? "bg-sky-400 text-white" : ""}`} onClick={() => { setFilter(f); void load(false, f); }}>{f ? STATUS[f] : "الكل"}</button>
          ))}
        </div>
        {!d.orders.length && <p className="text-sm font-bold text-muted">ما فيه طلبات هنا.</p>}
        <ul className="space-y-2">
          {d.orders.map((o) => (
            <li key={o.id} className="space-y-1 rounded-xl border border-line p-3 text-sm font-bold">
              <p className="flex flex-wrap items-center gap-2">
                <span>{o.name}</span>·<span dir="ltr">{o.phone}</span>·<span dir="ltr" className="text-muted">{o.email}</span>
              </p>
              <p>باقة {o.packName}: حوّل <b>{o.price}</b> ← رصيد <b>{o.credit}</b> · <span className="text-muted">{STATUS[o.status]} · {when(o.transferredAt ?? o.createdAt)}</span></p>
              <div className="flex flex-wrap gap-2">
                {o.status !== "confirmed" && <button type="button" className="btn btn-primary min-h-10 px-4" onClick={() => window.confirm(`تأكد إن ${o.price} وصلت؟ بينضاف له رصيد ${o.credit}.`) && void act({ action: "confirm", id: o.id }, "تم التأكيد وانضاف الرصيد ✅")}>✅ أكّد وأضف الرصيد</button>}
                {(o.status === "started" || o.status === "transferred") && <button type="button" className="btn btn-ghost min-h-10 px-4" onClick={() => window.confirm("ترفض الطلب؟") && void act({ action: "reject", id: o.id }, "انرفض")}>❌ ارفض</button>}
                {o.phone && <a className="btn btn-ghost min-h-10 px-4" href={waLink(o.phone, `هلا ${o.name}، بخصوص طلب شحن رصيدك في الجواد الذكي.`)} target="_blank" rel="noreferrer">💬 واتساب</a>}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">📦 الباقات</h2>
        <p className="text-sm font-bold text-muted">«تحوّل» = اللي يدفعه، «رصيد» = اللي ينضاف له. كل ريال رصيد فيه ربحك أصلًا، فلا تخلي الزيادة فوق ٢٠٪ تقريبًا عشان ما تبيع بخسارة. بيانات التحويل نفسها اللي في «دورة الجواد».</p>
        <div className="space-y-2">
          {packs.map((p, i) => (
            <div key={p.id} className="grid grid-cols-2 gap-2 rounded-xl border border-line p-3 sm:grid-cols-6">
              <label className="grid gap-1 text-xs font-bold">الاسم<input className="field" value={p.name} onChange={(e) => setPack(i, { name: e.target.value })} /></label>
              <label className="grid gap-1 text-xs font-bold">تحوّل<input className="field" dir="ltr" inputMode="numeric" value={p.price} onChange={(e) => setPack(i, { price: Number(e.target.value.replace(/\D/g, "")) || 0 })} /></label>
              <label className="grid gap-1 text-xs font-bold">رصيد<input className="field" dir="ltr" inputMode="numeric" value={p.credit} onChange={(e) => setPack(i, { credit: Number(e.target.value.replace(/\D/g, "")) || 0 })} /></label>
              <label className="grid gap-1 text-xs font-bold">شارة<input className="field" value={p.tag} placeholder="الأكثر طلبًا" onChange={(e) => setPack(i, { tag: e.target.value })} /></label>
              <label className="grid gap-1 text-xs font-bold">سطر قصير<input className="field" value={p.note} onChange={(e) => setPack(i, { note: e.target.value })} /></label>
              <div className="flex items-end gap-2 text-xs font-bold">
                <label className="flex items-center gap-1"><input type="radio" name="featured" checked={featured === p.id} onChange={() => setFeatured(p.id)} /> المميزة</label>
                <span className="text-emerald-600">+{bonusPct(p)}٪</span>
              </div>
            </div>
          ))}
        </div>
        <label className="grid gap-1 text-sm font-bold">
          رقم واتسابك (يظهر للعميل «طال الوقت؟ راسلنا»)
          <input className="field" dir="ltr" value={whatsapp} placeholder="+9665xxxxxxxx" onChange={(e) => setWhatsapp(e.target.value)} />
        </label>
        <button type="button" className="btn btn-primary w-full" onClick={() => void act({ action: "save", settings: { packs, featured, whatsapp } }, "انحفظت الباقات ✅")}>💾 احفظ</button>
      </section>
    </div>
  );
}
