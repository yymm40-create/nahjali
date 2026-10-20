"use client";

import { HABIT_COLORS } from "@config/mahdi";
import { t } from "@/lib/mahdi/i18n";

/** The habit's own colour: one of HABIT_COLORS, or none (the project's colour). */
export default function HabitColorPicker({ value, onChange }: { value: string | null; onChange: (key: string | null) => void }) {
  return (
    <fieldset>
      <legend className="m-label">{t.project.habitColor}</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t.project.habitColor}>
        <button
          type="button"
          role="radio"
          aria-checked={value === null}
          aria-label={t.project.habitColorNone}
          title={t.project.habitColorNone}
          className="m-option grid size-10 place-items-center"
          onClick={() => onChange(null)}
        >
          <span className="size-5 rounded-full border-2 border-dashed" style={{ borderColor: "var(--pc, var(--m-gold))" }} />
        </button>
        {HABIT_COLORS.map((c) => (
          <button
            key={c.key}
            type="button"
            role="radio"
            aria-checked={value === c.key}
            aria-label={c.name}
            title={c.name}
            className="m-option grid size-10 place-items-center"
            onClick={() => onChange(c.key)}
          >
            <span className="size-5 rounded-full" style={{ background: c.hex }} />
          </button>
        ))}
      </div>
    </fieldset>
  );
}
