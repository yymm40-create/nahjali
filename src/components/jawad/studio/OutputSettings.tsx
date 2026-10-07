"use client";

import type { OptionState, Settings, SettingValue } from "@config/jawad/types";
import type { Evaluation } from "@/lib/jawad/engine";
import Icon from "../Icon";
import VoicePicker from "./VoicePicker";

/** The output options this generator really supports in this mode (nothing shared by default between generators). */
export default function OutputSettings({ ev, values, onChange, voiceCoins, voiceProvider }: { ev: Evaluation; values: Settings; onChange: (key: string, v: SettingValue) => void; voiceCoins?: { design: number | null; clone: number | null; cloneMinimax?: number | null }; voiceProvider?: "elevenlabs" | "minimax" }) {
  const shown = ev.options.filter((o) => !o.hidden);
  if (!shown.length) return null;
  return (
    <section aria-label="إعدادات المخرجات" className="space-y-4">
      {shown.map((o) =>
        o.kind === "choice" && o.picker === "voice" ? (
          <div key={o.key}>
            <VoicePicker value={String(values[o.key] ?? o.default)} onChange={(v) => onChange(o.key, v)} coins={voiceCoins ?? { design: null, clone: null }} provider={voiceProvider} />
            {ev.issues.find((i) => i.field === o.key) && <p className="mt-1.5 text-xs text-jw-danger" role="alert">{ev.issues.find((i) => i.field === o.key)!.message}</p>}
          </div>
        ) : (
          <Field key={o.key} o={o} value={values[o.key] ?? o.default} onChange={(v) => onChange(o.key, v)} issue={ev.issues.find((i) => i.field === o.key)?.message} />
        ),
      )}
      {ev.notes.length > 0 && (
        <ul className="space-y-1.5">
          {ev.notes.map((n) => (
            <li key={n} className="flex gap-2 text-xs text-jw-muted">
              <Icon name="info" size={14} className="mt-0.5 shrink-0" />
              <span>{n}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Field({ o, value, onChange, issue }: { o: OptionState; value: SettingValue; onChange: (v: SettingValue) => void; issue?: string }) {
  const id = `jw-opt-${o.key}`;
  if (o.fixed) {
    return (
      <div>
        <span className="jw-label">{o.label}</span>
        <p className="flex items-center gap-2 rounded-lg border border-jw-line bg-jw-bg-2 px-3 py-2 text-sm text-jw-muted">
          <Icon name="lock" size={14} /> {o.fixed.reason}
        </p>
      </div>
    );
  }
  return (
    <div>
      {o.kind === "choice" && (
        <>
          <span className="jw-label" id={id}>{o.label}</span>
          <div className="jw-seg" role="radiogroup" aria-labelledby={id}>
            {o.values.map((v) => {
              const why = o.disabledValues?.[v.value];
              return (
                <button key={v.value} type="button" role="radio" aria-checked={value === v.value} disabled={Boolean(why)} title={why ?? v.hint} onClick={() => onChange(v.value)}>
                  <span dir={o.ltr ? "ltr" : undefined}>{v.label}</span>
                  {v.hint && <span className="text-[10px] text-jw-faint">{v.hint}</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
      {o.kind === "int" && (
        <>
          <label className="jw-label flex items-center justify-between" htmlFor={id}>
            <span>{o.label}</span>
            <span className="tabular-nums text-jw-ink">{String(value)} {o.unit}</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              id={id}
              type="range"
              min={o.min}
              max={o.max}
              step={o.step ?? 1}
              value={Number(value)}
              onChange={(e) => onChange(Number(e.target.value))}
              className="h-1.5 flex-1 cursor-pointer accent-[var(--jw-accent)]"
              dir="ltr"
              aria-valuetext={`${value} ${o.unit}`}
            />
            <span className="text-[11px] text-jw-faint tabular-nums" dir="ltr">{o.min}–{o.max}</span>
          </div>
        </>
      )}
      {o.kind === "bool" && (
        <label className="flex cursor-pointer items-center justify-between gap-3" htmlFor={id}>
          <span>
            <span className="block text-sm">{o.label}</span>
            {o.hint && <span className="block text-[11px] text-jw-faint">{o.hint}</span>}
          </span>
          <span className="relative inline-flex">
            <input id={id} type="checkbox" role="switch" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
            <span className="h-6 w-11 rounded-full border border-jw-line-strong bg-jw-surface-3 transition-colors peer-checked:bg-jw-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--jw-accent)]" />
            <span className="absolute start-0.5 top-0.5 size-5 rounded-full bg-white transition-transform peer-checked:-translate-x-5" />
          </span>
        </label>
      )}
      {issue && <p className="mt-1.5 text-xs text-jw-danger" role="alert">{issue}</p>}
    </div>
  );
}
