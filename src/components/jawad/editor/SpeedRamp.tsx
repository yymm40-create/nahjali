"use client";

// «منحنى السرعة» — the speed changing inside a clip: ready curves, and the curve itself to shape by hand (drag a point
// up for faster, down for slower; a tap on the line adds a point, a double tap on a point removes it). The preview and
// the export follow it, picture and sound together (the sound keeps its pitch).

import { useRef, useState } from "react";
import type { Clip } from "@/lib/editor/model";
import { RAMP_MAX_POINTS, RAMP_PRESET_IDS, RAMP_PRESETS, RAMP_SPEED, rampArea, rampKey, readRamp, type Ramp, type RampPresetId } from "@/lib/editor/ramp";
import type { Run } from "./Inspector";
import { track as trackUse } from "@/lib/feature-track";

const W = 300;
const H = 120;
const PAD = 10;
const LO = Math.log(RAMP_SPEED.uiMin);
const HI = Math.log(RAMP_SPEED.uiMax);
/** speed ↔ height: on a log scale, so ×0.5 and ×2 sit the same distance from ×1 */
const yOf = (s: number) => PAD + (1 - (Math.log(Math.min(RAMP_SPEED.uiMax, Math.max(RAMP_SPEED.uiMin, s))) - LO) / (HI - LO)) * (H - 2 * PAD);
const sOf = (y: number) => Math.exp(LO + (1 - (y - PAD) / (H - 2 * PAD)) * (HI - LO));
const xOf = (u: number) => PAD + u * (W - 2 * PAD);
const uOf = (x: number) => (x - PAD) / (W - 2 * PAD);
const snap = (s: number) => {
  // close to a round speed: it sticks there (×1 above all)
  for (const r of [0.25, 0.5, 1, 2, 3, 4]) if (Math.abs(Math.log(s / r)) < 0.06) return r;
  return Math.round(s * 100) / 100;
};

export default function SpeedRamp({ clip, locked, run }: { clip: Clip; locked: boolean; run: Run }) {
  const svg = useRef<SVGSVGElement>(null);
  // the curve being dragged (sent once, when the finger lifts: one undo step)
  const [draft, setDraft] = useState<Ramp | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const ramp = draft ?? clip.ramp ?? null;
  const shown: Ramp = ramp ?? [{ u: 0, s: clip.speed }, { u: 1, s: clip.speed }];
  const key = clip.ramp ? rampKey(clip.ramp) : "";

  // a drag just ended: the click that follows it is not a tap on the line
  const dragged = useRef(0);
  const send = (r: Ramp | RampPresetId | null, label?: string) => {
    trackUse("editor.speed_ramp");
    run({ type: "update_clip", clipId: clip.id, patch: { ramp: r } }, label ? { label } : undefined);
  };
  const at = (e: React.PointerEvent | React.MouseEvent) => {
    const b = svg.current!.getBoundingClientRect();
    return { x: ((e.clientX - b.left) / b.width) * W, y: ((e.clientY - b.top) / b.height) * H };
  };

  const down = (e: React.PointerEvent, i: number) => {
    if (locked) return;
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDraft(shown.map((p) => ({ ...p })));
    setDrag(i);
  };
  const move = (e: React.PointerEvent) => {
    if (drag == null || !draft) return;
    const p = at(e);
    const next = draft.map((q) => ({ ...q }));
    const lo = drag === 0 ? 0 : next[drag - 1].u + 0.02;
    const hi = drag === next.length - 1 ? 1 : next[drag + 1].u - 0.02;
    // the two ends stay at the clip's start and end; the others slide between their neighbours
    next[drag] = { u: drag === 0 ? 0 : drag === next.length - 1 ? 1 : Math.min(hi, Math.max(lo, uOf(p.x))), s: snap(sOf(p.y)) };
    setDraft(next);
  };
  const up = () => {
    if (drag == null) return;
    dragged.current = Date.now();
    setDrag(null);
    const r = draft ? readRamp(draft) : null;
    setDraft(null);
    if (r && rampKey(r) !== key) send(r, "عدّلت منحنى السرعة");
  };
  /** a tap on the line (not on a point): a new point there, on the curve */
  const add = (e: React.MouseEvent) => {
    if (locked || shown.length >= RAMP_MAX_POINTS) return;
    const u = Math.min(0.98, Math.max(0.02, uOf(at(e).x)));
    const i = shown.findIndex((p) => p.u > u);
    if (i <= 0) return;
    const a = shown[i - 1];
    const b = shown[i];
    const s = a.s + ((b.s - a.s) * (u - a.u)) / (b.u - a.u || 1);
    send([...shown.slice(0, i), { u: Math.round(u * 1000) / 1000, s: Math.round(s * 100) / 100 }, ...shown.slice(i)], "نقطة على منحنى السرعة");
  };
  const remove = (i: number) => {
    if (locked || i === 0 || i === shown.length - 1) return;
    send(shown.filter((_, k) => k !== i), "شلت نقطة من منحنى السرعة");
  };

  const line = shown.map((p) => `${xOf(p.u).toFixed(1)},${yOf(p.s).toFixed(1)}`).join(" ");
  const avg = rampArea(shown);

  return (
    <div className="space-y-2 rounded-xl border border-jw-line p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold">↝ منحنى السرعة</span>
        {clip.ramp && (
          <button type="button" disabled={locked} className="jw-chip !px-2 !py-0.5 !text-[11px]" onClick={() => send(null, "شلت منحنى السرعة")}>
            ✕ سرعة وحدة
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="منحنيات جاهزة">
        {RAMP_PRESET_IDS.map((id) => {
          const on = key === rampKey(RAMP_PRESETS[id].points);
          return (
            <button key={id} type="button" role="radio" aria-checked={on} disabled={locked} title={RAMP_PRESETS[id].hint} onClick={() => send(id)} className={`jw-chip !px-2.5 !py-1 !text-xs ${on ? "!border-jw-accent !text-jw-ink" : ""}`}>
              {RAMP_PRESETS[id].label}
            </button>
          );
        })}
      </div>
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        className={`block h-auto w-full touch-none select-none rounded-lg bg-jw-surface-2 ${locked ? "opacity-60" : "cursor-crosshair"}`}
        role="img"
        aria-label="منحنى السرعة: من بداية المقطع (يسار) لنهايته (يمين)، فوق أسرع وتحت أبطأ"
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onClick={(e) => {
          if (drag == null && Date.now() - dragged.current > 300) add(e);
        }}
      >
        {/* ×1 and the round speeds */}
        {[0.25, 0.5, 1, 2, 4].map((s) => (
          <g key={s}>
            <line x1={PAD} x2={W - PAD} y1={yOf(s)} y2={yOf(s)} stroke="currentColor" strokeOpacity={s === 1 ? 0.35 : 0.12} strokeDasharray={s === 1 ? undefined : "3 4"} className="text-jw-muted" />
            <text x={W - PAD + 1} y={yOf(s) + 3} fontSize="7" fill="currentColor" className="text-jw-faint">×{s}</text>
          </g>
        ))}
        <polyline points={`${xOf(0)},${H - PAD} ${line} ${xOf(1)},${H - PAD}`} fill="var(--jw-accent)" fillOpacity={0.12} stroke="none" />
        <polyline points={line} fill="none" stroke="var(--jw-accent)" strokeWidth={2} strokeLinejoin="round" />
        {shown.map((p, i) => (
          <circle
            key={i}
            cx={xOf(p.u)}
            cy={yOf(p.s)}
            r={drag === i ? 7 : 5.5}
            fill={drag === i ? "var(--jw-accent)" : "#fff"}
            stroke="var(--jw-accent)"
            strokeWidth={2}
            className={locked ? "" : "cursor-grab"}
            onPointerDown={(e) => down(e, i)}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => {
              e.stopPropagation();
              remove(i);
            }}
          >
            <title>×{p.s}</title>
          </circle>
        ))}
        {drag != null && draft && (
          <text x={Math.min(W - 40, Math.max(4, xOf(draft[drag].u) - 12))} y={Math.max(9, yOf(draft[drag].s) - 10)} fontSize="9" fontWeight="700" fill="currentColor">×{draft[drag].s}</text>
        )}
      </svg>
      <p className="text-[11px] leading-5 text-jw-faint">
        اسحب النقطة فوق = أسرع، تحت = أبطأ. اضغط على الخط تضيف نقطة، ودبل كلك على النقطة يشيلها. المعدّل <span dir="ltr">×{avg.toFixed(2)}</span>، والصوت يمشي معه بنفس طبقته.
      </p>
    </div>
  );
}
