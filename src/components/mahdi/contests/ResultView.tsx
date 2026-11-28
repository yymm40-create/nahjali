"use client";

// «مسابقة الثبات» · one participant's result: the whole contest so far against the bar, each week, and each habit
// («22/24 · 92%»), the same numbers the organiser sees.

import { fmtPct } from "@/lib/mahdi/i18n";
import Icon from "../Icon";
import type { EntryResult } from "@/lib/mahdi/contests";

export function scoreColor(score: number | null, threshold: number) {
  if (score === null) return "var(--m-muted)";
  return score * 100 >= threshold ? "var(--m-success)" : score * 100 >= threshold - 15 ? "var(--m-gold)" : "var(--m-warning)";
}

export default function ResultView({ result, threshold, minHabits }: { result: EntryResult; threshold: number; minHabits: number }) {
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="m-num text-4xl font-bold" style={{ color: scoreColor(result.score, threshold) }}>{fmtPct(result.score)}</p>
          <p className="m-muted text-sm m-num">
            {result.achieved} من {result.required} هدف · المطلوب {threshold}٪
          </p>
        </div>
        <span className={`m-chip ${result.qualified ? "m-chip-success" : ""}`}>{result.qualified ? "✓ واصل النسبة" : "ما وصل النسبة للحين"}</span>
      </div>
      <div className="m-bar" aria-hidden="true">
        <span style={{ width: `${Math.round((result.score ?? 0) * 100)}%`, background: scoreColor(result.score, threshold) }} />
      </div>
      {result.habitCount < minHabits && (
        <p className="m-note text-sm">العادات في المشاريع المختارة {result.habitCount}، والمطلوب {minHabits} على الأقل.</p>
      )}
      {result.edited && <p className="m-note flex items-center gap-2 text-sm"><Icon name="alert" size={16} className="shrink-0" /> تغيّر هدف عادة أو انضافت عادة بعد بداية المسابقة.</p>}
      {result.weeks.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {result.weeks.map((w, k) => (
            <span key={k} className="m-chip m-num text-sm" style={{ color: scoreColor(w, threshold) }}>
              الأسبوع {k + 1}: {fmtPct(w)}
            </span>
          ))}
        </div>
      )}
      {result.habits.length > 0 && (
        <ul className="space-y-2">
          {result.habits.map((h, k) => (
            <li key={k} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">{h.name}</span>
                <span className="m-num shrink-0 font-semibold" style={{ color: scoreColor(h.score, threshold) }}>
                  {h.achieved}/{h.required} · {fmtPct(h.score)}
                </span>
              </div>
              <div className="m-bar" aria-hidden="true">
                <span style={{ width: `${Math.round((h.score ?? 0) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
