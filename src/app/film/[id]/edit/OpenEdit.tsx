"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/lib/fetch";

type Cut = { genId: string; name: string; videoId: string | null; note: string };

/**
 * The montage, the way the person wants it: «رتّبها كما هي» (the takes in the director's order, as they are) or «قص
 * وعدّل بحسب ملاحظاتي» — then «حيدرة» opens with the person's notes on each take (what they didn't like, from where to
 * where) and cuts, trims, reorders and overlaps to remove the visible flaws and fix the flow. Before that, حيدرة asks
 * about the notes; nothing written means the take is fine as it is.
 */
export default function OpenEdit({ filmId, exists, disabled, cut, filmTitle }: { filmId: string; exists: boolean; disabled: boolean; cut: Cut[]; filmTitle: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>(() => Object.fromEntries(cut.map((c) => [c.genId, c.note])));
  const [asked, setAsked] = useState(false);
  const open = async (fix: boolean) => {
    setBusy(true);
    setError(null);
    try {
      // the notes are kept with each take (the next visit starts from them)
      for (const c of cut) if (c.videoId && (notes[c.genId] ?? "") !== c.note) await postJson(`/api/film/projects/${filmId}/director`, { action: "montage_note", assetId: c.videoId, text: notes[c.genId] ?? "" });
      const r = await postJson<{ id: string }>(`/api/jawad/editor/film/${filmId}`);
      if (!fix) return router.push(`/jawad-ai/editor/${r.id}`);
      const lines = cut.filter((c) => c.videoId).map((c) => `- ${c.genId} «${c.name}» (ملفه «${filmTitle} · ${c.genId}»): ${notes[c.genId]?.trim() || "عاجبني كما هو"}`);
      const ask = [
        "رتّب مقاطع الفيلم بترتيب المخرج، وسوّ مونتاج احترافي: قص وتعديل وتقديم وتأخير وتداخلات تحذف العيوب الواضحة وتعدّل السياق، بحسب ملاحظاتي على كل لقطة (الأوقات من بداية اللقطة نفسها):",
        ...lines,
        "خلّ الحوار مفهوم والإيقاع سلس، وقل لي باختصار وش سويت في كل لقطة.",
      ].join("\n");
      router.push(`/jawad-ai/editor/${r.id}?haydara=${encodeURIComponent(ask.slice(0, 1800))}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر.");
      setBusy(false);
    }
  };
  const withVideo = cut.filter((c) => c.videoId);
  return (
    <div className="space-y-3">
      {!asked && withVideo.length > 0 ? (
        <div className="space-y-2 rounded-2xl border-2 border-gold p-3">
          <p className="font-extrabold">🎬 قبل المونتاج: عندك ملاحظات على أي لقطة؟</p>
          <p className="text-xs font-bold text-muted">اكتب وش ما عجبك ومن وين لوين (مثلًا: «من ثانية ٣ لـ٥ اليد تتشوّه، احذفها»). اللي تتركها فاضية تعني إنها عاجبتك.</p>
          {withVideo.map((c) => (
            <label key={c.genId} className="block space-y-1">
              <span className="text-sm font-extrabold">{c.genId} · {c.name}</span>
              <textarea className="field min-h-16 text-sm" maxLength={1000} value={notes[c.genId] ?? ""} onChange={(e) => setNotes({ ...notes, [c.genId]: e.target.value })} placeholder="عاجبتني كما هي" />
            </label>
          ))}
          <button type="button" className="btn btn-secondary w-full" onClick={() => setAsked(true)}>كمّل ▶</button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="font-extrabold">كيف تبي المونتاج؟</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" className="btn btn-secondary min-h-14" disabled={disabled || busy} onClick={() => open(false)}>
              {busy ? "لحظة…" : exists ? "✂️ افتح المونتاج كما هو" : "🎞️ رتّبها كما هي (بترتيب المخرج)"}
            </button>
            <button type="button" className="btn btn-primary min-h-14" disabled={disabled || busy} onClick={() => open(true)}>
              {busy ? "لحظة…" : "🪄 قص وعدّل بحسب ملاحظاتي (حيدرة)"}
            </button>
          </div>
        </div>
      )}
      {error && <p className="error-box text-sm">{error}</p>}
    </div>
  );
}
