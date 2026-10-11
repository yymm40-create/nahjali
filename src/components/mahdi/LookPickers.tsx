"use client";

import Image from "next/image";
import { MAHDI_THEMES, type GoalsStyle, type MahdiTheme } from "@config/mahdi";
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

/** A tiny drawing of how a design shows the day (its goals style), in the design's own colours. */
function GoalsMark({ style }: { style: GoalsStyle }) {
  const c = "var(--m-gold)";
  const tr = "var(--m-track)";
  const arc = (r: number, v: number, col = c, w = 5) => {
    const C = 2 * Math.PI * r;
    return (
      <>
        <circle cx="20" cy="20" r={r} fill="none" stroke={tr} strokeWidth={w} />
        <circle cx="20" cy="20" r={r} fill="none" stroke={col} strokeWidth={w} strokeLinecap="round" strokeDasharray={`${v * C} ${C}`} transform="rotate(-90 20 20)" />
      </>
    );
  };
  const box = (body: React.ReactNode) => (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
      {body}
    </svg>
  );
  switch (style) {
    case "rings3":
      return box(<>{arc(17, 0.5, "#fa114f", 4)}{arc(11, 0.67, "#a6ff00", 4)}{arc(5, 0.8, "#00e5ff", 4)}</>);
    case "bar":
    case "segments":
      return box(<>{[8, 18, 28].map((y, k) => <g key={y}><rect x="2" y={y} width="36" height="6" rx="3" fill={tr} /><rect x="2" y={y} width={[18, 26, 12][k]} height="6" rx="3" fill={c} /></g>)}</>);
    case "liquid":
      return box(<><rect x="8" y="3" width="24" height="34" rx="8" fill={tr} /><rect x="8" y="18" width="24" height="19" rx="8" fill={c} /></>);
    case "heatmap":
      return box(<>{Array.from({ length: 25 }, (_, k) => <rect key={k} x={2 + (k % 5) * 7.5} y={2 + Math.floor(k / 5) * 7.5} width="6" height="6" rx="1.5" fill={c} opacity={[0.25, 0.5, 0.75, 1, 0.15][(k * 3) % 5]} />)}</>);
    case "garden":
      return box(<><path d="M14 38 L16 28 H24 L26 38Z" fill="#c9774a" /><path d="M20 28 V10" stroke="#3f8f3a" strokeWidth="2.5" /><path d="M20 20 C12 17 10 12 12 9 C18 10 20 15 20 20Z" fill="#5cb85c" /><circle cx="20" cy="8" r="4" fill="#ffd166" /></>);
    case "path":
      return box(<>{[[20, 6], [30, 18], [14, 30]].map(([x, y], k) => <circle key={k} cx={x} cy={y} r="5.5" fill={k < 2 ? "#58cc02" : "#ffc800"} />)}</>);
    case "flame":
      return <span className="text-3xl leading-none" aria-hidden="true">🔥</span>;
    case "gauge":
      return box(<><path d="M5 30 A15 15 0 0 1 35 30" fill="none" stroke={tr} strokeWidth="6" strokeLinecap="round" /><path d="M5 30 A15 15 0 0 1 28 17" fill="none" stroke={c} strokeWidth="6" strokeLinecap="round" /></>);
    case "rpg":
      return <span className="text-3xl leading-none" aria-hidden="true">🧕</span>;
    case "stickers":
      return box(<><rect x="4" y="6" width="20" height="14" fill="#ffe08a" transform="rotate(-6 14 13)" /><rect x="16" y="20" width="20" height="14" fill="#bde0fe" transform="rotate(5 26 27)" /></>);
    case "star":
      return box(<polygon points="20,2 25,10 35,7 32,17 38,22 30,27 31,37 21,33 13,38 11,28 2,25 8,17 4,8 14,10" fill={c} stroke="var(--m-gold-2)" strokeWidth="1.5" />);
    case "number":
      return <b className="text-3xl leading-none" style={{ fontFamily: "var(--m-display)" }}>٣</b>;
    case "chip":
      return box(<>{[[20, 12], [10, 28], [30, 28]].map(([x, y], k) => <circle key={k} cx={x} cy={y} r="8" fill="none" stroke={c} strokeWidth="3" />)}</>);
    case "bento":
      return box(<><rect x="2" y="2" width="20" height="36" rx="6" fill={c} /><rect x="24" y="2" width="14" height="17" rx="5" fill="var(--m-gold-2)" /><rect x="24" y="21" width="14" height="17" rx="5" fill={tr} /></>);
    default:
      return box(arc(15, 0.6));
  }
}

/** The designs, each previewed in its own letters, colours, corners and way of drawing the day. */
export function ThemePicker({ value, onChange }: { value: MahdiTheme; onChange: (t: MahdiTheme) => void }) {
  const list = MAHDI_THEMES.filter((th) => !th.legacy || th.key === value);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" role="radiogroup" aria-label={t.more.theme}>
      {list.map((th) => (
        <button key={th.key} type="button" role="radio" aria-checked={value === th.key} onClick={() => onChange(th.key)} className="m-option overflow-hidden p-1.5 text-start">
          <span className="mahdi-root m-sample block h-32 overflow-hidden p-2.5" data-mtheme={th.key} style={{ borderRadius: 12, fontFamily: "var(--m-font)" }} aria-hidden="true">
            <span className="flex items-center gap-1.5">
              <b className="flex-1 truncate text-sm" style={{ fontFamily: "var(--m-display)", fontWeight: "var(--m-display-weight)" as unknown as number, color: "var(--m-ink)" }}>{th.label}</b>
              {th.n > 0 && <span className="m-num text-[10px]" style={{ color: "var(--m-muted)" }}>{th.n}</span>}
            </span>
            <span className="mt-1.5 flex items-center gap-2">
              <span className="grid place-items-center p-1.5" style={{ background: "var(--m-surface)", border: "var(--m-border-w) solid var(--m-line)", borderRadius: "calc(var(--m-radius) * 0.6)", boxShadow: "var(--m-shadow)", color: "var(--m-ink)" }}>
                <GoalsMark style={th.goals} />
              </span>
              <span className="flex flex-1 flex-col gap-1">
                {[0.8, 0.5].map((w, k) => (
                  <span key={k} className="block h-1.5 rounded-full" style={{ width: `${w * 100}%`, background: k ? "var(--m-muted)" : "var(--m-ink)", opacity: k ? 0.5 : 0.8 }} />
                ))}
              </span>
            </span>
            <span className="mt-2 block py-1 text-center text-[11px] font-bold" style={{ background: "var(--m-primary-bg)", color: "var(--m-gold-ink)", border: "var(--m-primary-border)", boxShadow: "var(--m-primary-shadow)", borderRadius: "calc(var(--m-radius) * 0.5)" }}>
              ٣ من ٦ ✓
            </span>
          </span>
          <span className="block px-1 pt-2 font-semibold leading-snug">
            {th.n > 0 && <span className="m-num m-gold">{th.n}. </span>}
            {th.label}
          </span>
          <span className="block px-1 pb-1 text-xs m-muted">{th.description}</span>
        </button>
      ))}
    </div>
  );
}
