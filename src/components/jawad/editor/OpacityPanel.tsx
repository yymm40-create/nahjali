"use client";

// «الشفافية» — Premiere's Opacity section for a clip: how see-through it is (and its motion points), how it mixes
// with what is under it (the blend modes, by family), and keying: a green or blue screen (any colour, picked from the
// screen) or the dark/bright parts made see-through, with the matte shown to tune it.

import { BLEND_MODES, NEW_KEY, type BlendMode, type Clip, type Keyer } from "@/lib/editor/model";
import type { ClipPatch } from "@/lib/editor/commands";
import { keyAsk, type KeyOp } from "./KeyStudio";

const FAMILIES: [string, BlendMode[]][] = [
  ["", ["normal"]],
  ["تغميق", ["darken", "multiply", "color-burn"]],
  ["تفتيح", ["lighten", "screen", "color-dodge", "add"]],
  ["تباين", ["overlay", "soft-light", "hard-light"]],
  ["عكس", ["difference", "exclusion"]],
  ["مكوّنات اللون", ["hue", "saturation", "color", "luminosity"]],
];

/** What each blend mode is good for (one line). */
const USE: Partial<Record<BlendMode, string>> = {
  multiply: "يشيل الأبيض ويخلّي الغامق: شعار أسود على أبيض، ظلال، ورق",
  screen: "يشيل الأسود ويخلّي الفاتح: نار، دخان، غبار، لمعة عدسة على خلفية سوداء",
  add: "مثل الشاشة وأقوى: أضواء وشرار وتوهّج",
  overlay: "يزيد التباين ويدمج الملمس: قوام، حبيبات، ضوء على الصورة",
  "soft-light": "مثل التراكب بس أنعم",
  difference: "فرق الصورتين: لمطابقة لقطتين أو تأثير غريب",
  color: "يلوّن اللي تحته بألوانه ويخلي الإضاءة",
  luminosity: "يخلي إضاءته على ألوان اللي تحته",
};

export default function OpacityPanel({ clip, opacity, locked, set, onOpacity, media }: { clip: Clip; opacity: number; locked: boolean; set: (p: ClipPatch, key: string) => void; onOpacity: (v: number) => void; media: boolean }) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-jw-muted">الشفافية</span>
          <span className="tabular-nums">{Math.round(opacity * 100)}%</span>
        </div>
        <input type="range" className="w-full" min={0} max={100} step={1} value={Math.round(opacity * 100)} disabled={locked} onChange={(e) => onOpacity(Number(e.target.value) / 100)} aria-label="الشفافية" />
        <p className="text-[11px] text-jw-faint">مع نقاط الحركة (تبويب الحركة) تتغيّر مع الوقت: تظهر وتختفي بنعومة.</p>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-semibold">وضع الدمج (Blend Mode)</p>
        {FAMILIES.map(([fam, modes]) => (
          <div key={fam || "normal"} className="space-y-1">
            {fam && <p className="text-[10px] text-jw-faint">{fam}</p>}
            <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={fam || "عادي"}>
              {modes.map((m) => (
                <button key={m} type="button" role="radio" aria-checked={clip.blend === m} disabled={locked} className={`rounded-lg border px-2 py-1 text-[11px] ${clip.blend === m ? "border-jw-accent bg-jw-accent/15 text-jw-accent" : "border-jw-line text-jw-muted hover:text-jw-ink"}`} onClick={() => set({ blend: m }, "blend")}>
                  {BLEND_MODES[m]}
                </button>
              ))}
            </div>
          </div>
        ))}
        {USE[clip.blend] && <p className="rounded-lg bg-jw-surface-2 px-2 py-1.5 text-[11px] text-jw-muted">{USE[clip.blend]}</p>}
      </div>

      {media && <KeyControls clip={clip} locked={locked} set={set} />}
    </div>
  );
}

/**
 * «الكي»: a colour (green/blue screen, or any colour) or the dark/bright parts made see-through. Turning the chroma on
 * finds the screen by itself (🪄); «🎯 اختر من الشاشة» shows the clip's natural colours to click on; «🤖 حيدرة
 * يضبط» lets him look at the matte and correct it (KeyStudio.tsx).
 */
export function KeyControls({ clip, locked, set }: { clip: Clip; locked: boolean; set: (p: ClipPatch, key: string) => void }) {
  const k = clip.key;
  const setKey = (p: Partial<Keyer>, key: string) => set({ key: p }, `key:${key}`);
  const ask = (op: KeyOp) => setTimeout(() => keyAsk(clip.id, op), 0);
  const btn = "rounded-full border border-jw-line px-2.5 py-1 text-[11px] hover:border-jw-accent disabled:opacity-40";
  return (
        <div className="space-y-2 rounded-lg border border-jw-line p-2">
          <p className="text-xs font-semibold">الكي (Keying)</p>
          <div className="jw-seg" role="radiogroup" aria-label="نوع الكي">
            {(
              [
                [null, "بدون"],
                ["chroma", "كروما (شاشة خضراء)"],
                ["luma", "لوما (الإضاءة)"],
              ] as [Keyer["kind"] | null, string][]
            ).map(([kind, label]) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={(k?.kind ?? null) === kind}
                disabled={locked}
                onClick={() => {
                  set({ key: kind ? { ...(k ?? NEW_KEY), kind } : null }, "key:kind");
                  // a new chroma key: the screen found by itself
                  if (kind === "chroma" && k?.kind !== "chroma") ask("auto");
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {k?.kind === "chroma" && (
            <>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" disabled={locked} className={btn} onClick={() => ask("auto")} title="يلقى لون الشاشة والسماحية من الفريم">
                  🪄 كشف تلقائي
                </button>
                <button type="button" disabled={locked} className={btn} onClick={() => ask("pick")} title="تطلع ألوان الفيديو الأصلية؛ اضغط على الشاشة">
                  🎯 اختر من الشاشة
                </button>
                <button type="button" disabled={locked} className={`${btn} border-jw-accent/60`} onClick={() => ask("ai")} title="حيدرة يشوف الماسك والنتيجة ويصلّح الإعدادات (من رصيدك مثل محادثته)">
                  🤖 حيدرة يضبط الكي
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-jw-muted">لون الشاشة</span>
                <input type="color" value={k.color} disabled={locked} onChange={(e) => setKey({ color: e.target.value }, "color")} aria-label="لون الشاشة" className="h-7 w-9 cursor-pointer rounded border border-jw-line bg-transparent" />
                <span className="text-[10px] tabular-nums text-jw-faint" dir="ltr">
                  {k.color}
                </span>
                {(
                  [
                    ["#00b140", "أخضر"],
                    ["#0047bb", "أزرق"],
                  ] as const
                ).map(([c, label]) => (
                  <button key={c} type="button" disabled={locked} className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${k.color === c ? "border-jw-accent" : "border-jw-line"}`} onClick={() => setKey({ color: c }, "color")}>
                    <span className="h-3 w-3 rounded-full" style={{ background: c }} /> {label}
                  </button>
                ))}
              </div>
              <Range label="السماحية (كم يشيل حول اللون)" value={k.tolerance} disabled={locked} onChange={(v) => setKey({ tolerance: v }, "tolerance")} />
              <Range label="تنظيف الخلفية (يشيل بقايا الشاشة)" value={k.clean ?? 0.15} disabled={locked} onChange={(v) => setKey({ clean: v }, "clean")} />
              <Range label="سد الفراغات (يصلّح الثقوب في الشخص)" value={k.fill ?? 0.15} disabled={locked} onChange={(v) => setKey({ fill: v }, "fill")} />
              <Range label="نعومة الحافة" value={k.soft} disabled={locked} onChange={(v) => setKey({ soft: v }, "soft")} />
              <Range label="شدّ الحافة (Choke)" value={k.choke} disabled={locked} onChange={(v) => setKey({ choke: v }, "choke")} />
              <Range label="Despill — إزالة الانعكاس الأخضر" value={k.spill} disabled={locked} onChange={(v) => setKey({ spill: v }, "spill")} />
              <p className="text-[11px] leading-5 text-jw-faint">فعّل «اعرض الماسك»: الشاشة لازم تطلع سودا كلها والشخص أبيض. بقايا رمادية في الخلفية؟ زِد «تنظيف الخلفية». ثقوب في الشخص؟ زِد «سد الفراغات». حافة خضرا؟ زِد الـDespill أو شد الحافة.</p>
            </>
          )}
          {k?.kind === "luma" && (
            <>
              <Range label="يختفي تحت (الأسود)" value={k.low} disabled={locked} onChange={(v) => setKey({ low: Math.min(v, k.high) }, "low")} />
              <Range label="يظهر فوق (الأبيض)" value={k.high} disabled={locked} onChange={(v) => setKey({ high: Math.max(v, k.low) }, "high")} />
              <Range label="نعومة" value={k.soft} disabled={locked} onChange={(v) => setKey({ soft: v }, "soft")} />
              <label className="flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={k.invert} disabled={locked} onChange={(e) => setKey({ invert: e.target.checked }, "invert")} /> اعكس (يشيل الفاتح ويخلي الغامق)
              </label>
            </>
          )}
          {k && (
            <label className="flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={k.show} disabled={locked} onChange={(e) => setKey({ show: e.target.checked }, "show")} /> اعرض الماسك (أبيض يظهر، أسود يختفي)
            </label>
          )}
          {!k && <p className="text-[11px] text-jw-faint">كروما: صوّرت قدام شاشة خضراء أو زرقاء؟ تختفي ويبان اللي تحت المقطع. لوما: يشيل الأسود (أو الأبيض) — للنار والدخان والنصوص على خلفية سوداء.</p>}
        </div>
  );
}

function Range({ label, value, disabled, onChange }: { label: string; value: number; disabled: boolean; onChange: (v: number) => void }) {
  return (
    <label className="block space-y-0.5">
      <span className="flex justify-between text-[11px] text-jw-muted">
        <span>{label}</span>
        <span className="tabular-nums">{Math.round(value * 100)}</span>
      </span>
      <input type="range" className="w-full" min={0} max={100} step={1} value={Math.round(value * 100)} disabled={disabled} onChange={(e) => onChange(Number(e.target.value) / 100)} aria-label={label} />
    </label>
  );
}
