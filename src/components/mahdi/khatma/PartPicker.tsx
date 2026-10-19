"use client";

// «الختمة العلوية»: what a khatma covers — cut in pages, juz, hizb, half or quarter hizb, and the whole Quran or a stretch
// of it («من الجزء ١ إلى الجزء ٥»، «من صفحة ١ إلى صفحة ١٠٠»). Used by the group's settings and by «ختمتي».

import { amountText, DIVISIONS, fullRange, isFull, portionCount, portionTitle, portionVerses, rangeSize, rangeTitle, verseName, type Division, type PortionRange } from "@/lib/mahdi/khatma/portions";

export interface Part {
  unit: Division;
  range: PortionRange;
}

const UNIT_NAME: Record<Division, string> = { page: "صفحات", juz: "أجزاء", hizb: "أحزاب", half: "أنصاف الأحزاب", quarter: "أرباع الأحزاب" };

/** «من الفاتحة ١ إلى البقرة ٧٤» for a stretch. */
export function partVerses({ unit, range }: Part) {
  return `${verseName(portionVerses(unit, range.from).from)} – ${verseName(portionVerses(unit, range.to).to)}`;
}

export const partText = ({ unit, range }: Part) => `${rangeTitle(unit, range)} · ${amountText(unit, rangeSize(range))}`;

export default function PartPicker({ value, onChange, lockUnit = false }: { value: Part; onChange: (p: Part) => void; lockUnit?: boolean }) {
  const { unit, range } = value;
  const whole = isFull(unit, range);
  const count = portionCount(unit);
  const set = (from: number, to: number) => onChange({ unit, range: { from: Math.max(1, Math.min(from, count)), to: Math.max(Math.max(1, Math.min(from, count)), Math.min(to, count)) } });
  const options = (min: number) => Array.from({ length: count - min + 1 }, (_, i) => min + i);
  return (
    <div className="space-y-3">
      <fieldset className="space-y-2">
        <legend className="m-label">التقسيم</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup">
          {DIVISIONS.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={unit === d}
              disabled={lockUnit && unit !== d}
              className="m-option min-h-11 px-2 text-sm font-semibold"
              onClick={() => unit !== d && onChange({ unit: d, range: fullRange(d) })}
            >
              {UNIT_NAME[d]}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="m-label">وش تقرأ؟</legend>
        <div className="grid grid-cols-2 gap-2" role="radiogroup">
          <button type="button" role="radio" aria-checked={whole} className="m-option min-h-11 px-2 text-sm font-semibold" onClick={() => onChange({ unit, range: fullRange(unit) })}>
            القرآن كاملًا
          </button>
          <button type="button" role="radio" aria-checked={!whole} className="m-option min-h-11 px-2 text-sm font-semibold" onClick={() => whole && set(1, Math.min(count, unit === "page" ? 20 : unit === "juz" ? 1 : 4))}>
            جزء معيّن منه
          </button>
        </div>
        {!whole && (
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="m-label">من</span>
              {unit === "page" ? (
                <input type="number" className="m-field m-num" min={1} max={count} value={range.from} onChange={(e) => set(Number(e.target.value) || 1, Math.max(range.to, Number(e.target.value) || 1))} />
              ) : (
                <select className="m-field m-num" value={range.from} onChange={(e) => set(Number(e.target.value), Math.max(range.to, Number(e.target.value)))}>
                  {options(1).map((n) => <option key={n} value={n}>{portionTitle(unit, n)}</option>)}
                </select>
              )}
            </label>
            <label className="block">
              <span className="m-label">إلى</span>
              {unit === "page" ? (
                <input type="number" className="m-field m-num" min={range.from} max={count} value={range.to} onChange={(e) => set(range.from, Number(e.target.value) || range.from)} />
              ) : (
                <select className="m-field m-num" value={range.to} onChange={(e) => set(range.from, Number(e.target.value))}>
                  {options(range.from).map((n) => <option key={n} value={n}>{portionTitle(unit, n)}</option>)}
                </select>
              )}
            </label>
          </div>
        )}
        <p className="m-num text-sm">
          <strong>{partText(value)}</strong>
          <span className="block text-xs m-muted">{partVerses(value)}</span>
        </p>
      </fieldset>
    </div>
  );
}
