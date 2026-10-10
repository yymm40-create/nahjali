"use client";

import { useEffect, useState } from "react";
import { api, postJson } from "@/lib/fetch";
import { instagramUrl, SHARE } from "@config/share";

interface Claim { id: string; email: string | null; handle: string; status: "pending" | "approved" | "rejected"; rewardHalalas: number; createdAt: string }
interface Data { settings: { enabled: boolean; rewardSar: number; ready: boolean }; claims: Claim[] }

const ST = { pending: "⏳ ينتظر", approved: "✅ مؤكد", rejected: "❌ مرفوض" } as const;
const URL = "/api/share/admin";

/** The owner's view of «انشرنا واربح»: the switch, the reward, and every «نشرت» to confirm (also from Telegram). */
export default function ShareAdmin() {
  const [d, setD] = useState<Data | null>(null);
  const [reward, setReward] = useState("");
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);

  const load = async () => {
    const r = await api<Data>(URL);
    setD(r);
    setReward(String(r.settings.rewardSar));
  };
  useEffect(() => {
    let on = true;
    api<Data>(URL).then((r) => { if (on) { setD(r); setReward(String(r.settings.rewardSar)); } }).catch((e) => on && setMsg({ t: e instanceof Error ? e.message : "تعذّر التحميل.", bad: true }));
    return () => { on = false; };
  }, []);

  const act = async (body: Record<string, unknown>, done: string) => {
    setMsg(null);
    try {
      await postJson(URL, body);
      setMsg({ t: done });
      await load();
    } catch (e) {
      setMsg({ t: e instanceof Error ? e.message : "تعذّر التنفيذ.", bad: true });
    }
  };

  if (!d) return <p className="text-sm font-bold text-muted">{msg?.t ?? "جاري التحميل…"}</p>;
  const pending = d.claims.filter((c) => c.status === "pending");

  return (
    <div className="space-y-6">
      {msg && <p className={`text-sm font-bold ${msg.bad ? "text-red-600" : "text-teal"}`}>{msg.t}</p>}
      {!d.settings.ready && <p className="card p-4 text-sm font-bold text-red-600">شغّل ملف SQL رقم 0053 في Supabase أول.</p>}

      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">⚙️ العرض</h2>
        <p className="text-sm font-bold text-muted">نافذة تطلع للجمهور مرة مع كل تحديث للموقع، وزر «🎁 انشرنا» يبقى فوق. اللي ينشر ستوري فيه منشن لـ <a className="underline" href={instagramUrl(SHARE.account)} target="_blank" rel="noreferrer" dir="ltr">@{SHARE.account}</a> يضغط «نشرت» باسم حسابه، ويوصلك في تيليجرام بزر تأكيد. مكافأة وحدة لكل حساب.</p>
        <div className="flex flex-wrap items-end gap-2">
          <button className={`rounded-full border px-4 py-2 text-sm font-bold ${d.settings.enabled ? "border-teal bg-teal/15 text-teal" : "border-line text-muted"}`} onClick={() => act({ action: "settings", enabled: !d.settings.enabled }, "انحفظ")}>
            {d.settings.enabled ? "✓ شغّال" : "متوقف"}
          </button>
          <label className="space-y-1 text-xs font-bold text-muted">المكافأة (ريال)
            <input className="field w-28" inputMode="decimal" value={reward} onChange={(e) => setReward(e.target.value.replace(/[^\d.]/g, ""))} />
          </label>
          <button className="btn btn-primary" onClick={() => act({ action: "settings", rewardSar: Number(reward) }, "انحفظت المكافأة")}>احفظ</button>
        </div>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">📣 الطلبات ({pending.length} تنتظر)</h2>
        <ul className="space-y-2">
          {d.claims.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
              <a className="font-bold underline" href={instagramUrl(c.handle)} target="_blank" rel="noreferrer" dir="ltr">@{c.handle}</a>
              <span className="text-xs text-muted">{c.email}</span>
              <span className="text-xs">{ST[c.status]} · {c.rewardHalalas / 100} ريال · {new Date(c.createdAt).toLocaleString("ar-SA")}</span>
              {c.status !== "approved" && <button className="text-xs font-bold text-teal underline" onClick={() => act({ action: "approve", id: c.id }, "تم ✅ انضافت المكافأة")}>أكّد</button>}
              {c.status === "pending" && <button className="text-xs text-red-600 underline" onClick={() => act({ action: "reject", id: c.id }, "انرفض")}>ارفض</button>}
            </li>
          ))}
          {!d.claims.length && <li className="text-sm text-muted">ما فيه طلبات للحين.</li>}
        </ul>
      </section>
    </div>
  );
}
