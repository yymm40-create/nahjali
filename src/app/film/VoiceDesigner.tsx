"use client";

import { useState } from "react";
import { postJson } from "@/lib/fetch";

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
type Draft = { id: string; previews: { index: number; url: string | null }[] };
type Made = { id: string; previewUrl: string | null };

/**
 * «✨ صوت جديد بالوصف» for one speaker of the film: the person describes the voice (or the AI writes it from the
 * character), three samples are designed, and the one chosen is kept in their voices and given to this speaker.
 */
export default function VoiceDesigner({ projectId, speaker, onCast, disabled = false, minimaxOn = false }: { projectId: string; speaker: string; onCast: (value: string) => Promise<void> | void; disabled?: boolean; minimaxOn?: boolean }) {
  const [open, setOpen] = useState(false);
  // MiniMax first when it's on: one voice per design, no slot limit; ElevenLabs gives three samples but takes a slot
  const [where, setWhere] = useState<"minimax" | "elevenlabs">(minimaxOn ? "minimax" : "elevenlabs");
  const [made, setMade] = useState<Made | null>(null);
  const [desc, setDesc] = useState("");
  const [sample, setSample] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function run<T>(label: string, f: () => Promise<T>) {
    setBusy(label);
    setError("");
    try {
      return await f();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر.");
      return null;
    } finally {
      setBusy(null);
    }
  }
  const write = () =>
    run("يكتب الوصف…", async () => {
      const r = await postJson<{ description: string; sample: string }>(`/api/film/projects/${projectId}/voices`, { action: "describe", speaker, hint: desc });
      setDesc(r.description);
      setSample(r.sample);
    });
  const designMinimax = () =>
    run("MiniMax يصمّم الصوت… (قرابة نصف دقيقة)", async () => {
      const text = sample.trim().slice(0, 500);
      const r = await postJson<{ voice: Made }>("/api/jawad/voices", { action: "design_minimax", key: uid(), description: desc.trim(), text, name: speaker.slice(0, 40) });
      setMade(r.voice);
    });
  const useMade = () =>
    run("يعطيه للشخصية…", async () => {
      await onCast(`v:${made!.id}`);
      setMade(null);
      setOpen(false);
    });
  const design = () =>
    run("يصمّم ٣ عينات…", async () => {
      // a description in the person's words is enough; the sample is the character's lines (or the AI's)
      const text = sample.trim().length >= 100 ? sample.trim().slice(0, 1000) : "";
      const r = await postJson<{ draft: Draft }>("/api/jawad/voices", { action: "design", key: uid(), description: desc.trim(), text });
      setDraft(r.draft);
    });
  const choose = (index: number) =>
    run("يحفظ الصوت…", async () => {
      const r = await postJson<{ voice: { id: string; value?: string } }>("/api/jawad/voices", { action: "save", draftId: draft!.id, index, name: speaker.slice(0, 40) });
      await onCast(`v:${r.voice.id}`);
      setDraft(null);
      setOpen(false);
    });

  if (!open)
    return (
      <button type="button" className="btn btn-ghost min-h-8 px-3 text-xs" disabled={disabled} onClick={() => setOpen(true)}>
        ✨ صوت جديد بالوصف
      </button>
    );
  return (
    <div className="w-full space-y-2 rounded-2xl border border-gold/50 bg-gold/5 p-3 text-sm">
      <p className="font-extrabold">✨ صوت جديد لـ«{speaker}»</p>
      <textarea
        className="field min-h-20 w-full text-sm"
        placeholder="اوصف الصوت (رجل في الأربعين، صوت عميق هادئ، لهجة خليجية…) أو خلّه فاضي واضغط «اكتبه لي»"
        value={desc}
        maxLength={1000}
        onChange={(e) => setDesc(e.target.value)}
        disabled={Boolean(busy)}
      />
      {minimaxOn && (
        <div className="flex gap-1.5" role="radiogroup" aria-label="وين يتصمم الصوت">
          {(
            [
              ["minimax", "MiniMax · صوت واحد · بلا حد"],
              ["elevenlabs", "ElevenLabs · ٣ عينات · خانة"],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" role="radio" aria-checked={where === k} className={`chip text-xs ${where === k ? "bg-gold text-on-gold" : ""}`} disabled={Boolean(busy)} onClick={() => { setWhere(k); setDraft(null); setMade(null); }}>
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-ghost min-h-9 px-3 text-xs" disabled={Boolean(busy)} onClick={write}>
          🤖 {desc.trim() ? "حسّنه لي من الشخصية" : "اكتبه لي من الشخصية"}
        </button>
        <button type="button" className="btn btn-primary min-h-9 px-3 text-xs" disabled={Boolean(busy) || desc.trim().length < 20} onClick={where === "minimax" ? designMinimax : design}>
          {where === "minimax" ? (made ? "🎨 صمّم غيره" : "🎨 صمّم الصوت") : "🎨 صمّم ٣ عينات"}
        </button>
        <button type="button" className="btn btn-ghost min-h-9 px-3 text-xs" disabled={Boolean(busy)} onClick={() => setOpen(false)}>
          إلغاء
        </button>
      </div>
      {busy && <p className="text-xs font-bold text-muted">{busy}</p>}
      {made && where === "minimax" && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 p-2">
          <span className="font-extrabold">الصوت الجديد</span>
          {made.previewUrl && <audio controls preload="none" src={made.previewUrl} className="h-8 min-w-0 flex-1" />}
          <button type="button" className="btn btn-primary min-h-8 px-3 text-xs" disabled={Boolean(busy)} onClick={useMade}>
            اعتمده لـ«{speaker}» ✅
          </button>
          <p className="w-full text-[11px] font-bold text-muted">انحفظ في أصواتك. ما عجبك؟ عدّل الوصف واضغط «صمّم غيره».</p>
        </div>
      )}
      {draft && (
        <ul className="space-y-1.5">
          {draft.previews.map((p) => (
            <li key={p.index} className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 p-2">
              <span className="font-extrabold">عينة {p.index + 1}</span>
              {p.url && <audio controls preload="none" src={p.url} className="h-8 min-w-0 flex-1" />}
              <button type="button" className="btn btn-primary min-h-8 px-3 text-xs" disabled={Boolean(busy)} onClick={() => choose(p.index)}>
                اختر هذا ✅
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-xs font-bold text-red-600">{error}</p>}
    </div>
  );
}
