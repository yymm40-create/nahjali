"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Owner: raise (or reset) the daily free-trial limit for one email. */
export default function TrialLimit({ users }: { users: { email: string; daily: number }[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [daily, setDaily] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function save(e: string, d: number) {
    if (!e.trim()) return setMsg("⚠️ اكتب الإيميل أول.");
    if (!(d >= 0)) return setMsg("⚠️ اكتب العدد (كم تجربة إجمالًا).");
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/trials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e, daily: d }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "تعذّر الحفظ.");
      setMsg(d > 0 ? `✅ صار حد ${e} ${d} تجارب` : `✅ رجع ${e} للحد العادي`);
      setEmail("");
      setDaily("");
      router.refresh();
    } catch (err) {
      setMsg(`⚠️ ${err instanceof Error ? err.message : "تعذّر الحفظ."}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card space-y-3 p-4">
      <h2 className="text-xl font-extrabold">رفع عدد المحاولات لإيميل</h2>
      <label className="block text-sm font-bold text-muted">الإيميل</label>
      <input className="field w-full" dir="ltr" type="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      <label className="block text-sm font-bold text-muted">عدد التجارب المسموحة لهذا الإيميل</label>
      <div className="flex gap-2">
        <input className="field w-28" inputMode="numeric" placeholder="مثلاً 10" value={daily} onChange={(e) => setDaily(e.target.value.replace(/[^0-9٠-٩]/g, "").replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632)))} />
        <button className="btn btn-primary flex-1" disabled={busy} onClick={() => save(email, daily === "" ? NaN : Number(daily))}>
          {busy ? "لحظة…" : "حفظ"}
        </button>
      </div>
      {msg && <p className="text-sm font-bold">{msg}</p>}
      {users.length > 0 && (
        <ul className="space-y-1 text-sm font-bold">
          {users.map((u) => (
            <li key={u.email} className="flex items-center justify-between gap-2">
              <span dir="ltr" className="truncate">{u.email}</span>
              <span className="flex items-center gap-2">
                {u.daily}/يوم
                <button className="btn btn-ghost min-h-8 px-2 text-xs" disabled={busy} onClick={() => save(u.email, 0)}>إلغاء</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
