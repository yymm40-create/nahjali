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

const SWATCH: Record<MahdiTheme, { bg: string; card: string; ink: string; gold: string }> = {
  cinematic: { bg: "linear-gradient(180deg,#5b4a2e,#0d0c0b 70%)", card: "rgba(30,26,22,0.8)", ink: "#f7f0e3", gold: "#e2bc66" },
  minimal: { bg: "#faf6ee", card: "#ffffff", ink: "#1f1b16", gold: "#bf9746" },
  night: { bg: "radial-gradient(80% 60% at 50% 0%, #3a3020, #0a0b0d 70%)", card: "#121418", ink: "#ede7db", gold: "#ddb963" },
};

/** The three looks, each with a small preview drawn in its own colours. */
export function ThemePicker({ value, onChange }: { value: MahdiTheme; onChange: (t: MahdiTheme) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label={t.more.theme}>
      {MAHDI_THEMES.map((th) => {
        const s = SWATCH[th.key];
        return (
          <button key={th.key} type="button" role="radio" aria-checked={value === th.key} onClick={() => onChange(th.key)} className="m-option space-y-2 p-2 text-start">
            <span className="block h-24 overflow-hidden rounded-xl p-2.5" style={{ background: s.bg }} aria-hidden="true">
              <span className="block h-2 w-16 rounded-full" style={{ background: s.gold }} />
              <span className="mt-2 block rounded-lg p-2" style={{ background: s.card, border: "1px solid rgba(128,128,128,0.25)" }}>
                <span className="block h-1.5 w-20 rounded-full" style={{ background: s.ink, opacity: 0.8 }} />
                <span className="mt-1.5 block h-1.5 w-12 rounded-full" style={{ background: s.gold }} />
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
