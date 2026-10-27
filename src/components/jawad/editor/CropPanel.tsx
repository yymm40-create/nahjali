"use client";

// «حيدرة كت» · «✂️ القص» (Crop) as a main tab, like Premiere's Crop effect: four sliders — فوق، يمين، يسار، تحت — in
// percent of the part of the picture seen in the frame (render.ts cropView); the picture keeps its size and place, so a
// half taken away is the other half left exactly where it was (a split screen: crop each clip to its half and place
// it). Opposite sides never meet: the one being changed wins and the other gives way.

import { CROP_MAX, NO_CROP, type Clip, type Crop } from "@/lib/editor/model";
import type { ClipPatch } from "@/lib/editor/commands";

const SIDES: { k: keyof Crop; label: string; icon: string }[] = [
  { k: "t", label: "فوق", icon: "⬆" },
  { k: "r", label: "يمين", icon: "➡" },
  { k: "l", label: "يسار", icon: "⬅" },
  { k: "b", label: "تحت", icon: "⬇" },
];
/** Ready crops for a split screen: which part of THIS picture stays. */
const HALVES: { label: string; crop: Partial<Crop> }[] = [
  { label: "يبقى النص اليمين", crop: { l: 0.5, r: 0, t: 0, b: 0 } },
  { label: "يبقى النص اليسار", crop: { r: 0.5, l: 0, t: 0, b: 0 } },
  { label: "يبقى النص الفوق", crop: { b: 0.5, t: 0, l: 0, r: 0 } },
  { label: "يبقى النص التحت", crop: { t: 0.5, b: 0, l: 0, r: 0 } },
  { label: "الوسط (يشيل الأطراف)", crop: { l: 0.2, r: 0.2, t: 0, b: 0 } },
];
const pct = (v: number) => Math.round(v * 1000) / 10;

export default function CropPanel({ clip, locked, set }: { clip: Clip; locked: boolean; set: (patch: ClipPatch, key: string) => void }) {
  const c = clip.crop ?? NO_CROP;
  const put = (k: keyof Crop, v: number) => set({ crop: { [k]: Math.min(CROP_MAX, Math.max(0, v)) } }, `crop:${k}`);
  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-5 text-jw-muted">اسحب شريط أي جهة ويشيل منها اللي تشوفه في الإطار، والصورة تبقى بحجمها ومكانها (مثل بريمير).</p>
      <div className="space-y-3">
        {SIDES.map(({ k, label, icon }) => (
          <label key={k} className="block space-y-1">
            <span className="flex items-center justify-between text-xs">
              <span className="font-semibold">
                <span aria-hidden>{icon}</span> {label}
              </span>
              <span className="tabular-nums text-jw-ink" dir="ltr">
                {pct(c[k])}٪
              </span>
            </span>
            <input
              type="range"
              dir={k === "r" ? "rtl" : "ltr"}
              className="w-full accent-[var(--jw-accent)]"
              min={0}
              max={CROP_MAX * 100}
              step={0.5}
              value={pct(c[k])}
              disabled={locked}
              aria-label={`القص من ${label}`}
              onChange={(e) => put(k, Number(e.target.value) / 100)}
            />
          </label>
        ))}
      </div>
      <div className="space-y-1.5 border-t border-jw-line pt-3">
        <p className="text-xs font-semibold">تقسيم الشاشة</p>
        <div className="flex flex-wrap gap-1.5">
          {HALVES.map((h) => (
            <button key={h.label} type="button" disabled={locked} className="jw-chip !px-2.5 !py-1 !text-xs" onClick={() => set({ crop: h.crop }, "crop:preset")}>
              {h.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] leading-5 text-jw-faint">للشاشة المقسومة: حط المقطعين فوق بعض في التايملاين، اقطع كل واحد لنصّه، وحرّكه من «حركة» لمكانه.</p>
      </div>
      {clip.crop && (
        <button type="button" className="jw-btn jw-btn-quiet w-full text-xs" disabled={locked} onClick={() => set({ crop: null }, "crop:reset")}>
          رجّع الصورة كاملة
        </button>
      )}
    </div>
  );
}
