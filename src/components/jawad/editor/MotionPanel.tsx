"use client";

// «حيدرة كت» · «مسار الموشن»: the settings of one motion element, in three tabs like a reels editor's —
// «العنصر» (its time, its words and each line with the moment it comes in, its place and size), «الكتابة» (the font)
// and «الشكل» (a theme, or the person's own colours, the panel behind it and how it comes in). Every change is one
// `update_clip` with a `motion` patch, so it is undone like any edit and drawn at once.

import { useState } from "react";
import { clipLength, formatTime, type Clip } from "@/lib/editor/model";
import { AMBIENT_SHAPES, MOTION_ENTERS, MOTION_KINDS, MOTION_LIMITS, MOTION_THEMES, motionColors, type MotionColors, type MotionEl, type MotionEnter, type MotionItem, type MotionThemeId } from "@/lib/editor/motion-elements";
import FontPicker from "./FontPicker";
import type { Run } from "./Inspector";
import type { PlayerLike } from "./Timeline";

type Tab = "el" | "type" | "look";
const TABS: { id: Tab; label: string }[] = [
  { id: "el", label: "العنصر" },
  { id: "type", label: "الكتابة" },
  { id: "look", label: "الشكل" },
];
const COLOR_FIELDS: { id: keyof MotionColors; label: string }[] = [
  { id: "bg", label: "الخلفية" },
  { id: "panel", label: "اللوحة" },
  { id: "text", label: "النص" },
  { id: "accent", label: "البارز" },
  { id: "second", label: "الثانوي" },
];
const PLACES: { label: string; x: number; y: number }[] = [
  { label: "فوق", x: 0.5, y: 0.25 },
  { label: "النص", x: 0.5, y: 0.5 },
  { label: "تحت", x: 0.5, y: 0.75 },
];
const sec = (ms: number) => Math.round(ms / 100) / 10;

export default function MotionPanel({ clip, motion: m, locked, run, player }: { clip: Clip; motion: MotionEl; locked: boolean; run: Run; player: PlayerLike | null }) {
  const [tab, setTab] = useState<Tab>("el");
  const set = (patch: Partial<MotionEl>, key: string) => run({ type: "update_clip", clipId: clip.id, patch: { motion: patch } }, { coalesce: `${clip.id}:motion:${key}` });
  const length = clipLength(clip);
  const kind = MOTION_KINDS[m.kind];
  const setItem = (i: number, p: Partial<MotionItem>, key: string) => set({ items: m.items.map((it, j) => (j === i ? { ...it, ...p } : it)) }, `item:${i}:${key}`);
  // «الحين»: the line comes in at the playhead (where the person stopped the video on the word)
  const here = () => Math.max(0, Math.min(length - 200, Math.round((player?.ms ?? clip.start) - clip.start + clip.in)));
  const c = motionColors(m);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-xl border border-violet-500/40 bg-violet-500/10 p-2.5">
        <span className="text-2xl" aria-hidden>{kind.icon}</span>
        <span className="min-w-0 flex-1">
          <b className="block truncate text-sm">{kind.label}</b>
          <span className="text-[11px] text-jw-muted">عنصر موشن · {formatTime(length)} · يتعدّل كله من هنا</span>
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-jw-surface-2 p-1" role="tablist" aria-label="إعدادات العنصر">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`rounded-lg py-1.5 text-xs font-bold ${tab === t.id ? "bg-jw-accent text-black" : "text-jw-muted"}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "el" && m.kind === "ambient" && (
        <div className="space-y-3">
          <p className="text-xs font-semibold">الشكل</p>
          <div className="grid grid-cols-2 gap-1">
            {(Object.entries(AMBIENT_SHAPES) as [MotionEl["shape"], string][]).map(([id, label]) => (
              <button key={id} type="button" disabled={locked} aria-pressed={m.shape === id} className={`jw-btn !min-h-8 text-xs ${m.shape === id ? "jw-btn-primary" : "jw-btn-quiet"}`} onClick={() => set({ shape: id }, "shape")}>
                {label}
              </button>
            ))}
          </div>
          <Range label="السرعة" value={Math.round(m.speed * 100)} min={25} max={200} disabled={locked} onChange={(v) => set({ speed: v / 100 }, "speed")} unit="%" />
          <Range label="الحجم" value={Math.round(m.size * 100)} min={50} max={200} disabled={locked} onChange={(v) => set({ size: v / 100 }, "size")} unit="%" />
          <label className="flex items-center justify-between text-xs">
            <span>لون خلفية تحتها</span>
            <input type="checkbox" checked={m.panel} disabled={locked} onChange={(e) => set({ panel: e.target.checked }, "panel")} />
          </label>
        </div>
      )}

      {tab === "el" && m.kind !== "ambient" && (
        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="text-xs text-jw-muted">{m.kind === "phrase" ? "العبارة" : m.kind === "big" ? "الوصف تحت الرقم" : "العنوان"}</span>
            <input className="jw-input w-full" dir="auto" maxLength={MOTION_LIMITS.title} value={m.title} disabled={locked} onChange={(e) => set({ title: e.target.value }, "title")} />
          </label>
          {m.kind === "title" && (
            <label className="block space-y-1">
              <span className="text-xs text-jw-muted">السطر اللي تحته</span>
              <input className="jw-input w-full" dir="auto" maxLength={MOTION_LIMITS.sub} value={m.sub} disabled={locked} onChange={(e) => set({ sub: e.target.value }, "sub")} />
            </label>
          )}
          {m.kind === "phrase" && (
            <label className="block space-y-1">
              <span className="text-xs text-jw-muted">الكلمة المميّزة (من العبارة)</span>
              <input className="jw-input w-full" dir="auto" maxLength={MOTION_LIMITS.sub} value={m.sub} disabled={locked} onChange={(e) => set({ sub: e.target.value }, "sub")} />
            </label>
          )}
          {m.kind === "big" && (
            <div className="grid grid-cols-[1fr_5rem] gap-2">
              <label className="block space-y-1">
                <span className="text-xs text-jw-muted">الرقم (يعدّ لين يوصله)</span>
                <input className="jw-input w-full" dir="ltr" inputMode="decimal" maxLength={MOTION_LIMITS.sub} value={m.sub} disabled={locked} onChange={(e) => set({ sub: e.target.value }, "sub")} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-jw-muted">الوحدة</span>
                <input className="jw-input w-full" dir="ltr" maxLength={MOTION_LIMITS.unit} value={m.unit} placeholder="% K $" disabled={locked} onChange={(e) => set({ unit: e.target.value }, "unit")} />
              </label>
            </div>
          )}
          {m.kind === "list" && (
            <div className="space-y-2">
              <p className="text-xs font-semibold">البنود — كل بند يدخل بوقته</p>
              {m.items.map((it, i) => (
                <div key={i} className="space-y-1.5 rounded-xl border border-jw-line p-2">
                  <div className="flex items-center gap-2">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-jw-surface-2 text-[11px] font-bold">{i + 1}</span>
                    <input className="jw-input min-w-0 flex-1" dir="auto" maxLength={MOTION_LIMITS.item} value={it.text} disabled={locked} onChange={(e) => setItem(i, { text: e.target.value }, "text")} aria-label={`نص البند ${i + 1}`} />
                    <button type="button" className="text-xs text-red-400" disabled={locked} onClick={() => set({ items: m.items.filter((_, j) => j !== i) }, "items")} aria-label={`احذف البند ${i + 1}`}>
                      حذف
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-jw-muted">يدخل عند</span>
                    <input className="jw-input !min-h-8 w-20" type="number" dir="ltr" min={0} step={0.1} value={sec(it.at)} disabled={locked} onChange={(e) => setItem(i, { at: Math.max(0, Math.round(Number(e.target.value) * 1000)) }, "at")} aria-label={`وقت البند ${i + 1} بالثواني`} />
                    <span className="text-jw-muted">ثانية</span>
                    <button type="button" className="jw-btn jw-btn-quiet !min-h-8 text-[11px]" disabled={locked || !player} onClick={() => setItem(i, { at: here() }, "at")}>
                      الحين ⏱
                    </button>
                  </div>
                </div>
              ))}
              {m.items.length < MOTION_LIMITS.items && (
                <button type="button" className="jw-btn jw-btn-quiet w-full text-xs" disabled={locked} onClick={() => set({ items: [...m.items, { text: `النقطة ${m.items.length + 1}`, at: Math.min(length - 400, (m.items.at(-1)?.at ?? 0) + 800) }] }, "items")}>
                  + بند
                </button>
              )}
            </div>
          )}
          <div className="space-y-1.5 border-t border-jw-line pt-3">
            <p className="text-xs font-semibold">المكان والحجم</p>
            <div className="grid grid-cols-3 gap-1">
              {PLACES.map((pl) => (
                <button key={pl.label} type="button" className={`jw-btn !min-h-8 text-xs ${Math.abs(m.y - pl.y) < 0.05 && Math.abs(m.x - pl.x) < 0.05 ? "jw-btn-primary" : "jw-btn-quiet"}`} disabled={locked} onClick={() => set({ x: pl.x, y: pl.y }, "place")}>
                  {pl.label}
                </button>
              ))}
            </div>
            <Range label="أفقي" value={Math.round(m.x * 100)} min={0} max={100} disabled={locked} onChange={(v) => set({ x: v / 100 }, "x")} unit="%" />
            <Range label="عمودي" value={Math.round(m.y * 100)} min={0} max={100} disabled={locked} onChange={(v) => set({ y: v / 100 }, "y")} unit="%" />
            <Range label="الحجم" value={Math.round(m.size * 100)} min={50} max={200} disabled={locked} onChange={(v) => set({ size: v / 100 }, "size")} unit="%" />
          </div>
        </div>
      )}

      {tab === "type" && (
        <div className="space-y-3">
          <div className="space-y-1">
            <span className="text-xs text-jw-muted">الخط</span>
            <FontPicker value={m.font} disabled={locked} onPick={(f) => set({ font: f }, "font")} />
          </div>
          <p className="rounded-lg bg-jw-surface-2 p-2 text-[11px] leading-5 text-jw-muted">الكلمات تتحرك كاملة (ما تتقطع الحروف العربية)، والأرقام بالإنجليزي مثل أسلوب ماجد.</p>
        </div>
      )}

      {tab === "look" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.entries(MOTION_THEMES) as [MotionThemeId, (typeof MOTION_THEMES)[MotionThemeId]][]).map(([id, t]) => (
              <button key={id} type="button" disabled={locked} aria-pressed={m.theme === id && !m.colors} className={`flex items-center gap-2 rounded-xl border p-2 text-start text-xs ${m.theme === id && !m.colors ? "border-jw-accent" : "border-jw-line"}`} onClick={() => set({ theme: id, colors: null }, "theme")}>
                <span className="flex shrink-0 overflow-hidden rounded-md" aria-hidden>
                  {[t.panel, t.accent, t.second].map((col) => (
                    <span key={col} className="block h-5 w-3" style={{ background: col }} />
                  ))}
                </span>
                {t.label}
              </button>
            ))}
          </div>
          <div className="space-y-1.5 border-t border-jw-line pt-3">
            <p className="text-xs font-semibold">ألوانك (فوق الثيم)</p>
            {COLOR_FIELDS.map((f) => (
              <label key={f.id} className="flex items-center justify-between text-xs">
                <span>{f.label}</span>
                <input type="color" disabled={locked} value={c[f.id]} onChange={(e) => set({ colors: { ...c, [f.id]: e.target.value } }, `color:${f.id}`)} aria-label={`لون ${f.label}`} />
              </label>
            ))}
            {m.colors && (
              <button type="button" className="jw-btn jw-btn-quiet w-full text-xs" disabled={locked} onClick={() => set({ colors: null }, "theme")}>
                رجّع ألوان الثيم
              </button>
            )}
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" className="accent-[var(--jw-accent)]" disabled={locked} checked={m.panel} onChange={(e) => set({ panel: e.target.checked }, "panel")} />
            لوحة خلفه (بدونها الكلام على الفيديو مباشرة)
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-jw-muted">الدخول</span>
            <select className="jw-input !min-h-9 w-full text-sm" disabled={locked} value={m.enter} onChange={(e) => set({ enter: e.target.value as MotionEnter }, "enter")}>
              {(Object.entries(MOTION_ENTERS) as [MotionEnter, string][]).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}

function Range({ label, value, min, max, onChange, disabled, unit }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; disabled?: boolean; unit: string }) {
  return (
    <label className="block space-y-1">
      <span className="flex items-center justify-between text-xs text-jw-muted">
        <span>{label}</span>
        <span className="tabular-nums text-jw-ink" dir="ltr">
          {value}
          {unit}
        </span>
      </span>
      <input type="range" dir="ltr" className="w-full accent-[var(--jw-accent)]" min={min} max={max} step={1} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}
