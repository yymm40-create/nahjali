"use client";

// «الرضا فويس» — the small controls every panel is built from.

import { useCallback, useRef, type ReactNode } from "react";
import type { ParamSpec } from "@/lib/ridha/model";

export const fmt = (v: number, unit?: string) => {
  const a = Math.abs(v);
  const s = unit === "Hz" ? (a >= 1000 ? `${(v / 1000).toFixed(a >= 10000 ? 0 : 1)}k` : String(Math.round(v))) : a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : v.toFixed(2).replace(/\.?0+$/, "");
  return unit && unit !== "Hz" ? `${s} ${unit}` : unit === "Hz" ? `${s} Hz` : s;
};

/** A labelled slider. `log` moves in octaves (frequencies, times). Double-click returns to the default. */
export function Slider({ label, value, min, max, step = 0.01, unit, log, def, onChange, wide }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; log?: boolean; def?: number; onChange(v: number): void; wide?: boolean }) {
  const toPos = (v: number) => (log ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min));
  const fromPos = (p: number) => {
    const raw = log ? min * (max / min) ** p : min + p * (max - min);
    return Math.max(min, Math.min(max, Math.round(raw / step) * step));
  };
  return (
    <label className={`rv-slider${wide ? " rv-slider-wide" : ""}`} onDoubleClick={() => def != null && onChange(def)}>
      <span className="rv-slider-top">
        <span>{label}</span>
        <b dir="ltr">{fmt(value, unit)}</b>
      </span>
      <input type="range" min={0} max={1} step={0.001} value={toPos(value)} onChange={(e) => onChange(fromPos(Number(e.target.value)))} style={{ ["--fill" as string]: `${toPos(value) * 100}%` }} />
    </label>
  );
}

export function ParamControl({ spec, value, onChange }: { spec: ParamSpec; value: number; onChange(v: number): void }) {
  if (spec.options) {
    return (
      <label className="rv-slider">
        <span className="rv-slider-top">
          <span>{spec.label}</span>
        </span>
        <span className="rv-seg">
          {spec.options.map((o, i) => (
            <button key={o} type="button" className={Math.round(value) === i ? "on" : ""} onClick={() => onChange(i)}>
              {o}
            </button>
          ))}
        </span>
      </label>
    );
  }
  return <Slider label={spec.label} value={value} min={spec.min} max={spec.max} step={spec.step} unit={spec.unit} log={spec.log} def={spec.def} onChange={onChange} />;
}

export function Seg<T extends string | number>({ value, options, onChange, small }: { value: T; options: { value: NoInfer<T>; label: ReactNode; title?: string }[]; onChange(v: NoInfer<T>): void; small?: boolean }) {
  return (
    <span className={`rv-seg${small ? " rv-seg-sm" : ""}`}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" title={o.title} className={o.value === value ? "on" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </span>
  );
}

export function Btn({ children, onClick, kind = "plain", disabled, title, small }: { children: ReactNode; onClick?(): void; kind?: "plain" | "main" | "gold" | "danger" | "ghost"; disabled?: boolean; title?: string; small?: boolean }) {
  return (
    <button type="button" className={`rv-btn rv-btn-${kind}${small ? " rv-btn-sm" : ""}`} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  );
}

export function Empty({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="rv-empty">
      <div className="rv-empty-icon">{icon}</div>
      <b>{title}</b>
      {children ? <p>{children}</p> : null}
    </div>
  );
}

/** A vertical fader in dB with a double-click back to 0. */
export function Fader({ value, onChange, min = -60, max = 6 }: { value: number; onChange(v: number): void; min?: number; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  // the top third of the travel is the last 12 dB: where a mix is actually balanced
  const toPos = (db: number) => (db <= min ? 0 : db >= max ? 1 : db > -12 ? 0.55 + ((db + 12) / (max + 12)) * 0.45 : ((db - min) / (-12 - min)) * 0.55);
  const fromPos = (p: number) => (p <= 0 ? min : p >= 1 ? max : p > 0.55 ? -12 + ((p - 0.55) / 0.45) * (max + 12) : min + (p / 0.55) * (-12 - min));
  const drag = useCallback(
    (e: React.PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      el.setPointerCapture(e.pointerId);
      const move = (ev: PointerEvent) => {
        const r = el.getBoundingClientRect();
        onChange(Math.round(fromPos(1 - (ev.clientY - r.top) / r.height) * 10) / 10);
      };
      move(e.nativeEvent);
      const up = () => {
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", up);
      };
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onChange],
  );
  return (
    <div className="rv-fader" ref={ref} onPointerDown={drag} onDoubleClick={() => onChange(0)} role="slider" aria-valuenow={value} aria-valuemin={min} aria-valuemax={max}>
      <div className="rv-fader-zero" style={{ bottom: `${toPos(0) * 100}%` }} />
      <div className="rv-fader-cap" style={{ bottom: `${toPos(value) * 100}%` }} />
    </div>
  );
}

/** Peak (0–1) as the height of a meter from −60 dB to 0. */
export const meterPos = (peak: number) => (peak <= 0.001 ? 0 : Math.max(0, Math.min(1, (20 * Math.log10(peak) + 60) / 60)));
