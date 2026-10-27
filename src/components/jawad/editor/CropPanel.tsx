"use client";

// «حيدرة كت» · «✂️ القص» (Crop) as a main tab, like Premiere's Crop effect: four counters — فوق، يمين، يسار، تحت — each
// typed, stepped with − / + (Shift: ×10) or dragged sideways on its name, in percent of the picture; the picture
// keeps its size and place, so a half taken away is the other half left exactly where it was (a split screen: crop
// each clip to its half and place it). Opposite sides never meet: the one being changed wins and the other gives way.

import { useRef } from "react";
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
  const scrub = useRef<{ k: keyof Crop; x: number; v: number; id: number } | null>(null);
  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-5 text-jw-muted">يشيل من الصورة من أي جهة، والصورة تبقى بحجمها ومكانها (مثل بريمير). اكتب الرقم، أو اضغط − / + (مع Shift عشرة عشرة)، أو اسحب على اسم الجهة يمين ويسار.</p>
      <div className="space-y-2">
        {SIDES.map(({ k, label, icon }) => (
          <div key={k} className="flex items-center gap-2">
            <span
              className={`w-16 shrink-0 select-none text-xs font-semibold ${locked ? "" : "cursor-ew-resize"}`}
              title="اسحب يمين ويسار"
              onPointerDown={(e) => {
                if (locked) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                scrub.current = { k, x: e.clientX, v: c[k], id: e.pointerId };
              }}
              onPointerMove={(e) => {
                const s = scrub.current;
                if (!s || s.id !== e.pointerId) return;
                // 2 px = 1٪ (Shift: finer)
                put(s.k, s.v + ((e.clientX - s.x) / (e.shiftKey ? 8 : 2)) / 100);
              }}
              onPointerUp={() => (scrub.current = null)}
              onPointerCancel={() => (scrub.current = null)}
            >
              <span aria-hidden>{icon}</span> {label}
            </span>
            <button type="button" className="jw-btn jw-btn-quiet !min-h-8 !w-8 !px-0" disabled={locked || c[k] <= 0} aria-label={`قلّل ${label}`} onClick={(e) => put(k, c[k] - (e.shiftKey ? 0.1 : 0.01))}>
              −
            </button>
            <input
              className="jw-input !min-h-8 w-20 text-center tabular-nums"
              dir="ltr"
              inputMode="decimal"
              aria-label={`القص من ${label} بالنسبة المئوية`}
              disabled={locked}
              value={pct(c[k])}
              onChange={(e) => {
                const n = Number(e.target.value.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[^\d.]/g, ""));
                if (Number.isFinite(n)) put(k, n / 100);
              }}
              onKeyDown={(e) => {
                if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                e.preventDefault();
                put(k, c[k] + (e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 0.1 : 0.01));
              }}
            />
            <span className="text-xs text-jw-muted">٪</span>
            <button type="button" className="jw-btn jw-btn-quiet !min-h-8 !w-8 !px-0" disabled={locked || c[k] >= CROP_MAX} aria-label={`زِد ${label}`} onClick={(e) => put(k, c[k] + (e.shiftKey ? 0.1 : 0.01))}>
              +
            </button>
          </div>
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
