"use client";

// «الخطيب الذكي» — the door: the password the owner gave to whoever he handed the link to.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { KHATEEB } from "@config/jawad/khateeb";

export default function KhateebGate({ slug }: { slug: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const enter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/khateeb/enter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, password }) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "تعذّر الدخول.");
      router.refresh();
    } catch (x) {
      setErr(x instanceof Error ? x.message : "تعذّر الدخول.");
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm items-center px-4 py-10">
      <form onSubmit={enter} className="jw-panel w-full space-y-4 p-6 text-center">
        <p className="text-5xl" aria-hidden>{KHATEEB.icon}</p>
        <h1 className="text-2xl font-extrabold">{KHATEEB.name}</h1>
        <p className="text-sm text-jw-muted">اكتب كلمة السر اللي أعطاك إياها صاحب المنصة.</p>
        <input className="jw-input text-center" type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} placeholder="كلمة السر" aria-label="كلمة السر" />
        {err && <p className="text-sm font-bold text-jw-danger" role="alert">{err}</p>}
        <button type="submit" className="jw-btn jw-btn-primary w-full" disabled={busy || !password}>{busy ? "…" : "ادخل"}</button>
      </form>
    </div>
  );
}
