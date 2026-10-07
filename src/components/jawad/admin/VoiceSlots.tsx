"use client";

import { useCallback, useEffect, useState } from "react";
import { api, postJson } from "@/lib/fetch";

interface Voice {
  voiceId: string;
  name: string;
  category: string;
  createdAt: string | null;
  usedBy: { email: string; name: string } | null;
}
interface State {
  slots: { used: number; limit: number; tier: string };
  voices: Voice[];
}

/** «خانات الأصوات»: ElevenLabs' slots of the site's account, the voices in them, and freeing a slot. */
export default function VoiceSlots() {
  const [s, setS] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(() => api<State>("/api/jawad/admin/voices").then(setS).catch((e: Error) => setError(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);

  async function free(v: Voice) {
    if (!confirm(`نحذف «${v.name}» من ElevenLabs؟${v.usedBy ? ` هو في مكتبة ${v.usedBy.email} وبينحذف منها.` : ""}`)) return;
    setBusy(v.voiceId);
    try {
      await postJson("/api/jawad/admin/voices", { voiceId: v.voiceId });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (error && !s) return <p className="jw-panel p-5 text-sm text-red-500">{error}</p>;
  if (!s) return <p className="jw-panel p-5 text-sm text-jw-muted">يقرأ حساب ElevenLabs…</p>;
  const orphans = s.voices.filter((v) => !v.usedBy);
  const full = s.slots.limit > 0 && s.slots.used >= s.slots.limit;
  return (
    <div className="space-y-4">
      <section className="jw-panel space-y-2 p-5">
        <h2 className="text-lg font-bold">🎙️ خانات الأصوات في ElevenLabs</h2>
        <p className={`text-3xl font-bold ${full ? "text-red-500" : ""}`} dir="ltr">
          {s.slots.used} / {s.slots.limit}
        </p>
        <p className="text-sm text-jw-muted">
          كل صوت ينحفظ (مصمّم بالوصف أو منسوخ من تسجيل) ياخذ خانة في حساب الموقع عند ElevenLabs، وعدد الخانات تحدده باقة الحساب{s.slots.tier ? ` (الحين: ${s.slots.tier})` : ""}، مو الموقع. الموقع ما يحط حد على اللي في «السماح».
          {full ? " الخانات ممتلئة: احذف صوت ما يحتاجه أحد تحت، أو رقّ باقة ElevenLabs من elevenlabs.io عشان تزيد الخانات." : ""}
        </p>
      </section>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <section className="jw-panel space-y-2 p-5">
        <h3 className="font-bold">الأصوات في الحساب ({s.voices.length}) · بدون صاحب في الموقع: {orphans.length}</h3>
        <ul className="space-y-1.5">
          {s.voices.map((v) => (
            <li key={v.voiceId} className="flex flex-wrap items-center gap-2 rounded-xl bg-jw-surface-2 p-2.5 text-sm">
              <b className="min-w-0 flex-1 truncate">{v.name}</b>
              <span className="text-xs text-jw-muted">
                {v.category}
                {v.usedBy ? ` · في مكتبة ${v.usedBy.email}` : " · ما أحد يستخدمه في الموقع"}
              </span>
              <button type="button" className="jw-btn !min-h-8 !px-3 text-xs text-red-500" disabled={busy === v.voiceId} onClick={() => free(v)}>
                {busy === v.voiceId ? "يحذف…" : "احذف وحرّر الخانة"}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
