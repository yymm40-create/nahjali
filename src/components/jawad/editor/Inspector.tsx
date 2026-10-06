"use client";

import { findClip, formatTime, clipLength, RATIOS, ratioOf, type Ratio, type Timeline, type TextStyle } from "@/lib/editor/model";
import type { ClipPatch, Command } from "@/lib/editor/commands";
import Icon from "../Icon";
import type { EditorAsset } from "./types";

export type Run = (cmd: Command | Command[], opts?: { label?: string; coalesce?: string }) => void;

const COLORS = ["#ffffff", "#000000", "#b8f53d", "#facc15", "#f43f5e", "#22d3ee", "#a78bfa", "#fb923c"];
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function Slider({ label, value, min, max, step, onChange, format, disabled, ltr }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string; disabled?: boolean; ltr?: boolean }) {
  return (
    <label className="block space-y-1">
      <span className="flex items-center justify-between text-xs text-jw-muted">
        <span>{label}</span>
        <span className="tabular-nums text-jw-ink" dir="ltr">{format ? format(value) : value}</span>
      </span>
      <input type="range" dir={ltr ? "ltr" : undefined} className="w-full accent-[var(--jw-accent)]" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

/** What can be changed about the selected clip (or the project, when nothing is selected). */
export default function Inspector({ tl, selected, assets, run, readOnly }: { tl: Timeline; selected: string[]; assets: Map<string, EditorAsset>; run: Run; readOnly: boolean }) {
  const found = selected.length === 1 ? findClip(tl, selected[0]) : null;

  if (!found) {
    const ratio = ratioOf(tl);
    return (
      <div className="space-y-4 p-3">
        <h3 className="text-sm font-semibold">المشروع</h3>
        {selected.length > 1 && <p className="text-xs text-jw-muted">محدد {selected.length} مقاطع: تقدر تحذفها أو تقصها مرة وحدة.</p>}
        <div className="space-y-1.5">
          <span className="text-xs text-jw-muted">المقاس</span>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.keys(RATIOS) as Ratio[]).map((r) => (
              <button key={r} type="button" disabled={readOnly} aria-pressed={ratio === r} className={`rounded-lg border px-2 py-2 text-start text-xs ${ratio === r ? "border-jw-accent bg-jw-accent/10" : "border-jw-line hover:border-jw-line-strong"}`} onClick={() => run({ type: "set_ratio", ratio: r })}>
                <b dir="ltr">{r}</b>
                <span className="block text-[10px] text-jw-muted">{RATIOS[r].label}</span>
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center justify-between gap-2 text-xs text-jw-muted">
          لون الخلفية
          <input type="color" disabled={readOnly} value={tl.background} onChange={(e) => run({ type: "set_background", color: e.target.value }, { coalesce: "bg" })} className="h-8 w-12 cursor-pointer rounded border border-jw-line bg-transparent" />
        </label>
        <label className="flex items-start gap-2 text-xs">
          <input type="checkbox" disabled={readOnly} checked={tl.magnetic} onChange={(e) => run({ type: "set_magnetic", on: e.target.checked })} className="mt-0.5 accent-[var(--jw-accent)]" />
          <span>
            <b>المغناطيس</b>
            <span className="block text-jw-muted">المقاطع في المسار الرئيسي تلتصق ببعض بدون فراغات (مثل CapCut).</span>
          </span>
        </label>
        <p className="rounded-lg bg-jw-surface-2 p-2 text-[11px] leading-5 text-jw-muted">
          اختصارات: <b>مسافة</b> تشغيل · <b>S</b> قص · <b>Delete</b> حذف · <b>Ctrl+Z</b> تراجع · <b>Ctrl+D</b> تكرار · الأسهم إطار إطار.
        </p>
      </div>
    );
  }

  const { clip, track } = found;
  const a = clip.assetId ? assets.get(clip.assetId) : null;
  const locked = readOnly || track.locked;
  const set = (patch: ClipPatch, key: string) => run({ type: "update_clip", clipId: clip.id, patch }, { coalesce: `${clip.id}:${key}` });
  const t = clip.transform;
  const text = clip.text;
  const setText = (p: Partial<TextStyle>, key: string) => set({ text: p }, `text:${key}`);

  return (
    <div className="space-y-4 p-3">
      <div className="flex items-center gap-2">
        <Icon name={text ? "type" : a?.kind === "audio" ? "music" : a?.kind === "image" ? "image" : "video"} size={16} />
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold" dir="auto">{text ? "نص" : (a?.name ?? "مقطع")}</h3>
        <span className="text-xs tabular-nums text-jw-muted" dir="ltr">{formatTime(clipLength(clip))}</span>
      </div>
      {track.locked && <p className="text-xs text-jw-warn">المسار مقفول؛ افتح القفل من رأس المسار لتعدّل.</p>}

      {text && (
        <div className="space-y-3">
          <textarea className="jw-textarea min-h-20 w-full text-sm" dir="auto" disabled={locked} value={text.body} onChange={(e) => setText({ body: e.target.value }, "body")} placeholder="اكتب النص" />
          <Slider label="الحجم" value={Math.round(text.size * 1000) / 10} min={2} max={20} step={0.5} disabled={locked} onChange={(v) => setText({ size: v / 100 }, "size")} format={(v) => `${v}%`} />
          <div className="space-y-1">
            <span className="text-xs text-jw-muted">اللون</span>
            <div className="flex flex-wrap gap-1.5">
              {COLORS.map((c) => (
                <button key={c} type="button" disabled={locked} aria-label={c} aria-pressed={text.color === c} className={`h-7 w-7 rounded-full border-2 ${text.color === c ? "border-jw-accent" : "border-jw-line"}`} style={{ background: c }} onClick={() => setText({ color: c }, "color")} />
              ))}
              <input type="color" disabled={locked} value={text.color.slice(0, 7)} onChange={(e) => setText({ color: e.target.value }, "color")} className="h-7 w-9 cursor-pointer rounded border border-jw-line bg-transparent" aria-label="لون آخر" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" disabled={locked} checked={!!text.box} onChange={(e) => setText({ box: e.target.checked ? "#000000b3" : null }, "box")} className="accent-[var(--jw-accent)]" />
            خلفية خلف الكلام
          </label>
          <div className="jw-seg" role="radiogroup" aria-label="الخط">
            {(["readex", "naskh", "kufi"] as const).map((f) => (
              <button key={f} type="button" role="radio" aria-checked={text.font === f} disabled={locked} onClick={() => setText({ font: f }, "font")}>
                {f === "readex" ? "حديث" : f === "naskh" ? "نسخ" : "كوفي"}
              </button>
            ))}
          </div>
          <div className="jw-seg" role="radiogroup" aria-label="السماكة">
            {([400, 700, 900] as const).map((w) => (
              <button key={w} type="button" role="radio" aria-checked={text.weight === w} disabled={locked} onClick={() => setText({ weight: w }, "weight")}>
                {w === 400 ? "عادي" : w === 700 ? "عريض" : "أعرض"}
              </button>
            ))}
          </div>
        </div>
      )}

      {a && a.kind !== "image" && (
        <Slider label="الصوت" value={Math.round(clip.volume * 100)} min={0} max={200} step={5} disabled={locked} onChange={(v) => set({ volume: v / 100 }, "volume")} format={(v) => `${v}%`} />
      )}
      {a && a.kind !== "image" && (
        <div className="space-y-1">
          <span className="text-xs text-jw-muted">السرعة</span>
          <div className="jw-seg" role="radiogroup" aria-label="السرعة">
            {SPEEDS.map((s) => (
              <button key={s} type="button" role="radio" aria-checked={clip.speed === s} disabled={locked} onClick={() => run({ type: "update_clip", clipId: clip.id, patch: { speed: s } })} dir="ltr">
                ×{s}
              </button>
            ))}
          </div>
        </div>
      )}

      {(text || a?.kind !== "audio") && (
        <div className="space-y-3 border-t border-jw-line pt-3">
          {!text && (
            <div className="jw-seg" role="radiogroup" aria-label="الملاءمة">
              <button type="button" role="radio" aria-checked={clip.fit === "cover"} disabled={locked} onClick={() => set({ fit: "cover" }, "fit")}>
                املأ الإطار
              </button>
              <button type="button" role="radio" aria-checked={clip.fit === "contain"} disabled={locked} onClick={() => set({ fit: "contain" }, "fit")}>
                الصورة كاملة
              </button>
            </div>
          )}
          <Slider label="التكبير" value={Math.round(t.scale * 100)} min={10} max={400} step={1} disabled={locked} onChange={(v) => set({ transform: { scale: v / 100 } }, "scale")} format={(v) => `${v}%`} />
          <Slider ltr label="← يسار · يمين →" value={Math.round(t.x * 100)} min={-50} max={150} step={1} disabled={locked} onChange={(v) => set({ transform: { x: v / 100 } }, "x")} format={(v) => `${v}%`} />
          <Slider label="فوق ↕ تحت" value={Math.round(t.y * 100)} min={-50} max={150} step={1} disabled={locked} onChange={(v) => set({ transform: { y: v / 100 } }, "y")} format={(v) => `${v}%`} />
          <Slider label="الدوران" value={Math.round(t.rotate)} min={-180} max={180} step={1} disabled={locked} onChange={(v) => set({ transform: { rotate: v } }, "rotate")} format={(v) => `${v}°`} />
          <Slider label="الشفافية" value={Math.round(t.opacity * 100)} min={0} max={100} step={1} disabled={locked} onChange={(v) => set({ transform: { opacity: v / 100 } }, "opacity")} format={(v) => `${v}%`} />
          <button type="button" className="jw-btn jw-btn-quiet w-full text-xs" disabled={locked} onClick={() => run({ type: "update_clip", clipId: clip.id, patch: { transform: { x: 0.5, y: text ? 0.78 : 0.5, scale: 1, rotate: 0, opacity: 1 } } })}>
            <Icon name="retry" size={14} /> رجّع الوضع الأصلي
          </button>
        </div>
      )}
      {a && a.kind !== "image" && clip.volume > 1 && <p className="text-[11px] text-jw-faint">الصوت فوق ١٠٠٪ يبان في الملف المصدَّر؛ المعاينة تشغّله حتى ١٠٠٪.</p>}
    </div>
  );
}
