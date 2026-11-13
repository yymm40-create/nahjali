"use client";

// «قوالب المونتاج»: a template's card, drawn from the template itself (no pictures of anybody): its first words in its
// own colours, the slots as a strip (their lengths to scale), the beat as dots, its length and how many slots.

import { RATIOS } from "@/lib/editor/model";
import { templateMs, type Template } from "@/lib/editor/templates";

const secs = (ms: number) => `${Math.round(ms / 1000)} ث`;

export default function TemplateCard({ t, onPick, on = false, onRemove }: { t: Template; onPick: () => void; on?: boolean; onRemove?: () => void }) {
  const total = templateMs(t) || 1;
  const first = t.texts[0];
  const r = RATIOS[t.ratio];
  const whole = t.slots.some((s) => s.whole);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onPick}
        aria-pressed={on}
        className={`group flex w-full flex-col overflow-hidden rounded-xl border text-start transition hover:border-jw-accent ${on ? "border-jw-accent ring-2 ring-jw-accent" : "border-jw-line"}`}
      >
        <span className="relative flex w-full flex-col justify-between p-2" style={{ aspectRatio: `${Math.max(r.width / r.height, 0.75)}`, background: `linear-gradient(160deg, ${t.accent}55, #0b0b0f 70%)` }}>
          <span className="text-2xl drop-shadow" aria-hidden>{t.icon}</span>
          {first && (
            <span
              className="line-clamp-2 self-center rounded px-1 text-center text-[11px] leading-4"
              style={{ color: first.style.color ?? "#ffffff", background: first.style.box ?? undefined, fontWeight: first.style.weight ?? 700 }}
              dir="auto"
            >
              {first.body}
            </span>
          )}
          <span className="space-y-1">
            {t.bpm ? (
              <span className="flex justify-between px-0.5" aria-hidden>
                {Array.from({ length: 8 }, (_, i) => (
                  <span key={i} className="h-1 w-1 rounded-full bg-white/70" />
                ))}
              </span>
            ) : null}
            <span className="flex h-2 w-full gap-px overflow-hidden rounded-full" aria-hidden>
              {t.slots.map((s, i) => (
                <span key={i} style={{ flexGrow: s.ms / total, background: t.accent, opacity: i % 2 ? 0.55 : 0.95 }} />
              ))}
            </span>
          </span>
        </span>
        <span className="space-y-0.5 p-2">
          <b className="block truncate text-xs">{t.name}</b>
          <span className="block truncate text-[10px] text-jw-muted">
            {t.slots.length} {t.slots.length > 2 && t.slots.length < 11 ? "خانات" : "خانة"} · {whole ? "طول مقطعك" : secs(total)} · <span dir="ltr">{t.ratio}</span>
          </span>
        </span>
      </button>
      {onRemove && (
        <button type="button" className="absolute end-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/50 text-xs text-white hover:bg-jw-danger" onClick={onRemove} aria-label={`احذف ${t.name}`} title="احذف القالب">
          ✕
        </button>
      )}
    </div>
  );
}
