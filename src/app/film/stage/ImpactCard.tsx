"use client";

// «الرجوع الذكي»: an edit reached later work. The person sees exactly which sheets and shots it touches (and what
// stays), unticks any they want left alone, then «حدّث المتأثر» sends each one to its maker — or «خلّه» leaves all.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/lib/fetch";
import type { Impact } from "@/lib/film/impact";

export default function ImpactCard({ projectId, impact }: { projectId: string; impact: Impact }) {
  const router = useRouter();
  const [sheets, setSheets] = useState<string[]>(impact.sheets.map((s) => s.id));
  const [gens, setGens] = useState<string[]>(impact.generations.map((g) => g.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const n = sheets.length + gens.length;

  async function go(action: "apply" | "drop") {
    setBusy(true);
    setError("");
    try {
      await postJson(`/api/film/projects/${projectId}/impact`, { action, id: impact.id, sheets, generations: gens });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <section className="card fs-impact space-y-3 p-4" aria-label="الرجوع الذكي">
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden>🔁</span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-black">{impact.source === "sheet" ? `صورة «${impact.sourceName}» تغيّرت` : "السيناريو تغيّر، وسجاد قارن النسختين"}</p>
          <p className="text-sm font-bold leading-7 text-muted">{impact.summary}</p>
        </div>
      </div>
      {(impact.sheets.length > 0 || impact.generations.length > 0) && (
        <div className="space-y-1.5">
          <p className="text-xs font-extrabold">يتأثر بالتغيير (اللي تتركه معلّمًا ينعاد، واللي تشيل علامته يبقى):</p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {impact.sheets.map((s) => (
              <label key={s.id} className="pick" data-on={sheets.includes(s.id)}>
                <input type="checkbox" className="mt-1 size-4" checked={sheets.includes(s.id)} onChange={() => toggle(sheets, setSheets, s.id)} />
                <span><b>🎨 {s.name}</b><span className="block text-xs text-muted">{s.why}</span></span>
              </label>
            ))}
            {impact.generations.map((g) => (
              <label key={g.id} className="pick" data-on={gens.includes(g.id)}>
                <input type="checkbox" className="mt-1 size-4" checked={gens.includes(g.id)} onChange={() => toggle(gens, setGens, g.id)} />
                <span><b>🎥 {g.id} · {g.name}</b><span className="block text-xs text-muted">{g.why}</span></span>
              </label>
            ))}
          </div>
        </div>
      )}
      {impact.kept.length > 0 && (
        <p className="text-xs font-bold text-muted">
          يبقى كما هو: {impact.kept.slice(0, 12).map((k) => <span key={k} className="keep">{k}</span>)}{impact.kept.length > 12 ? ` و${impact.kept.length - 12} غيرها` : ""}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary flex-1" disabled={busy || !n} onClick={() => go("apply")}>
          {busy ? "نرسل…" : `🔁 حدّث المتأثر (${n})`}
        </button>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => go("drop")}>خلّه كما هو</button>
      </div>
      <p className="text-xs font-bold text-muted">كل عنصر يُعاد يُرسل لصانعه (صانع الشيت أو المخرج) كتعديل عادي، وتعتمد نسخته الجديدة مثل أي خطوة. ما يُحسب شي إلا على اللي ينعاد فعلًا.</p>
      {error && <p className="error-box text-sm">{error}</p>}
    </section>
  );
}
