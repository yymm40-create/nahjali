"use client";

import Image from "next/image";
import { MAHDI_THEMES, type MahdiTheme } from "@config/mahdi";
import { t } from "@/lib/mahdi/i18n";
import type { Shrine } from "@/lib/mahdi/types";
import Icon from "./Icon";

/** The shrine choices; those without a picture yet show «قريبًا» and can't be chosen. */
export function ShrinePicker({ shrines, value, onChange }: { shrines: Shrine[]; value: string; onChange: (s: Shrine) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t.more.shrine}>
      {shrines.map((s) => {
        const usable = s.active && Boolean(s.imageUrl);
        return (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={value === s.id}
            aria-disabled={!usable}
            disabled={!usable}
            onClick={() => usable && onChange(s)}
            className="m-option flex items-center gap-3 overflow-hidden p-2 text-start"
          >
            <span className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl" style={{ background: "var(--m-surface-2)" }}>
              {s.imageUrl ? (
                <Image src={s.imageUrl} alt="" fill sizes="64px" className="object-cover" style={{ objectPosition: s.imagePosition }} />
              ) : (
                <Icon name="dome" size={26} className="m-muted" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block font-semibold leading-snug">{s.name}</span>
              <span className="block text-sm m-muted">{s.place}</span>
              {!usable && <span className="m-chip mt-1">{t.common.soon}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

interface Swatch {
  bg: string;
  card: string;
  ink: string;
  muted: string;
  primary: string;
  primaryInk: string;
  font: string;
  radius: number;
  border: string;
  shadow: string;
  sample: string;
}

/** Each look drawn in its own letters, corners, outlines and colours (a small screen of it). */
const SWATCH: Record<MahdiTheme, Swatch> = {
  aurora: { bg: "radial-gradient(60% 50% at 90% 0%, #fbcfe8, transparent 70%), radial-gradient(60% 50% at 0% 20%, #ddd6fe, transparent 70%), #f6f0ff", card: "rgba(255,255,255,.9)", ink: "#1d1534", muted: "#6b6185", primary: "linear-gradient(120deg,#7c3aed,#ec4899 60%,#f97316)", primaryInk: "#fff", font: "var(--font-readex)", radius: 18, border: "1px solid rgba(124,58,237,.12)", shadow: "0 10px 24px -14px rgba(91,33,182,.4)", sample: "يومك ٨٠٪" },
  neon: { bg: "radial-gradient(50% 40% at 90% 0%, rgba(34,211,238,.35), transparent 70%), radial-gradient(50% 40% at 0% 60%, rgba(255,61,168,.3), transparent 70%), #07070d", card: "rgba(20,20,34,.85)", ink: "#f2f4ff", muted: "#a3a8c3", primary: "linear-gradient(120deg,#c6ff3d,#22d3ee)", primaryInk: "#07070d", font: "var(--font-lalezar)", radius: 12, border: "1px solid rgba(140,255,220,.25)", shadow: "0 0 18px -6px rgba(34,211,238,.6)", sample: "يومك ٨٠٪" },
  pop: { bg: "radial-gradient(#e9d7a8 1.2px, transparent 1.4px) 0 0 / 14px 14px, #fff4dc", card: "#fff", ink: "#121212", muted: "#4a4337", primary: "#ccff00", primaryInk: "#121212", font: "var(--font-baloo)", radius: 10, border: "2px solid #121212", shadow: "3px 3px 0 #121212", sample: "يومك ٨٠٪" },
  cinematic: { bg: "linear-gradient(180deg,#5b4a2e,#0d0c0b 70%)", card: "rgba(30,26,22,0.85)", ink: "#f7f0e3", muted: "#cbc1b0", primary: "linear-gradient(180deg,#f4da95,#e2bc66)", primaryInk: "#1c1406", font: "var(--font-amiri)", radius: 14, border: "1px solid rgba(255,234,196,.2)", shadow: "0 10px 24px -14px #000", sample: "يومك ٨٠٪" },
  minimal: { bg: "#faf6ee", card: "#ffffff", ink: "#1f1b16", muted: "#675e52", primary: "linear-gradient(180deg,#ddbe72,#bf9746)", primaryInk: "#1f1505", font: "var(--font-amiri)", radius: 14, border: "1px solid #e8ddcb", shadow: "none", sample: "يومك ٨٠٪" },
  night: { bg: "radial-gradient(80% 60% at 50% 0%, #3a3020, #0a0b0d 70%)", card: "#121418", ink: "#ede7db", muted: "#a8a195", primary: "linear-gradient(180deg,#f0d48b,#ddb963)", primaryInk: "#17110a", font: "var(--font-amiri)", radius: 14, border: "1px solid #272b32", shadow: "none", sample: "يومك ٨٠٪" },
};

/** The four looks, each previewed as a small screen in its own style. (An older look someone still has stays shown.) */
export function ThemePicker({ value, onChange }: { value: MahdiTheme; onChange: (t: MahdiTheme) => void }) {
  const list = MAHDI_THEMES.filter((th) => !th.legacy || th.key === value);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" role="radiogroup" aria-label={t.more.theme}>
      {list.map((th) => {
        const s = SWATCH[th.key];
        return (
          <button key={th.key} type="button" role="radio" aria-checked={value === th.key} onClick={() => onChange(th.key)} className="m-option space-y-2 p-2 text-start">
            <span className="block h-36 overflow-hidden rounded-xl p-2.5" style={{ background: s.bg, fontFamily: s.font, color: s.ink }} aria-hidden="true">
              <span className="block text-lg leading-tight font-bold">{th.label}</span>
              <span className="mt-2 flex gap-1.5">
                {[0.8, 0.45].map((v, i) => (
                  <span key={i} className="grid flex-1 place-items-center p-1.5" style={{ background: s.card, border: s.border, borderRadius: s.radius, boxShadow: s.shadow }}>
                    <svg width="34" height="34" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="14" fill="none" stroke={s.muted} strokeOpacity=".25" strokeWidth="5" />
                      <circle cx="18" cy="18" r="14" fill="none" stroke={th.key === "pop" ? "#ff3d9a" : th.key === "neon" ? "#c6ff3d" : th.key === "aurora" ? "#8b5cf6" : "#e2bc66"} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${v * 88} 88`} transform="rotate(-90 18 18)" />
                    </svg>
                  </span>
                ))}
              </span>
              <span className="mt-2 block py-1 text-center text-xs font-bold" style={{ background: s.primary, color: s.primaryInk, borderRadius: s.radius, border: th.key === "pop" ? s.border : undefined, boxShadow: th.key === "pop" ? s.shadow : undefined }}>
                {s.sample}
              </span>
            </span>
            <span className="block px-1 font-semibold">{th.label}</span>
            <span className="block px-1 pb-1 text-sm m-muted">{th.description}</span>
          </button>
        );
      })}
    </div>
  );
}
