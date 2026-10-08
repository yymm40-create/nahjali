"use client";

import { MINIMAX_FEELINGS } from "@config/jawad/feelings";

// The feeling of a spoken line: one tap, or your own word. ElevenLabs takes it between [ ] (Eleven v4 audio tags);
// a MiniMax voice has its own list (an emotion, or a sound written in the line like (laughs)).
const FEELINGS = [
  ["", "بدون"],
  ["calm", "هادئ"],
  ["cheerful", "مرح"],
  ["excited", "حماس"],
  ["sad", "حزين"],
  ["angry", "غاضب"],
  ["whispers", "همس"],
  ["shouts", "صراخ"],
  ["laughs", "ضحك"],
  ["crying", "بكاء"],
  ["fearful", "خوف"],
  ["serious", "جدّي"],
] as const;

export default function EmotionPicker({ value, onChange, disabled, provider = "elevenlabs" }: { value: string; onChange: (v: string) => void; disabled?: boolean; provider?: "elevenlabs" | "minimax" | "jawad" }) {
  if (provider === "minimax") {
    return (
      <div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label="المشاعر">
        <span className="text-xs font-bold text-muted">المشاعر (MiniMax):</span>
        {MINIMAX_FEELINGS.map(([v, label]) => (
          <button key={v || "none"} type="button" role="radio" aria-checked={value === v} disabled={disabled} onClick={() => onChange(v)} className={`chip text-xs ${value === v ? "bg-gold text-on-gold" : ""}`}>
            {label}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label="المشاعر">
      <span className="text-xs font-bold text-muted">المشاعر [ ]:</span>
      {FEELINGS.map(([v, label]) => (
        <button key={v || "none"} type="button" role="radio" aria-checked={value === v} disabled={disabled} onClick={() => onChange(v)} className={`chip text-xs ${value === v ? "bg-gold text-on-gold" : ""}`}>
          {label}
        </button>
      ))}
      <input className="field !min-h-7 !w-28 !px-2 !py-0 !text-xs" dir="ltr" placeholder="أو اكتب…" maxLength={40} disabled={disabled} value={FEELINGS.some(([v]) => v === value) ? "" : value} onChange={(e) => onChange(e.target.value.replace(/[\[\]]/g, ""))} aria-label="شعور بكلمتك" />
    </div>
  );
}
