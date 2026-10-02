"use client";

import { FILM_LIMITS } from "@config/film";

export interface FieldValues {
  title: string;
  story: string;
  fixedFacts: string;
  targetDurationSec: string;
}

// Accepts Arabic-Indic digits too (٦٠ → 60)
const toDigits = (s: string) =>
  s
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[^\d]/g, "")
    .slice(0, 4);

/** Title, story, fixed facts and approximate duration — shared by the new-project and project pages. */
export default function ProjectFields({
  values,
  onChange,
  disabled,
}: {
  values: FieldValues;
  onChange: (v: FieldValues) => void;
  disabled?: boolean;
}) {
  const set = (key: keyof FieldValues) => (e: { target: { value: string } }) => onChange({ ...values, [key]: e.target.value });

  return (
    <div className="card space-y-4 p-5">
      <label className="block space-y-1">
        <span className="font-extrabold">عنوان المشروع</span>
        <input className="field" value={values.title} onChange={set("title")} maxLength={FILM_LIMITS.titleMax} disabled={disabled} placeholder="مثلًا: ليلة الفداء" />
      </label>
      <label className="block space-y-1">
        <span className="font-extrabold">فكرتك وقصتك</span>
        <textarea
          className="field min-h-48"
          value={values.story}
          onChange={set("story")}
          maxLength={FILM_LIMITS.storyMax}
          disabled={disabled}
          placeholder="فكرتي في جملة، ثم قصتي: من الشخصيات؟ كيف تبدأ؟ وش يصير؟ وشلون تنتهي؟"
        />
      </label>
      <label className="block space-y-1">
        <span className="font-extrabold">أشياء ثابتة ما تبيها تتغير <span className="text-sm text-muted">(اختياري)</span></span>
        <textarea
          className="field min-h-24"
          value={values.fixedFacts}
          onChange={set("fixedFacts")}
          maxLength={FILM_LIMITS.factsMax}
          disabled={disabled}
          placeholder="مثلًا: الأحداث كما وردت في الرواية، أو وجه الشخصية نور بلا ملامح"
        />
      </label>
      <label className="block space-y-1">
        <span className="font-extrabold">مدة تقريبية بالثواني <span className="text-sm text-muted">(اختياري)</span></span>
        <input className="field" inputMode="numeric" value={values.targetDurationSec} onChange={(e) => onChange({ ...values, targetDurationSec: toDigits(e.target.value) })} disabled={disabled} placeholder="مثلًا 60" />
      </label>
    </div>
  );
}
