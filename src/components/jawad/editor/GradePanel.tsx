"use client";

// «التلوين» — the inspector's colour page: the camera's log, the primaries, the wheels, curves, secondaries keyed by
// colour, windows (masks), ready looks and .cube LUTs, and film (split toning, halation, grain, vignette). Every
// change is one command on the clip's grade (grade.ts); the GPU draws it (grade-gl.ts).

import { useEffect, useRef, useState } from "react";
import type { Clip } from "@/lib/editor/model";
import { clipLength } from "@/lib/editor/model";
import { applyLook, FLAT, LINE, LOGS, LOOKS, MAX_SECONDARIES, NEUTRAL_GRADE, NEW_MASK, NEW_SECONDARY, parseCube, toCube, type Curves, type Grade, type LogId, type Mask, type Pt, type Secondary, type Wheel } from "@/lib/editor/grade";
import Icon from "../Icon";
import { bakeLut, gradeReady } from "./grade-gl";
import type { Run } from "./Inspector";
import type { PlayerLike } from "./Timeline";
import { saveFile } from "./package";

type Page = "log" | "basic" | "wheels" | "curves" | "secondary" | "mask" | "looks" | "film";
const PAGES: [Page, string][] = [
  ["looks", "لوكات"],
  ["log", "لوج"],
  ["basic", "أساسي"],
  ["wheels", "عجلات"],
  ["curves", "منحنيات"],
  ["secondary", "ثانوي"],
  ["mask", "ماسك"],
  ["film", "فيلم"],
];

function Slider({ label, value, min, max, step, onChange, format, disabled, center, bg }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string; disabled?: boolean; center?: boolean; bg?: string }) {
  return (
    <label className="block space-y-0.5">
      <span className="flex items-center justify-between text-[11px] text-jw-muted">
        <span>{label}</span>
        <span className="tabular-nums text-jw-ink" dir="ltr">{format ? format(value) : value}</span>
      </span>
      <input type="range" dir="ltr" className={`w-full accent-[var(--jw-accent)] ${bg ? "h-2 appearance-none rounded-full" : ""}`} style={bg ? { background: bg } : undefined} min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} onDoubleClick={() => center && onChange(0)} />
    </label>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}`;
const signed = (v: number) => (v > 0 ? `+${v}` : `${v}`);
const HUE_BG = "linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)";

// ───────── a colour wheel ─────────

function ColorWheel({ label, value, onChange, disabled }: { label: string; value: Wheel; onChange: (w: Wheel) => void; disabled: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const S = 84;
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext("2d")!;
    const r = S / 2;
    const im = g.createImageData(S, S);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const dx = x - r + 0.5,
          dy = y - r + 0.5;
        const d = Math.hypot(dx, dy) / r;
        const o = (y * S + x) * 4;
        if (d > 1) continue;
        const h = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
        const s = Math.min(1, d);
        const k = (n: number) => {
          const kk = (n + h / 30) % 12;
          return 1 - s * Math.max(-1, Math.min(kk - 3, 9 - kk, 1));
        };
        im.data[o] = k(0) * 255;
        im.data[o + 1] = k(8) * 255;
        im.data[o + 2] = k(4) * 255;
        im.data[o + 3] = 255 * (1 - Math.max(0, (d - 0.96) / 0.04));
      }
    g.putImageData(im, 0, 0);
  }, []);
  // the wheel's rgb offset ↔ a point: the hue is the angle, the strength the distance
  const [r, gg, b] = value.rgb;
  const px = ((r - (gg + b) / 2) * 0.8 * S) / 2;
  const py = (((b - gg) * 0.866) * 0.8 * S) / 2;
  const drag = (e: React.PointerEvent) => {
    if (disabled) return;
    const el = e.currentTarget as HTMLDivElement;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const rc = el.getBoundingClientRect();
      let dx = (ev.clientX - rc.left - S / 2) / (S / 2);
      let dy = (ev.clientY - rc.top - S / 2) / (S / 2);
      const d = Math.hypot(dx, dy);
      if (d > 1) {
        dx /= d;
        dy /= d;
      }
      // back from the point to rgb offsets (a hue's direction, length = strength)
      const a = Math.atan2(dy, dx);
      const k = Math.min(1, d) / 0.8;
      const rgb: [number, number, number] = [Math.cos(a), Math.cos(a - (2 * Math.PI) / 3), Math.cos(a + (2 * Math.PI) / 3)].map((v) => +(v * k * 0.5).toFixed(3)) as [number, number, number];
      onChange({ ...value, rgb });
    };
    move(e.nativeEvent);
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[11px] font-semibold">{label}</span>
      <div className="relative" style={{ width: S, height: S }} onPointerDown={drag} onDoubleClick={() => !disabled && onChange({ rgb: [0, 0, 0], y: value.y })} title="اسحب نحو اللون؛ ضغطتين ترجعه">
        <canvas ref={ref} width={S} height={S} className="rounded-full shadow-inner" />
        <span className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-black/60 shadow" style={{ left: S / 2 + px, top: S / 2 + py }} />
      </div>
      <input type="range" dir="ltr" className="w-full accent-[var(--jw-accent)]" min={-1} max={1} step={0.005} value={value.y} disabled={disabled} onChange={(e) => onChange({ ...value, y: Number(e.target.value) })} onDoubleClick={() => onChange({ ...value, y: 0 })} aria-label={`${label}: الإضاءة`} />
    </div>
  );
}

// ───────── a curve editor ─────────

function CurveEditor({ pts, onChange, flat, disabled, bg }: { pts: Pt[]; onChange: (p: Pt[]) => void; flat: boolean; disabled: boolean; bg?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const [sel, setSel] = useState<number | null>(null);
  const at = (e: { clientX: number; clientY: number }) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height)) };
  };
  // the curve drawn as many short lines (its real shape, from grade.ts)
  const path = (() => {
    const n = 64;
    const d: string[] = [];
    for (let i = 0; i <= n; i++) {
      const x = i / n;
      // sampled through the same maths the GPU uses
      const y = flat ? hueY(pts, x) : lineY(pts, x);
      d.push(`${i ? "L" : "M"}${(x * 100).toFixed(2)},${((1 - y) * 100).toFixed(2)}`);
    }
    return d.join(" ");
  })();
  const down = (e: React.PointerEvent) => {
    if (disabled) return;
    const p = at(e);
    let i = pts.findIndex((q) => Math.hypot(q.x - p.x, q.y - p.y) < 0.06);
    let next = pts;
    if (i < 0) {
      next = [...pts, p].sort((a, b) => a.x - b.x);
      i = next.indexOf(p);
      onChange(next);
    }
    setSel(i);
    const el = ref.current!;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const q = at(ev);
      const lo = i > 0 ? next[i - 1].x + 0.01 : 0;
      const hi = i < next.length - 1 ? next[i + 1].x - 0.01 : 1;
      next = next.map((pt, k) => (k === i ? { x: i === 0 || i === next.length - 1 ? (flat ? q.x : pt.x) : Math.min(hi, Math.max(lo, q.x)), y: q.y } : pt));
      onChange(next);
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };
  const remove = (i: number) => {
    if (disabled || pts.length <= 2) return;
    onChange(pts.filter((_, k) => k !== i));
    setSel(null);
  };
  return (
    <svg ref={ref} viewBox="0 0 100 100" className="aspect-square w-full touch-none rounded-lg border border-jw-line bg-jw-bg-2" style={bg ? { background: bg } : undefined} onPointerDown={down} role="img" aria-label="منحنى">
      <g stroke="currentColor" strokeOpacity="0.12" strokeWidth="0.5">
        {[25, 50, 75].map((v) => (
          <g key={v}>
            <line x1={v} y1="0" x2={v} y2="100" />
            <line x1="0" y1={v} x2="100" y2={v} />
          </g>
        ))}
      </g>
      <line x1="0" y1={flat ? 50 : 100} x2="100" y2={flat ? 50 : 0} stroke="currentColor" strokeOpacity="0.25" strokeWidth="0.6" strokeDasharray="2 2" />
      <path d={path} fill="none" stroke="var(--jw-accent)" strokeWidth="1.6" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x * 100} cy={(1 - p.y) * 100} r={sel === i ? 3.2 : 2.4} fill={sel === i ? "var(--jw-accent)" : "#fff"} stroke="var(--jw-accent)" strokeWidth="1" onDoubleClick={() => remove(i)} />
      ))}
    </svg>
  );
}
// (the same curves as grade.ts, kept small here for drawing)
import { curveAt, hueCurveAt } from "@/lib/editor/grade";
const lineY = (p: Pt[], x: number) => Math.min(1, Math.max(0, curveAt(p, x)));
const hueY = (p: Pt[], x: number) => Math.min(1, Math.max(0, hueCurveAt(p, x)));

// ───────── a mask (window) editor ─────────

function MaskEditor({ mask, onChange, thumb, disabled, clipT, inClip }: { mask: Mask | null; onChange: (m: Mask | null) => void; thumb: string | null; disabled: boolean; clipT: number; inClip: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const m = mask;
  const set = (p: Partial<Mask>) => m && onChange({ ...m, ...p });
  const dragCenter = (e: React.PointerEvent) => {
    if (!m || disabled) return;
    const el = ref.current!;
    const r = el.getBoundingClientRect();
    if (m.kind === "path") {
      // a click adds a corner
      const p = { x: +((e.clientX - r.left) / r.width).toFixed(3), y: +((e.clientY - r.top) / r.height).toFixed(3) };
      set({ points: [...m.points, p] });
      return;
    }
    el.setPointerCapture(e.pointerId);
    const start = { x: e.clientX, y: e.clientY, mx: m.x, my: m.y };
    const move = (ev: PointerEvent) => {
      const x = +(start.mx + (ev.clientX - start.x) / r.width).toFixed(3);
      const y = +(start.my + (ev.clientY - start.y) / r.height).toFixed(3);
      // with motion points, the drag moves the point at the playhead
      const k = m.keys.findIndex((kk) => Math.abs(kk.t - clipT) < 40);
      if (m.keys.length && k >= 0) set({ keys: m.keys.map((kk, i) => (i === k ? { ...kk, x, y } : kk)) });
      else set({ x, y });
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };
  const keyHere = m?.keys.some((k) => Math.abs(k.t - clipT) < 40) ?? false;
  const pos = m ? (m.keys.length ? posAt(m, clipT) : { x: m.x, y: m.y }) : { x: 0.5, y: 0.5 };
  return (
    <div className="space-y-2">
      <div className="jw-seg" role="radiogroup" aria-label="شكل الماسك">
        {(
          [
            [null, "بدون"],
            ["ellipse", "دائرة"],
            ["rect", "مستطيل"],
            ["linear", "تدرّج"],
            ["path", "رسم"],
          ] as [Mask["kind"] | null, string][]
        ).map(([k, label]) => (
          <button key={label} type="button" role="radio" aria-checked={(m?.kind ?? null) === k} disabled={disabled} onClick={() => onChange(k ? { ...(m ?? NEW_MASK), kind: k, points: k === "path" ? (m?.points ?? []) : [], ...(k === "linear" ? { w: 0.4, h: 0 } : {}) } : null)}>
            {label}
          </button>
        ))}
      </div>
      {m && (
        <>
          <div ref={ref} className="relative aspect-video w-full touch-none overflow-hidden rounded-lg border border-jw-line bg-black" onPointerDown={dragCenter} title={m.kind === "path" ? "اضغط لإضافة زاوية" : "اسحب لتحريك الماسك"}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a blob: thumbnail */}
            {thumb && <img src={thumb} alt="" className="absolute inset-0 h-full w-full object-contain opacity-80" draggable={false} />}
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
              <defs>
                <mask id="mk">
                  <rect width="100" height="100" fill={m.invert ? "white" : "black"} />
                  <g fill={m.invert ? "black" : "white"} transform={`translate(${pos.x * 100} ${pos.y * 100}) rotate(${m.rotate})`}>
                    {m.kind === "ellipse" && <ellipse rx={m.w * 50} ry={m.h * 50} />}
                    {m.kind === "rect" && <rect x={-m.w * 50} y={-m.h * 50} width={m.w * 100} height={m.h * 100} rx={m.round * Math.min(m.w, m.h) * 50} />}
                    {m.kind === "linear" && <rect x="0" y="-200" width="400" height="400" />}
                  </g>
                  {m.kind === "path" && m.points.length >= 3 && <polygon fill={m.invert ? "black" : "white"} points={m.points.map((p) => `${(p.x + pos.x - m.x) * 100},${(p.y + pos.y - m.y) * 100}`).join(" ")} />}
                </mask>
              </defs>
              <rect width="100" height="100" fill="var(--jw-accent)" fillOpacity="0.35" mask="url(#mk)" />
              {m.kind === "path" && m.points.map((p, i) => <circle key={i} cx={(p.x + pos.x - m.x) * 100} cy={(p.y + pos.y - m.y) * 100} r="1.6" fill="#fff" stroke="var(--jw-accent)" strokeWidth="0.6" />)}
              {m.kind !== "path" && <circle cx={pos.x * 100} cy={pos.y * 100} r="1.8" fill="#fff" stroke="var(--jw-accent)" strokeWidth="0.6" />}
            </svg>
          </div>
          {m.kind !== "path" && m.kind !== "linear" && (
            <>
              <Slider label="العرض" value={+(m.w * 100).toFixed(0)} min={2} max={200} step={1} disabled={disabled} onChange={(v) => set({ w: v / 100 })} />
              <Slider label="الارتفاع" value={+(m.h * 100).toFixed(0)} min={2} max={200} step={1} disabled={disabled} onChange={(v) => set({ h: v / 100 })} />
            </>
          )}
          {m.kind === "linear" && <Slider label="طول التدرّج" value={+(m.w * 100).toFixed(0)} min={2} max={150} step={1} disabled={disabled} onChange={(v) => set({ w: v / 100 })} />}
          {m.kind === "rect" && <Slider label="استدارة الزوايا" value={+(m.round * 100).toFixed(0)} min={0} max={100} step={1} disabled={disabled} onChange={(v) => set({ round: v / 100 })} />}
          <Slider label="الدوران" value={Math.round(m.rotate)} min={-180} max={180} step={1} disabled={disabled} onChange={(v) => set({ rotate: v })} format={(v) => `${v}°`} center />
          <Slider label="نعومة الحافة" value={+(m.feather * 100).toFixed(0)} min={0} max={100} step={1} disabled={disabled} onChange={(v) => set({ feather: v / 100 })} />
          <div className="flex flex-wrap gap-1.5">
            <label className="flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={m.invert} disabled={disabled} onChange={(e) => set({ invert: e.target.checked })} /> اعكس (برا الماسك)
            </label>
            {m.kind === "path" && m.points.length > 0 && (
              <button type="button" className="jw-btn jw-btn-quiet !min-h-7 !px-2 text-[11px]" disabled={disabled} onClick={() => set({ points: m.points.slice(0, -1) })}>
                شيل آخر زاوية
              </button>
            )}
          </div>
          <div className="space-y-1 rounded-lg border border-jw-line p-2">
            <p className="text-[11px] text-jw-muted">◆ الماسك يتحرك مع الوقت: حط المؤشر على لحظة، اضغط «نقطة هنا» وحرّك الماسك؛ وعلى لحظة ثانية مرة ثانية.</p>
            <div className="flex gap-1.5">
              <button type="button" className="jw-btn !min-h-7 flex-1 text-[11px]" disabled={disabled || !inClip} onClick={() => set({ keys: keyHere ? m.keys.filter((k) => Math.abs(k.t - clipT) >= 40) : [...m.keys, { t: Math.round(clipT), x: pos.x, y: pos.y }].sort((a, b) => a.t - b.t) })}>
                {keyHere ? "◇ شيل النقطة هنا" : "◆ نقطة هنا"}
              </button>
              {m.keys.length > 0 && (
                <button type="button" className="jw-btn jw-btn-quiet !min-h-7 text-[11px]" disabled={disabled} onClick={() => set({ keys: [] })}>
                  شيل الحركة ({m.keys.length})
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
import { maskAt as posAt } from "@/lib/editor/grade";

// ───────── the panel ─────────

export default function GradePanel({ clip, thumb, locked, run, flash, player }: { clip: Clip; thumb: string | null; locked: boolean; run: Run; flash: (m: string, bad?: boolean) => void; player: PlayerLike | null }) {
  const g: Grade = clip.grade ?? NEUTRAL_GRADE;
  const [page, setPage] = useState<Page>(clip.grade ? "basic" : "looks");
  const [curve, setCurve] = useState<keyof Curves>("master");
  const [sec, setSec] = useState(0);
  const [ms, setMs] = useState(0);
  useEffect(() => {
    if (!player) return;
    const t = setTimeout(() => setMs(player.ms), 0);
    const off = player.subscribe((m) => setMs(m));
    return () => {
      clearTimeout(t);
      off();
    };
  }, [player]);
  const clipT = ms - clip.start;
  const inClip = clipT >= 0 && clipT <= clipLength(clip);
  const set = (patch: Partial<Grade>, key: string) => run({ type: "update_clip", clipId: clip.id, patch: { grade: patch } }, { coalesce: `${clip.id}:grade:${key}` });
  const reset = () => run({ type: "update_clip", clipId: clip.id, patch: { grade: null } });
  const gpu = gradeReady();
  const S = g.secondaries[sec] as Secondary | undefined;
  const setSec2 = (p: Partial<Secondary>, key: string) => set({ secondaries: g.secondaries.map((s, i) => (i === sec ? { ...s, ...p } : s)) }, `sec${sec}:${key}`);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadCube = async (f: File | undefined) => {
    if (!f) return;
    try {
      const lut = parseCube(await f.text(), f.name.replace(/\.cube$/i, "").slice(0, 60));
      set({ lut, lutAmount: 1 }, "lut");
      flash(`انحطت LUT «${lut.name}» (${lut.size}³).`);
    } catch (e) {
      flash(e instanceof Error ? e.message : "ما قدرنا نقرأ الملف.", true);
    }
  };
  const exportCube = () => {
    const bytes = bakeLut(g, 33);
    if (!bytes) return flash("ما قدرنا نصدّر LUT من هذا المتصفح.", true);
    saveFile(new Blob([toCube(`Haidara Cut - ${LOOKS.find((l) => l.id === g.look)?.label ?? "grade"}`, 33, bytes)], { type: "text/plain" }), `haidara-grade-${Date.now().toString(36)}.cube`);
    flash("نزل ملف .cube: يشتغل في بريمير ودافنشي وكاب كت.");
  };

  return (
    <div className="space-y-3">
      {!gpu && <p className="rounded-lg bg-jw-warn/10 p-2 text-[11px] text-jw-warn">متصفحك ما يقدر يلوّن على كرت الشاشة (WebGL2)؛ التلوين ما بيبين هنا. جرّب Chrome.</p>}
      <div className="jw-scroll -mx-1 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist" aria-label="صفحات التلوين">
        {PAGES.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={page === k} className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${page === k ? "bg-jw-accent text-jw-on-accent" : "bg-jw-surface-2 text-jw-muted hover:text-jw-ink"}`} onClick={() => setPage(k)}>
            {label}
          </button>
        ))}
      </div>

      {page === "looks" && (
        <div className="space-y-3">
          {(["سينما", "فيلم", "مزاج", "أبيض وأسود"] as const).map((grp) => (
            <div key={grp} className="space-y-1">
              <p className="text-[11px] font-semibold text-jw-muted">{grp}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {LOOKS.filter((l) => l.group === grp).map((l) => (
                  <button key={l.id} type="button" disabled={locked} aria-pressed={g.look === l.id} title={l.hint} className={`rounded-lg border px-2 py-1.5 text-start text-[11px] leading-tight ${g.look === l.id ? "border-jw-accent bg-jw-accent/10" : "border-jw-line hover:border-jw-line-strong"}`} onClick={() => run({ type: "update_clip", clipId: clip.id, patch: { grade: applyLook(g, l) } })}>
                    <b className="block">{l.label}</b>
                    <span className="text-jw-faint">{l.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="space-y-1.5 rounded-lg border border-jw-line p-2">
            <p className="text-[11px] font-semibold">LUT من ملف (.cube)</p>
            <input ref={fileRef} type="file" accept=".cube,.CUBE" className="hidden" onChange={(e) => void loadCube(e.target.files?.[0]).then(() => (e.target.value = ""))} />
            <div className="flex gap-1.5">
              <button type="button" className="jw-btn !min-h-8 flex-1 text-xs" disabled={locked} onClick={() => fileRef.current?.click()}>
                <Icon name="upload" size={14} /> {g.lut ? `LUT: ${g.lut.name}` : "ارفع LUT"}
              </button>
              {g.lut && (
                <button type="button" className="jw-btn jw-btn-quiet !min-h-8 text-xs" disabled={locked} onClick={() => set({ lut: null }, "lut")}>
                  شيلها
                </button>
              )}
            </div>
            {g.lut && <Slider label="قوة الـLUT" value={+(g.lutAmount * 100).toFixed(0)} min={0} max={100} step={1} disabled={locked} onChange={(v) => set({ lutAmount: v / 100 }, "lutAmount")} />}
            <button type="button" className="jw-btn jw-btn-quiet !min-h-8 w-full text-xs" disabled={!clip.grade} onClick={exportCube} title="التلوين كله (بدون الماسكات والحبيبات) كملف .cube لبريمير ودافنشي وكاب كت">
              <Icon name="download" size={14} /> صدّر تلويني كـ LUT
            </button>
          </div>
        </div>
      )}

      {page === "log" && (
        <div className="space-y-2">
          <p className="text-[11px] leading-5 text-jw-muted">صوّرت بلوج (صورة باهتة رمادية)؟ اختر كاميرتك وبضغطة وحدة يتفك اللوج: يرجع التباين والألوان الصحيحة (Rec.709) مع تون ماب سينمائي، وبعدها لوّن براحتك.</p>
          <div className="space-y-1">
            {LOGS.map((l) => (
              <button key={l.id} type="button" disabled={locked} aria-pressed={g.log === l.id} className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-start text-[11px] ${g.log === l.id ? "border-jw-accent bg-jw-accent/10" : "border-jw-line hover:border-jw-line-strong"}`} onClick={() => set({ log: l.id as LogId }, "log")}>
                <span className="min-w-0 flex-1">
                  <b className="block">
                    {l.brand && <span className="text-jw-muted" dir="ltr">{l.brand} · </span>}
                    {l.label}
                  </b>
                  <span className="text-jw-faint">{l.hint}</span>
                </span>
                {g.log === l.id && <Icon name="check" size={14} />}
              </button>
            ))}
          </div>
        </div>
      )}

      {page === "basic" && (
        <div className="space-y-2">
          <Slider label="التعريض (ستوب)" value={+g.exposure.toFixed(2)} min={-3} max={3} step={0.05} disabled={locked} onChange={(v) => set({ exposure: v }, "exposure")} format={(v) => signed(+v.toFixed(2))} center />
          <Slider label="التباين" value={+(g.contrast * 100).toFixed(0)} min={40} max={220} step={1} disabled={locked} onChange={(v) => set({ contrast: v / 100 }, "contrast")} format={pct0} />
          <Slider label="محور التباين" value={+(g.pivot * 100).toFixed(0)} min={10} max={90} step={1} disabled={locked} onChange={(v) => set({ pivot: v / 100 }, "pivot")} />
          <Slider label="الحرارة (بارد ← دافئ)" value={+(g.temp * 100).toFixed(0)} min={-100} max={100} step={1} disabled={locked} onChange={(v) => set({ temp: v / 100 }, "temp")} format={signed} center bg="linear-gradient(90deg,#3b82f6,#e5e7eb,#f59e0b)" />
          <Slider label="الصبغة (أخضر ← بنفسجي)" value={+(g.tint * 100).toFixed(0)} min={-100} max={100} step={1} disabled={locked} onChange={(v) => set({ tint: v / 100 }, "tint")} format={signed} center bg="linear-gradient(90deg,#22c55e,#e5e7eb,#d946ef)" />
          <Slider label="الإضاءات العالية" value={+(g.highlights * 100).toFixed(0)} min={-100} max={100} step={1} disabled={locked} onChange={(v) => set({ highlights: v / 100 }, "highlights")} format={signed} center />
          <Slider label="الظلال" value={+(g.shadows * 100).toFixed(0)} min={-100} max={100} step={1} disabled={locked} onChange={(v) => set({ shadows: v / 100 }, "shadows")} format={signed} center />
          <Slider label="البياض" value={+(g.whites * 100).toFixed(0)} min={-100} max={100} step={1} disabled={locked} onChange={(v) => set({ whites: v / 100 }, "whites")} format={signed} center />
          <Slider label="السواد" value={+(g.blacks * 100).toFixed(0)} min={-100} max={100} step={1} disabled={locked} onChange={(v) => set({ blacks: v / 100 }, "blacks")} format={signed} center />
          <Slider label="التشبع" value={+(g.saturation * 100).toFixed(0)} min={0} max={250} step={1} disabled={locked} onChange={(v) => set({ saturation: v / 100 }, "saturation")} format={pct0} />
          <Slider label="الحيوية (يرفع الألوان الضعيفة ويحمي البشرة)" value={+(g.vibrance * 100).toFixed(0)} min={-100} max={100} step={1} disabled={locked} onChange={(v) => set({ vibrance: v / 100 }, "vibrance")} format={signed} center />
          <Slider label="الحدة" value={+(g.sharpen * 100).toFixed(0)} min={0} max={100} step={1} disabled={locked} onChange={(v) => set({ sharpen: v / 100 }, "sharpen")} />
          <Slider label="قوة التلوين كله" value={+(g.amount * 100).toFixed(0)} min={0} max={100} step={1} disabled={locked} onChange={(v) => set({ amount: v / 100 }, "amount")} />
        </div>
      )}

      {page === "wheels" && (
        <div className="space-y-2">
          <p className="text-[11px] text-jw-muted">مثل دافنشي: اسحب داخل العجلة نحو اللون اللي تبيه في الظلال (Lift)، الوسط (Gamma)، الأضواء (Gain)، أو الكل (Offset). الشريط تحت كل عجلة يرفع أو ينزّل إضاءتها.</p>
          <div className="grid grid-cols-2 gap-3">
            <ColorWheel label="الظلال · Lift" value={g.lift} disabled={locked} onChange={(w) => set({ lift: w }, "lift")} />
            <ColorWheel label="الوسط · Gamma" value={g.gamma} disabled={locked} onChange={(w) => set({ gamma: w }, "gamma")} />
            <ColorWheel label="الأضواء · Gain" value={g.gain} disabled={locked} onChange={(w) => set({ gain: w }, "gain")} />
            <ColorWheel label="الكل · Offset" value={g.offset} disabled={locked} onChange={(w) => set({ offset: w }, "offset")} />
          </div>
          <button type="button" className="jw-btn jw-btn-quiet !min-h-8 w-full text-xs" disabled={locked} onClick={() => set({ lift: NEUTRAL_GRADE.lift, gamma: NEUTRAL_GRADE.gamma, gain: NEUTRAL_GRADE.gain, offset: NEUTRAL_GRADE.offset }, "wheels-reset")}>
            رجّع العجلات
          </button>
        </div>
      )}

      {page === "curves" && (
        <div className="space-y-2">
          <div className="jw-scroll -mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
            {(
              [
                ["master", "الكل"],
                ["r", "أحمر"],
                ["g", "أخضر"],
                ["b", "أزرق"],
                ["hueHue", "لون ← لون"],
                ["hueSat", "لون ← تشبع"],
                ["hueLum", "لون ← إضاءة"],
                ["lumSat", "إضاءة ← تشبع"],
                ["satSat", "تشبع ← تشبع"],
              ] as [keyof Curves, string][]
            ).map(([k, label]) => (
              <button key={k} type="button" className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${curve === k ? "bg-jw-accent text-jw-on-accent" : "bg-jw-surface-2 text-jw-muted"}`} onClick={() => setCurve(k)}>
                {label}
              </button>
            ))}
          </div>
          <CurveEditor pts={g.curves[curve]} flat={curve.startsWith("hue") || curve === "lumSat" || curve === "satSat"} disabled={locked} bg={curve.startsWith("hue") ? `${HUE_BG}` : curve === "r" ? "linear-gradient(135deg,#1a0000,#ff4040)" : curve === "g" ? "linear-gradient(135deg,#001a00,#40ff40)" : curve === "b" ? "linear-gradient(135deg,#00001a,#4040ff)" : undefined} onChange={(pts) => set({ curves: { ...g.curves, [curve]: pts } }, `curve:${curve}`)} />
          <p className="text-[11px] text-jw-muted">اضغط في المنحنى تضيف نقطة، اسحبها، وضغطتين تشيلها. {curve.startsWith("hue") ? "المحور الأفقي هو اللون (أحمر، أصفر، أخضر، سماوي، أزرق، بنفسجي)." : curve === "lumSat" ? "الأفقي: الإضاءة من أسود لأبيض. العمودي: كم يزيد التشبع أو يقل." : curve === "satSat" ? "الأفقي: التشبع الحالي. العمودي: كم يصير." : "الأفقي: الدخل من أسود لأبيض. العمودي: الخرج."}</p>
          <button type="button" className="jw-btn jw-btn-quiet !min-h-8 w-full text-xs" disabled={locked} onClick={() => set({ curves: { ...g.curves, [curve]: curve === "master" || curve.length === 1 ? LINE : FLAT } }, `curve:${curve}:reset`)}>
            رجّع هذا المنحنى
          </button>
        </div>
      )}

      {page === "secondary" && (
        <div className="space-y-2">
          <p className="text-[11px] leading-5 text-jw-muted">الثانوي يختار لون معيّن من الصورة (البشرة، السماء، ثوب) ويغيّره بروحه بدون ما يمس الباقي. لين ٤ ثانويات، ولكل واحد ماسك خاص.</p>
          <div className="flex flex-wrap gap-1">
            {g.secondaries.map((s, i) => (
              <button key={i} type="button" className={`rounded-full px-2.5 py-1 text-[11px] ${sec === i ? "bg-jw-accent text-jw-on-accent" : "bg-jw-surface-2 text-jw-muted"} ${!s.on ? "line-through" : ""}`} onClick={() => setSec(i)}>
                {s.name || `ثانوي ${i + 1}`}
              </button>
            ))}
            {g.secondaries.length < MAX_SECONDARIES && (
              <button type="button" className="rounded-full border border-dashed border-jw-line px-2.5 py-1 text-[11px]" disabled={locked} onClick={() => { set({ secondaries: [...g.secondaries, { ...NEW_SECONDARY, name: "" }] }, "sec:add"); setSec(g.secondaries.length); }}>
                + ثانوي
              </button>
            )}
          </div>
          {S && (
            <div className="space-y-2">
              <div className="flex gap-1.5">
                <input className="jw-input min-w-0 flex-1 !py-1 text-xs" value={S.name} placeholder={`ثانوي ${sec + 1}`} maxLength={40} disabled={locked} onChange={(e) => setSec2({ name: e.target.value }, "name")} />
                <label className="flex items-center gap-1 text-[11px]">
                  <input type="checkbox" checked={S.on} disabled={locked} onChange={(e) => setSec2({ on: e.target.checked }, "on")} /> شغّال
                </label>
                <button type="button" className="jw-btn jw-btn-quiet jw-btn-icon !min-h-8 !w-8" disabled={locked} aria-label="احذف الثانوي" onClick={() => { set({ secondaries: g.secondaries.filter((_, i) => i !== sec) }, "sec:remove"); setSec(0); }}>
                  <Icon name="trash" size={14} />
                </button>
              </div>
              <div className="space-y-1.5 rounded-lg border border-jw-line p-2">
                <p className="flex items-center justify-between text-[11px] font-semibold">
                  <span>١) اختر اللون (Qualifier)</span>
                  <label className="flex items-center gap-1 font-normal">
                    <input type="checkbox" checked={S.show} disabled={locked} onChange={(e) => setSec2({ show: e.target.checked }, "show")} /> اعرض الاختيار (أبيض = مختار)
                  </label>
                </p>
                <Slider label="اللون" value={+(S.key.hue * 360).toFixed(0)} min={0} max={360} step={1} disabled={locked} onChange={(v) => setSec2({ key: { ...S.key, hue: v / 360 } }, "hue")} format={(v) => `${v}°`} bg={HUE_BG} />
                <Slider label="عرض اللون" value={+(S.key.hueWidth * 360).toFixed(0)} min={2} max={180} step={1} disabled={locked} onChange={(v) => setSec2({ key: { ...S.key, hueWidth: v / 360 } }, "hueWidth")} format={(v) => `±${v}°`} />
                <Slider label="نعومة اللون" value={+(S.key.hueSoft * 360).toFixed(0)} min={0} max={120} step={1} disabled={locked} onChange={(v) => setSec2({ key: { ...S.key, hueSoft: v / 360 } }, "hueSoft")} format={(v) => `${v}°`} />
                <Slider label="التشبع من" value={+(S.key.satLo * 100).toFixed(0)} min={0} max={100} step={1} disabled={locked} onChange={(v) => setSec2({ key: { ...S.key, satLo: v / 100 } }, "satLo")} />
                <Slider label="التشبع إلى" value={+(S.key.satHi * 100).toFixed(0)} min={0} max={100} step={1} disabled={locked} onChange={(v) => setSec2({ key: { ...S.key, satHi: v / 100 } }, "satHi")} />
                <Slider label="الإضاءة من" value={+(S.key.lumLo * 100).toFixed(0)} min={0} max={100} step={1} disabled={locked} onChange={(v) => setSec2({ key: { ...S.key, lumLo: v / 100 } }, "lumLo")} />
                <Slider label="الإضاءة إلى" value={+(S.key.lumHi * 100).toFixed(0)} min={0} max={100} step={1} disabled={locked} onChange={(v) => setSec2({ key: { ...S.key, lumHi: v / 100 } }, "lumHi")} />
                <Slider label="نعومة الحواف" value={+(S.key.soft * 100).toFixed(0)} min={0} max={50} step={1} disabled={locked} onChange={(v) => setSec2({ key: { ...S.key, soft: v / 100 } }, "soft")} />
                <Slider label="وسّع / ضيّق الاختيار" value={+(S.key.grow * 100).toFixed(0)} min={-100} max={100} step={1} disabled={locked} onChange={(v) => setSec2({ key: { ...S.key, grow: v / 100 } }, "grow")} format={signed} center />
                <label className="flex items-center gap-1.5 text-[11px]">
                  <input type="checkbox" checked={S.key.invert} disabled={locked} onChange={(e) => setSec2({ key: { ...S.key, invert: e.target.checked } }, "kinv")} /> اعكس (كل شي ما عدا هذا اللون)
                </label>
              </div>
              <div className="space-y-1.5 rounded-lg border border-jw-line p-2">
                <p className="text-[11px] font-semibold">٢) غيّره</p>
                <Slider label="حوّل اللون" value={Math.round(S.hue)} min={-180} max={180} step={1} disabled={locked} onChange={(v) => setSec2({ hue: v }, "ahue")} format={(v) => `${signed(v)}°`} center />
                <Slider label="التشبع" value={+(S.sat * 100).toFixed(0)} min={0} max={250} step={1} disabled={locked} onChange={(v) => setSec2({ sat: v / 100 }, "asat")} format={pct0} />
                <Slider label="الإضاءة (ستوب)" value={+S.lum.toFixed(2)} min={-2} max={2} step={0.05} disabled={locked} onChange={(v) => setSec2({ lum: v }, "alum")} format={(v) => signed(+v.toFixed(2))} center />
                <Slider label="الحرارة" value={+(S.temp * 100).toFixed(0)} min={-100} max={100} step={1} disabled={locked} onChange={(v) => setSec2({ temp: v / 100 }, "atemp")} format={signed} center bg="linear-gradient(90deg,#3b82f6,#e5e7eb,#f59e0b)" />
                <Slider label="التباين" value={+(S.contrast * 100).toFixed(0)} min={40} max={200} step={1} disabled={locked} onChange={(v) => setSec2({ contrast: v / 100 }, "acon")} format={pct0} />
              </div>
              <div className="space-y-1.5 rounded-lg border border-jw-line p-2">
                <p className="text-[11px] font-semibold">٣) ماسك خاص بهذا الثانوي (اختياري)</p>
                <MaskEditor mask={S.mask} thumb={thumb} disabled={locked} clipT={clipT} inClip={inClip} onChange={(m) => setSec2({ mask: m }, "mask")} />
              </div>
            </div>
          )}
        </div>
      )}

      {page === "mask" && (
        <div className="space-y-2">
          <p className="text-[11px] leading-5 text-jw-muted">الماسك (Power Window): التلوين كله يطبّق جوا الشكل بس (أو برّاه لو عكسته). حافة ناعمة بالدقة اللي تبيها، ويقدر يتحرك مع الوقت.</p>
          <MaskEditor mask={g.mask} thumb={thumb} disabled={locked} clipT={clipT} inClip={inClip} onChange={(m) => set({ mask: m }, "mask")} />
        </div>
      )}

      {page === "film" && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold">تلوين منفصل (Split toning)</p>
          <Slider label="لون الظلال" value={+(g.split.shadowHue * 360).toFixed(0)} min={0} max={360} step={1} disabled={locked} onChange={(v) => set({ split: { ...g.split, shadowHue: v / 360 } }, "split")} format={(v) => `${v}°`} bg={HUE_BG} />
          <Slider label="قوته" value={+(g.split.shadowSat * 100).toFixed(0)} min={0} max={100} step={1} disabled={locked} onChange={(v) => set({ split: { ...g.split, shadowSat: v / 100 } }, "split")} />
          <Slider label="لون الأضواء" value={+(g.split.highHue * 360).toFixed(0)} min={0} max={360} step={1} disabled={locked} onChange={(v) => set({ split: { ...g.split, highHue: v / 360 } }, "split")} format={(v) => `${v}°`} bg={HUE_BG} />
          <Slider label="قوته" value={+(g.split.highSat * 100).toFixed(0)} min={0} max={100} step={1} disabled={locked} onChange={(v) => set({ split: { ...g.split, highSat: v / 100 } }, "split")} />
          <Slider label="التوازن (ظلال ← أضواء)" value={+(g.split.balance * 100).toFixed(0)} min={-100} max={100} step={1} disabled={locked} onChange={(v) => set({ split: { ...g.split, balance: v / 100 } }, "split")} format={signed} center />
          <p className="pt-1 text-[11px] font-semibold">هالة الفيلم (Halation)</p>
          <Slider label="القوة" value={+(g.halation.amount * 100).toFixed(0)} min={0} max={100} step={1} disabled={locked} onChange={(v) => set({ halation: { ...g.halation, amount: v / 100 } }, "halation")} />
          <Slider label="من أي سطوع" value={+(g.halation.threshold * 100).toFixed(0)} min={30} max={100} step={1} disabled={locked} onChange={(v) => set({ halation: { ...g.halation, threshold: v / 100 } }, "halation")} />
          <Slider label="الحجم" value={+(g.halation.size * 100).toFixed(0)} min={0} max={100} step={1} disabled={locked} onChange={(v) => set({ halation: { ...g.halation, size: v / 100 } }, "halation")} />
          <p className="pt-1 text-[11px] font-semibold">حبيبات الفيلم (Grain)</p>
          <Slider label="القوة" value={+(g.grain.amount * 100).toFixed(0)} min={0} max={100} step={1} disabled={locked} onChange={(v) => set({ grain: { ...g.grain, amount: v / 100 } }, "grain")} />
          <Slider label="الحجم" value={+(g.grain.size * 100).toFixed(0)} min={0} max={100} step={1} disabled={locked} onChange={(v) => set({ grain: { ...g.grain, size: v / 100 } }, "grain")} />
          <p className="pt-1 text-[11px] font-semibold">الزوايا (Vignette)</p>
          <Slider label="القوة (سالب = فاتح)" value={+(g.vignette.amount * 100).toFixed(0)} min={-100} max={100} step={1} disabled={locked} onChange={(v) => set({ vignette: { ...g.vignette, amount: v / 100 } }, "vignette")} format={signed} center />
          <Slider label="الحجم" value={+(g.vignette.size * 100).toFixed(0)} min={10} max={150} step={1} disabled={locked} onChange={(v) => set({ vignette: { ...g.vignette, size: v / 100 } }, "vignette")} />
          <Slider label="النعومة" value={+(g.vignette.soft * 100).toFixed(0)} min={0} max={100} step={1} disabled={locked} onChange={(v) => set({ vignette: { ...g.vignette, soft: v / 100 } }, "vignette")} />
          <Slider label="الاستدارة" value={+(g.vignette.round * 100).toFixed(0)} min={0} max={100} step={1} disabled={locked} onChange={(v) => set({ vignette: { ...g.vignette, round: v / 100 } }, "vignette")} />
        </div>
      )}

      <button type="button" className="jw-btn jw-btn-quiet w-full text-xs" disabled={locked || !clip.grade} onClick={reset}>
        <Icon name="retry" size={14} /> شيل التلوين كله
      </button>
    </div>
  );
}
const pct0 = (v: number) => `${v}%`;
void pct;
