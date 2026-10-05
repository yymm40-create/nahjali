"use client";

// The feeling of a spoken line: one tap, or your own word. It is sent between [ ] (Eleven v4 audio tags).
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

export default function EmotionPicker({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
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
