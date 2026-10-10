"use client";

import { useState } from "react";
import { postJson } from "@/lib/fetch";

/** «🚀 فتح الموقع للجميع»: the owner's one switch for the public launch. */
export default function LaunchSwitch({ initial }: { initial: boolean }) {
  const [open, setOpen] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function flip(next: boolean) {
    if (!window.confirm(next ? "تفتح الموقع للجميع الحين؟ كل الأقسام تظهر لكل الناس (ما عدا الذكاء الإسلامي)، وكل توليد يُدفع من رصيدهم." : "تقفل الموقع؟ يرجع «قيد التطوير» لكل من مو في قائمة السماح.")) return;
    setBusy(true);
    setErr("");
    try {
      const r = await postJson<{ open: boolean }>("/api/admin/launch", { open: next });
      setOpen(r.open);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={`card space-y-2 p-4 ${open ? "border-emerald-500/60" : "border-amber-500/60"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold">🚀 فتح الموقع للجميع</h2>
          <p className="text-sm font-bold text-muted">
            {open ? "✅ الموقع مفتوح: كل الأقسام ظاهرة للجميع (ما عدا الذكاء الإسلامي)، والتوليد من رصيدهم." : "🔒 مقفل: يشوفه بس اللي في قائمة السماح، والباقي يشوفون «قيد التطوير»."}
          </p>
        </div>
        <button type="button" className={`btn min-h-11 px-5 ${open ? "btn-ghost" : "btn-primary"}`} disabled={busy} onClick={() => void flip(!open)}>
          {busy ? "…" : open ? "اقفل الموقع" : "🚀 افتح الموقع الحين"}
        </button>
      </div>
      {err && <p className="text-sm font-bold text-red-500">{err}</p>}
    </section>
  );
}
