"use client";

import { ICON_CHOICES } from "@config/mahdi";
import { t } from "@/lib/mahdi/i18n";

/** Optional icon: a grid of suggestions plus "none". */
export default function IconPicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <fieldset>
      <legend className="m-label">
        {label} <span className="m-muted font-normal">({t.common.optional})</span>
      </legend>
      <div className="m-scroll-x -mx-1 flex gap-1.5 px-1 pb-1" role="radiogroup" aria-label={label}>
        <button type="button" role="radio" aria-checked={value === ""} className="m-option grid size-11 shrink-0 place-items-center text-xs" onClick={() => onChange("")}>
          {t.habit.noIcon}
        </button>
        {ICON_CHOICES.map((i) => (
          <button key={i} type="button" role="radio" aria-checked={value === i} aria-label={i} className="m-option grid size-11 shrink-0 place-items-center text-xl" onClick={() => onChange(i)}>
            {i}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
