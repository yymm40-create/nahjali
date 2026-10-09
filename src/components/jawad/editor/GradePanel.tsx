"use client";

// «التلوين» — the inspector's colour page: the camera's log, the primaries, the wheels, curves, secondaries keyed by
// colour, windows (masks), ready looks and .cube LUTs, and film (split toning, halation, grain, vignette). Every
// change is one command on the clip's grade (grade.ts); the GPU draws it (grade-gl.ts).

import { useEffect, useRef, useState } from "react";
import type { Clip } from "@/lib/editor/model";
import { clipLength } from "@/lib/editor/model";
import { applyLook, FLAT, LINE, LOGS, LOOKS, MAX_LAYERS, MAX_SECONDARIES, NEUTRAL_GRADE, NEW_MASK, NEW_SECONDARY, parseCube, toCube, type Curves, type Grade, type LogGamut, type LogId, type Mask, type Pt, type Secondary, type Wheel } from "@/lib/editor/grade";
import Icon from "../Icon";
import { bakeLut, gradeReady, gradeView } from "./grade-gl";
import type { Run } from "./Inspector";
import type { PlayerLike } from "./Timeline";
import { saveFile } from "./package";
import { copyGrade, pasteableGrade } from "./clipboard";
import { pasteGradeCommands } from "@/lib/editor/grade-paste";


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

function ColorWheel({ label, value, onChange, disabled, size = 84 }: { label: string; value: Wheel; onChange: (w: Wheel) => void; disabled: boolean; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const S = size;
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
  }, [S]);
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

/** What the mask editor can ask of the clip's media («ماسك ذكي», «تتبّع»), when it has a picture or a video. */
export interface MaskTools {
  video: boolean;
  smart: (words: string, track: boolean, near: Pt | null, onStep: (t: string) => void, signal: AbortSignal) => Promise<Mask>;
  track: (m: Mask, fromT: number, onStep: (f: number) => void, signal: AbortSignal) => Promise<Mask["keys"]>;
  flash: (text: string, bad?: boolean) => void;
}

function MaskEditor({ mask, onChange, thumb, disabled, clipT, inClip, tools }: { mask: Mask | null; onChange: (m: Mask | null) => void; thumb: string | null; disabled: boolean; clipT: number; inClip: boolean; tools?: MaskTools | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const m = mask;
  const [words, setWords] = useState("");
  const [follow, setFollow] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const stop = useRef<AbortController | null>(null);
  const work = async (what: (s: AbortSignal) => Promise<void>) => {
    const ac = new AbortController();
    stop.current = ac;
    try {
      await what(ac.signal);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) tools?.flash(e instanceof Error ? e.message : "تعذّر.", true);
    } finally {
      setBusy(null);
      stop.current = null;
    }
  };
  const smart = () =>
    tools &&
    words.trim() &&
    work(async (signal) => {
      setBusy("…");
      const near = m ? (m.kind === "path" && m.points.length ? { x: m.x, y: m.y } : posAt(m, clipT)) : null;
      const got = await tools.smart(words.trim(), follow && tools.video, near, setBusy, signal);
      onChange({ ...got, invert: m?.invert ?? false });
      tools.flash(got.shapes.length ? `حدّدت «${words.trim()}» وتتبّعته في ${got.shapes.length} لقطة ✓` : `حدّدت «${words.trim()}» ✓`);
    });
  const trackIt = () =>
    tools &&
    m &&
    work(async (signal) => {
      setBusy("أتتبّع 0٪");
      const keys = await tools.track(m, Math.max(0, clipT), (f) => setBusy(`أتتبّع ${Math.round(f * 100)}٪`), signal);
      // the points before the playhead stay; from it on, the tracked ones
      onChange({ ...m, keys: [...m.keys.filter((k) => k.t < clipT - 1), ...keys] });
      tools.flash(`تتبّعت الماسك (${keys.length} نقطة) ✓`);
    });
  const set = (p: Partial<Mask>) => m && onChange({ ...m, ...p });
  const dragCenter = (e: React.PointerEvent) => {
    if (!m || disabled) return;
    const el = ref.current!;
    const r = el.getBoundingClientRect();
    if (m.kind === "path") {
      if (m.shapes.length) return;
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
  // a tracked outline is drawn where the subject is at the playhead (no centre to move it by)
  const tracked = !!m && m.kind === "path" && m.shapes.length > 0;
  const pts = m ? (tracked ? shapeAt(m, clipT) : m.points) : [];
  const off = tracked || !m ? { x: 0, y: 0 } : { x: pos.x - m.x, y: pos.y - m.y };
  return (
    <div className="space-y-2">
      {tools && (
        <div className="space-y-1.5 rounded-lg border border-jw-accent/30 bg-jw-accent/5 p-2">
          <p className="text-[11px] font-semibold text-jw-accent">✨ ماسك ذكي: اكتب وش تبي تحدد، والذكاء يرسمه على حدوده بالضبط</p>
          <div className="flex gap-1.5">
            <input className="jw-input min-w-0 flex-1 !py-1 text-xs" dir="auto" value={words} disabled={disabled || !!busy} placeholder="مثلًا: الوجه، السماء، الشخص اللي يمين" onChange={(e) => setWords(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void smart()} aria-label="وش تبي تحدد؟" />
            <button type="button" className="jw-btn jw-btn-primary !min-h-8 !px-3 text-xs" disabled={disabled || !!busy || !words.trim()} onClick={() => void smart()}>
              حدّد
            </button>
          </div>
          {tools.video && (
            <label className="flex items-center gap-1.5 text-[11px]">
              <input type="checkbox" checked={follow} disabled={disabled || !!busy} onChange={(e) => setFollow(e.target.checked)} /> يتتبّعه طول المقطع (يتغيّر شكله معه)
            </label>
          )}
        </div>
      )}
      {busy && (
        <p className="flex items-center gap-2 text-[11px] text-jw-muted" aria-live="polite">
          <span className="jw-spinner !h-3 !w-3" /> {busy}
          <button type="button" className="ms-auto underline" onClick={() => stop.current?.abort()}>
            وقّف
          </button>
        </p>
      )}
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
          <button key={label} type="button" role="radio" aria-checked={(m?.kind ?? null) === k} disabled={disabled} onClick={() => onChange(k ? { ...(m ?? NEW_MASK), kind: k, points: k === "path" ? (m?.points ?? []) : [], shapes: k === "path" ? (m?.shapes ?? []) : [], ...(k === "linear" ? { w: 0.4, h: 0 } : {}) } : null)}>
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
                  {m.kind === "path" && pts.length >= 3 && <polygon fill={m.invert ? "black" : "white"} points={pts.map((p) => `${(p.x + off.x) * 100},${(p.y + off.y) * 100}`).join(" ")} />}
                </mask>
              </defs>
              <rect width="100" height="100" fill="var(--jw-accent)" fillOpacity="0.35" mask="url(#mk)" />
              {m.kind === "path" && !tracked && pts.length <= 64 && pts.map((p, i) => <circle key={i} cx={(p.x + off.x) * 100} cy={(p.y + off.y) * 100} r={pts.length > 20 ? 0.8 : 1.6} fill="#fff" stroke="var(--jw-accent)" strokeWidth="0.6" />)}
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
            {tools?.video && (m.kind === "ellipse" || m.kind === "rect") && (
              <button type="button" className="jw-btn !min-h-7 w-full text-[11px]" disabled={disabled || !!busy || !inClip} onClick={() => void trackIt()} title="حط الماسك على الشي، وحيدرة كت يلحقه من هنا لآخر المقطع">
                🎯 تتبّع الماسك من هنا لآخر المقطع
              </button>
            )}
            {tracked && (
              <div className="flex items-center gap-1.5 text-[11px] text-jw-muted">
                <span className="flex-1">✨ شكل متتبّع في {m.shapes.length} لقطة</span>
                <button type="button" className="jw-btn jw-btn-quiet !min-h-7 text-[11px]" disabled={disabled} onClick={() => set({ points: pts, shapes: [] })}>
                  ثبّته على هالشكل
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
import { maskAt as posAt, shapeAt } from "@/lib/editor/grade";
import { smartWindow, trackWindow } from "./track";

// ───────── the panel ─────────

type SectionId = "log" | "basic" | "creative" | "curves" | "wheels" | "hsl" | "mask" | "film";
const OPEN_KEY = "jw-grade-open";

/** A Lumetri-style section: a header that opens and closes, a reset, a short hint on hover. */
function Section({ id, title, hint, open, onToggle, onReset, badge, children, tools }: { id: SectionId; title: string; hint: string; open: boolean; onToggle: (id: SectionId) => void; onReset?: () => void; badge?: boolean; children: React.ReactNode; tools?: React.ReactNode }) {
  return (
    <section className="border-b border-jw-line last:border-0">
      <div className="flex items-center gap-1">
        <button type="button" className="flex min-w-0 flex-1 items-center gap-1.5 py-2 text-start text-xs font-bold" aria-expanded={open} onClick={() => onToggle(id)} title={hint}>
          <Icon name={open ? "chevronDown" : "chevronLeft"} size={13} />
          <span className="truncate">{title}</span>
          {badge && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-jw-accent" aria-label="معدّل" />}
        </button>
        {tools}
        {onReset && (
          <button type="button" className="grid h-7 w-7 place-items-center rounded text-jw-faint hover:text-jw-ink" onClick={onReset} aria-label={`رجّع ${title}`} title={`رجّع ${title}`}>
            <Icon name="retry" size={12} />
          </button>
        )}
      </div>
      {open && <div className="space-y-2 pb-3">{children}</div>}
    </section>
  );
}

function Seg<T extends string>({ value, options, onChange, disabled, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; disabled?: boolean; label: string }) {
  return (
    <div className="jw-seg" role="radiogroup" aria-label={label}>
      {options.map(([k, l]) => (
        <button key={k} type="button" role="radio" aria-checked={value === k} disabled={disabled} onClick={() => onChange(k)}>
          {l}
        </button>
      ))}
    </div>
  );
}

const CURVES: [keyof Curves, string][] = [
  ["master", "الكل"],
  ["r", "أحمر"],
  ["g", "أخضر"],
  ["b", "أزرق"],
  ["hueHue", "لون←لون"],
  ["hueSat", "لون←تشبع"],
  ["hueLum", "لون←إضاءة"],
  ["lumSat", "إضاءة←تشبع"],
  ["satSat", "تشبع←تشبع"],
];
const curveBg = (k: keyof Curves) => (k.startsWith("hue") ? HUE_BG : k === "r" ? "linear-gradient(135deg,#1a0000,#ff4040)" : k === "g" ? "linear-gradient(135deg,#001a00,#40ff40)" : k === "b" ? "linear-gradient(135deg,#00001a,#4040ff)" : undefined);
const flatCurve = (k: keyof Curves) => k.startsWith("hue") || k === "lumSat" || k === "satSat";
const isOff = (g: Grade, keys: (keyof Grade)[]) => keys.every((k) => JSON.stringify(g[k]) === JSON.stringify(NEUTRAL_GRADE[k]));

export default function GradePanel({ clip, thumb, locked, run, flash, player, media = null, projectId = null, targets }: { clip: Clip; thumb: string | null; locked: boolean; run: Run; flash: (m: string, bad?: boolean) => void; player: PlayerLike | null; /** the clip's picture or video (for «ماسك ذكي» and «تتبّع») */ media?: { url: string; kind: "video" | "image" } | null; projectId?: string | null; /** the other clips a copied grading can go to (see Inspector) */ targets?: { track: string[]; all: string[] } }) {
  const layers = clip.grades;
  const [pasted, setPasted] = useState(0);
  const [li, setLi] = useState(0);
  const L = Math.min(li, Math.max(0, layers.length - 1));
  const g: Grade = layers[L] ?? NEUTRAL_GRADE;
  const [curve, setCurve] = useState<keyof Curves>("master");
  const [sec, setSec] = useState(0);
  const [big, setBig] = useState<null | "wheels" | "curves">(null);
  const [view, setView] = useState(gradeView.mode);
  const [splitX, setSplitX] = useState(gradeView.x);
  const [splitDir, setSplitDir] = useState(gradeView.dir);
  const [open, setOpen] = useState<SectionId[]>(["log", "basic"]);
  const [ms, setMs] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const v = JSON.parse(localStorage.getItem(OPEN_KEY) ?? "null");
        if (Array.isArray(v)) setOpen(v);
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!player) return;
    const t = setTimeout(() => setMs(player.ms), 0);
    const off = player.subscribe((m) => setMs(m));
    return () => {
      clearTimeout(t);
      off();
    };
  }, [player]);
  // leaving the clip (or the panel): the preview goes back to showing the grade
  useEffect(
    () => () => {
      gradeView.mode = "on";
    },
    [],
  );
  useEffect(() => {
    if (!big) return;
    // (first, and alone: Esc here only shrinks it, the clip stays selected)
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      setBig(null);
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [big]);

  const toggle = (id: SectionId) =>
    setOpen((o) => {
      const next = o.includes(id) ? o.filter((x) => x !== id) : [...o, id];
      try {
        localStorage.setItem(OPEN_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  const clipT = ms - clip.start;
  const tools: MaskTools | null =
    media && projectId
      ? {
          video: media.kind === "video",
          flash,
          smart: (words, track, near, onStep, signal) => smartWindow({ projectId, url: media.url, kind: media.kind, clip, words, atT: clipT, track, near, onStep, signal }),
          track: (m, fromT, onStep, signal) => trackWindow(media.url, clip, m, fromT, onStep, signal),
        }
      : null;
  const inClip = clipT >= 0 && clipT <= clipLength(clip);
  const set = (patch: Partial<Grade>, key: string) => run({ type: "update_clip", clipId: clip.id, patch: { grade: { ...patch, layer: L } } }, { coalesce: `${clip.id}:grade:${L}:${key}` });
  const setLayers = (list: Grade[]) => run({ type: "update_clip", clipId: clip.id, patch: { grades: list } });
  const resetKeys = (keys: (keyof Grade)[]) => set(Object.fromEntries(keys.map((k) => [k, NEUTRAL_GRADE[k]])) as Partial<Grade>, `reset:${keys.join()}`);
  const redraw = () => player?.seek(player.ms);
  const showView = (m: typeof view) => {
    gradeView.mode = m;
    setView(m);
    redraw();
  };
  const gpu = gradeReady();
  const S = g.secondaries[sec] as Secondary | undefined;
  const setSec2 = (p: Partial<Secondary>, key: string) => set({ secondaries: g.secondaries.map((s, i) => (i === sec ? { ...s, ...p } : s)) }, `sec${sec}:${key}`);
  const fileRef = useRef<HTMLInputElement>(null);
  const D = locked;

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
    const bytes = bakeLut(layers, 33);
    if (!bytes) return flash("ما قدرنا نصدّر LUT من هذا المتصفح.", true);
    saveFile(new Blob([toCube("Haidara Cut grade", 33, bytes)], { type: "text/plain" }), `haidara-grade-${Date.now().toString(36)}.cube`);
    flash("نزل ملف .cube: يشتغل في بريمير ودافنشي وكاب كت.");
  };

  const wheels = (size: number) => (
    <div className={size > 120 ? "flex flex-wrap items-start justify-center gap-6" : "grid grid-cols-2 gap-3"}>
      <ColorWheel size={size} label="الظلال · Lift" value={g.lift} disabled={D} onChange={(w) => set({ lift: w }, "lift")} />
      <ColorWheel size={size} label="الوسط · Gamma" value={g.gamma} disabled={D} onChange={(w) => set({ gamma: w }, "gamma")} />
      <ColorWheel size={size} label="الأضواء · Gain" value={g.gain} disabled={D} onChange={(w) => set({ gain: w }, "gain")} />
      <ColorWheel size={size} label="الكل · Offset" value={g.offset} disabled={D} onChange={(w) => set({ offset: w }, "offset")} />
    </div>
  );
  const curveTabs = (
    <div className="jw-scroll -mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {CURVES.map(([k, label]) => (
        <button key={k} type="button" className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${curve === k ? "bg-jw-accent text-jw-on-accent" : "bg-jw-surface-2 text-jw-muted"}`} onClick={() => setCurve(k)}>
          {label}
        </button>
      ))}
    </div>
  );
  const curveEditor = <CurveEditor pts={g.curves[curve]} flat={flatCurve(curve)} disabled={D} bg={curveBg(curve)} onChange={(pts) => set({ curves: { ...g.curves, [curve]: pts } }, `curve:${curve}`)} />;
  const enlarge = (what: "wheels" | "curves") => (
    <button type="button" className="grid h-7 w-7 place-items-center rounded text-jw-muted hover:bg-jw-surface-2 hover:text-jw-ink" onClick={() => setBig(what)} aria-label="كبّر" title="كبّر للدقة (Esc يرجعه)">
      <Icon name="expand" size={13} />
    </button>
  );

  return (
    <div className="space-y-2">
      {!gpu && <p className="rounded-lg bg-jw-warn/10 p-2 text-[11px] text-jw-warn">متصفحك ما يقدر يلوّن على كرت الشاشة (WebGL2). جرّب Chrome.</p>}

      {/* copy this grading and paste it onto other clips (one, a whole track, or every picture) */}
      {(() => {
        const have = pasteableGrade();
        const paste = (ids: string[], what: string) => {
          if (!have || !ids.length) return;
          run(pasteGradeCommands(have.grades, ids), { label: "لصق التلوين" });
          setPasted(ids.length);
          flash(`لصقت التلوين على ${what}.`);
        };
        const n = (k: number) => (k === 1 ? "مقطع واحد" : `${k} مقاطع`);
        return (
          <div className="space-y-1.5 rounded-xl border border-jw-line bg-jw-surface-2/50 p-1.5">
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className="jw-btn jw-btn-quiet !min-h-8 text-xs" disabled={!layers.length} onClick={() => { copyGrade(layers, clip.id); setPasted(0); flash(`نسخت التلوين (${layers.length === 1 ? "طبقة" : `${layers.length} طبقات`}). الحين اختر مقطع ثاني والصقه.`); }} title="انسخ تلوين هذا المقطع بكل طبقاته">
                📋 انسخ التلوين
              </button>
              {have && (
                <button type="button" className="jw-btn !min-h-8 text-xs" disabled={D || have.from === clip.id} onClick={() => paste([clip.id], "هذا المقطع")} title="يستبدل تلوين هذا المقطع بالمنسوخ">
                  📌 الصق هنا
                </button>
              )}
            </div>
            {have && targets && (targets.track.length > 0 || targets.all.length > 0) && (
              <div className="flex flex-wrap gap-1.5">
                {targets.track.length > 0 && (
                  <button type="button" className="jw-btn !min-h-8 text-xs" disabled={D} onClick={() => paste(targets.track, `كل مقاطع هذا المسار (${n(targets.track.length)})`)}>
                    📌 الصق على كل المسار ({targets.track.length})
                  </button>
                )}
                {targets.all.length > 0 && (
                  <button type="button" className="jw-btn !min-h-8 text-xs" disabled={D} onClick={() => paste(targets.all, `كل الفيديوهات والصور (${n(targets.all.length)})`)}>
                    📌 الصق على كل الفيديوهات ({targets.all.length})
                  </button>
                )}
              </div>
            )}
            <p className="text-[11px] leading-5 text-jw-faint">
              {have ? `المنسوخ: تلوين ${have.grades.length === 1 ? "بطبقة" : `بـ${have.grades.length} طبقات`}. ` : ""}
              {pasted ? `✓ انلصق على ${n(pasted)}. ` : ""}
              تبي تلصقه على مقاطع تختارها؟ حدّدها (Shift أو مربع تحديد) واضغط «الصق التلوين المنسوخ على المحدد».
            </p>
          </div>
        );
      })()}

      {/* layers and the before / after */}
      <div className="sticky top-0 z-10 space-y-1.5 rounded-xl border border-jw-line bg-jw-surface p-1.5">
        <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="طبقات التلوين">
          {(layers.length ? layers : [NEUTRAL_GRADE]).map((x, i) => (
            <span key={i} className={`flex items-center rounded-full border ${L === i ? "border-jw-accent bg-jw-accent/10" : "border-jw-line"}`}>
              <button type="button" role="tab" aria-selected={L === i} className={`py-0.5 ps-2 pe-1 text-[11px] font-semibold ${x.on ? "" : "text-jw-faint line-through"}`} onClick={() => setLi(i)}>
                {x.name || `طبقة ${i + 1}`}
              </button>
              {layers[i] && (
                <button type="button" className="grid h-6 w-6 place-items-center rounded-full text-jw-muted hover:text-jw-ink" disabled={D} aria-label={x.on ? "طفّ الطبقة" : "شغّل الطبقة"} title={x.on ? "طفّ الطبقة" : "شغّل الطبقة"} onClick={() => setLayers(layers.map((y, k) => (k === i ? { ...y, on: !y.on } : y)))}>
                  <Icon name={x.on ? "eye" : "eyeOff"} size={12} />
                </button>
              )}
            </span>
          ))}
          {layers.length < MAX_LAYERS && (
            <button type="button" className="rounded-full border border-dashed border-jw-line px-2 py-0.5 text-[11px]" disabled={D} title="طبقة تلوين جديدة فوق اللي قبلها" onClick={() => { setLayers([...(layers.length ? layers : [NEUTRAL_GRADE]), { ...NEUTRAL_GRADE }]); setLi(Math.max(1, layers.length)); }}>
              + طبقة
            </button>
          )}
          <span className="ms-auto flex items-center">
            {layers[L] && (
              <>
                <button type="button" className="grid h-7 w-7 place-items-center rounded text-jw-muted hover:text-jw-ink" disabled={D || layers.length >= MAX_LAYERS} aria-label="كرر الطبقة" title="كرر الطبقة" onClick={() => { setLayers([...layers.slice(0, L + 1), { ...layers[L] }, ...layers.slice(L + 1)]); setLi(L + 1); }}>
                  <Icon name="copy" size={12} />
                </button>
                <button type="button" className="grid h-7 w-7 place-items-center rounded text-jw-muted hover:text-jw-danger" disabled={D} aria-label="احذف الطبقة" title="احذف الطبقة" onClick={() => { setLayers(layers.filter((_, k) => k !== L)); setLi(Math.max(0, L - 1)); }}>
                  <Icon name="trash" size={12} />
                </button>
              </>
            )}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Seg label="قبل وبعد" value={view} onChange={showView} options={[["on", "بعد"], ["off", "قبل"], ["split", "قسمة"]]} />
          {view === "split" && <Seg label="اتجاه القسمة" value={splitDir} onChange={(d) => { gradeView.dir = d; setSplitDir(d); redraw(); }} options={[["v", "⇆ يمين ويسار"], ["h", "⇅ فوق وتحت"]]} />}
          {view === "split" && <input type="range" dir="ltr" aria-label="مكان القسمة" className="min-w-0 flex-1 accent-[var(--jw-accent)]" min={5} max={95} value={Math.round(splitX * 100)} onChange={(e) => { gradeView.x = Number(e.target.value) / 100; setSplitX(gradeView.x); redraw(); }} />}
        </div>
        {layers[L] && (
          <input className="jw-input w-full !py-1 text-xs" value={g.name} placeholder={`اسم الطبقة (مثلًا: البشرة)`} maxLength={30} disabled={D} onChange={(e) => set({ name: e.target.value }, "name")} />
        )}
      </div>

      <div className="rounded-xl border border-jw-line px-2">
        <Section id="log" title="تحويل اللوج (Input)" hint="صوّرت بلوج؟ اختر كاميرتك: ترجع الألوان والتباين مثل CST في دافنشي" open={open.includes("log")} onToggle={toggle} badge={g.log !== "none"} onReset={() => resetKeys(["log", "logGamut", "logRange", "compress"])}>
          <select className="jw-input w-full !py-1.5 text-xs" value={g.log} disabled={D} onChange={(e) => set({ log: e.target.value as LogId }, "log")} aria-label="الكاميرا واللوج">
            {[...new Set(LOGS.map((l) => l.brand))].map((brand) => (
              <optgroup key={brand || "-"} label={brand || "عام"}>
                {LOGS.filter((l) => l.brand === brand).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {g.log !== "none" && (
            <>
              <p className="text-[10px] text-jw-faint">{LOGS.find((l) => l.id === g.log)?.hint}</p>
              <label className="block space-y-0.5">
                <span className="text-[11px] text-jw-muted" title="اللي ضبطته في الكاميرا: Color Space / Color Matrix. لو الألوان مشعّة جرّب BT.709">مساحة ألوان التصوير ⓘ</span>
                <Seg label="مساحة الألوان" value={g.logGamut} disabled={D} onChange={(v) => set({ logGamut: v }, "logGamut")} options={[["camera", g.log.startsWith("clog") ? "Cinema Gamut" : "واسعة"], ["rec709", "BT.709"], ["rec2020", "BT.2020"]] as [LogGamut, string][]} />
              </label>
              <label className="block space-y-0.5">
                <span className="text-[11px] text-jw-muted" title="خلّه «فيديو» إلا إذا الصورة طلعت باهتة أو غامقة بوضوح">مستوى الإشارة ⓘ</span>
                <Seg label="مستوى الإشارة" value={g.logRange} disabled={D} onChange={(v) => set({ logRange: v }, "logRange")} options={[["video", "فيديو"], ["full", "كامل"]]} />
              </label>
              <Slider label="ضغط الألوان الزائدة (أزرق LED، نيون)" value={Math.round(g.compress * 100)} min={0} max={100} step={1} disabled={D} onChange={(v) => set({ compress: v / 100 }, "compress")} />
            </>
          )}
        </Section>

        <Section id="basic" title="تصحيح أساسي" hint="توازن الأبيض، الإضاءة، التشبع" open={open.includes("basic")} onToggle={toggle} badge={!isOff(g, ["temp", "tint", "exposure", "contrast", "highlights", "shadows", "whites", "blacks", "saturation", "vibrance"])} onReset={() => resetKeys(["temp", "tint", "exposure", "contrast", "highlights", "shadows", "whites", "blacks", "saturation", "vibrance"])}>
          <Slider label="الحرارة" value={Math.round(g.temp * 100)} min={-100} max={100} step={1} disabled={D} onChange={(v) => set({ temp: v / 100 }, "temp")} format={signed} center bg="linear-gradient(90deg,#3b82f6,#e5e7eb,#f59e0b)" />
          <Slider label="الصبغة" value={Math.round(g.tint * 100)} min={-100} max={100} step={1} disabled={D} onChange={(v) => set({ tint: v / 100 }, "tint")} format={signed} center bg="linear-gradient(90deg,#22c55e,#e5e7eb,#d946ef)" />
          <Slider label="التعريض" value={+g.exposure.toFixed(2)} min={-3} max={3} step={0.05} disabled={D} onChange={(v) => set({ exposure: v }, "exposure")} format={(v) => signed(+v.toFixed(2))} center />
          <Slider label="التباين" value={Math.round(g.contrast * 100)} min={40} max={220} step={1} disabled={D} onChange={(v) => set({ contrast: v / 100 }, "contrast")} format={pct0} />
          <Slider label="الإضاءات" value={Math.round(g.highlights * 100)} min={-100} max={100} step={1} disabled={D} onChange={(v) => set({ highlights: v / 100 }, "highlights")} format={signed} center />
          <Slider label="الظلال" value={Math.round(g.shadows * 100)} min={-100} max={100} step={1} disabled={D} onChange={(v) => set({ shadows: v / 100 }, "shadows")} format={signed} center />
          <Slider label="البياض" value={Math.round(g.whites * 100)} min={-100} max={100} step={1} disabled={D} onChange={(v) => set({ whites: v / 100 }, "whites")} format={signed} center />
          <Slider label="السواد" value={Math.round(g.blacks * 100)} min={-100} max={100} step={1} disabled={D} onChange={(v) => set({ blacks: v / 100 }, "blacks")} format={signed} center />
          <Slider label="التشبع" value={Math.round(g.saturation * 100)} min={0} max={250} step={1} disabled={D} onChange={(v) => set({ saturation: v / 100 }, "saturation")} format={pct0} />
          <Slider label="الحيوية" value={Math.round(g.vibrance * 100)} min={-100} max={100} step={1} disabled={D} onChange={(v) => set({ vibrance: v / 100 }, "vibrance")} format={signed} center />
        </Section>

        <Section id="creative" title="إبداعي (لوكات و LUT)" hint="لوكات جاهزة، ملف LUT، تلوين الظلال والأضواء" open={open.includes("creative")} onToggle={toggle} badge={!!g.look || !!g.lut || !isOff(g, ["split"])} onReset={() => resetKeys(["look", "lut", "lutAmount", "split", "sharpen"])}>
          <div className="flex flex-wrap gap-1">
            {LOOKS.map((l) => (
              <button key={l.id} type="button" disabled={D} aria-pressed={g.look === l.id} title={l.hint} className={`rounded-full border px-2 py-0.5 text-[11px] ${g.look === l.id ? "border-jw-accent bg-jw-accent/15 text-jw-accent" : "border-jw-line hover:border-jw-line-strong"}`} onClick={() => run({ type: "update_clip", clipId: clip.id, patch: { grade: { ...applyLook(g, l), layer: L } } })}>
                {l.label}
              </button>
            ))}
          </div>
          <input ref={fileRef} type="file" accept=".cube,.CUBE" className="hidden" onChange={(e) => void loadCube(e.target.files?.[0]).then(() => (e.target.value = ""))} />
          <div className="flex gap-1.5">
            <button type="button" className="jw-btn !min-h-8 min-w-0 flex-1 truncate text-xs" disabled={D} onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={13} /> {g.lut ? g.lut.name : "LUT (.cube)"}
            </button>
            {g.lut && (
              <button type="button" className="jw-btn jw-btn-quiet !min-h-8 text-xs" disabled={D} onClick={() => set({ lut: null }, "lut")}>
                شيلها
              </button>
            )}
          </div>
          {g.lut && <Slider label="قوة الـLUT" value={Math.round(g.lutAmount * 100)} min={0} max={100} step={1} disabled={D} onChange={(v) => set({ lutAmount: v / 100 }, "lutAmount")} />}
          <Slider label="لون الظلال" value={Math.round(g.split.shadowHue * 360)} min={0} max={360} step={1} disabled={D} onChange={(v) => set({ split: { ...g.split, shadowHue: v / 360 } }, "split")} format={(v) => `${v}°`} bg={HUE_BG} />
          <Slider label="قوته" value={Math.round(g.split.shadowSat * 100)} min={0} max={100} step={1} disabled={D} onChange={(v) => set({ split: { ...g.split, shadowSat: v / 100 } }, "split")} />
          <Slider label="لون الأضواء" value={Math.round(g.split.highHue * 360)} min={0} max={360} step={1} disabled={D} onChange={(v) => set({ split: { ...g.split, highHue: v / 360 } }, "split")} format={(v) => `${v}°`} bg={HUE_BG} />
          <Slider label="قوته" value={Math.round(g.split.highSat * 100)} min={0} max={100} step={1} disabled={D} onChange={(v) => set({ split: { ...g.split, highSat: v / 100 } }, "split")} />
          <Slider label="التوازن" value={Math.round(g.split.balance * 100)} min={-100} max={100} step={1} disabled={D} onChange={(v) => set({ split: { ...g.split, balance: v / 100 } }, "split")} format={signed} center />
          <Slider label="الحدة" value={Math.round(g.sharpen * 100)} min={0} max={100} step={1} disabled={D} onChange={(v) => set({ sharpen: v / 100 }, "sharpen")} />
        </Section>

        <Section id="curves" title="منحنيات" hint="RGB ومنحنيات اللون: نقطة بضغطة، اسحبها، ضغطتين تشيلها" open={open.includes("curves")} onToggle={toggle} badge={!isOff(g, ["curves"])} onReset={() => resetKeys(["curves"])} tools={enlarge("curves")}>
          {curveTabs}
          {curveEditor}
        </Section>

        <Section id="wheels" title="عجلات الألوان" hint="Lift / Gamma / Gain / Offset: اسحب نحو اللون، ضغطتين ترجعه" open={open.includes("wheels")} onToggle={toggle} badge={!isOff(g, ["lift", "gamma", "gain", "offset"])} onReset={() => resetKeys(["lift", "gamma", "gain", "offset"])} tools={enlarge("wheels")}>
          {wheels(84)}
        </Section>

        <Section id="hsl" title="ثانوي HSL" hint="اختر لون من الصورة (البشرة، السماء…) وغيّره بروحه" open={open.includes("hsl")} onToggle={toggle} badge={g.secondaries.length > 0} onReset={() => resetKeys(["secondaries"])}>
          <div className="flex flex-wrap gap-1">
            {g.secondaries.map((s, i) => (
              <button key={i} type="button" className={`rounded-full px-2.5 py-0.5 text-[11px] ${sec === i ? "bg-jw-accent text-jw-on-accent" : "bg-jw-surface-2 text-jw-muted"} ${!s.on ? "line-through" : ""}`} onClick={() => setSec(i)}>
                {s.name || `ثانوي ${i + 1}`}
              </button>
            ))}
            {g.secondaries.length < MAX_SECONDARIES && (
              <button type="button" className="rounded-full border border-dashed border-jw-line px-2.5 py-0.5 text-[11px]" disabled={D} onClick={() => { set({ secondaries: [...g.secondaries, { ...NEW_SECONDARY }] }, "sec:add"); setSec(g.secondaries.length); }}>
                + ثانوي
              </button>
            )}
          </div>
          {S && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <input className="jw-input min-w-0 flex-1 !py-1 text-xs" value={S.name} placeholder={`ثانوي ${sec + 1}`} maxLength={40} disabled={D} onChange={(e) => setSec2({ name: e.target.value }, "name")} />
                <button type="button" className="grid h-7 w-7 place-items-center rounded text-jw-muted" disabled={D} aria-label={S.on ? "طفّه" : "شغّله"} title={S.on ? "طفّه" : "شغّله"} onClick={() => setSec2({ on: !S.on }, "on")}>
                  <Icon name={S.on ? "eye" : "eyeOff"} size={13} />
                </button>
                <button type="button" className={`rounded px-1.5 py-1 text-[10px] ${S.show ? "bg-white text-black" : "bg-jw-surface-2 text-jw-muted"}`} disabled={D} onClick={() => setSec2({ show: !S.show }, "show")} title="اعرض الاختيار: الأبيض هو المختار">
                  الماسك
                </button>
                <button type="button" className="grid h-7 w-7 place-items-center rounded text-jw-muted hover:text-jw-danger" disabled={D} aria-label="احذف الثانوي" onClick={() => { set({ secondaries: g.secondaries.filter((_, i) => i !== sec) }, "sec:remove"); setSec(0); }}>
                  <Icon name="trash" size={13} />
                </button>
              </div>
              <Slider label="اللون" value={Math.round(S.key.hue * 360)} min={0} max={360} step={1} disabled={D} onChange={(v) => setSec2({ key: { ...S.key, hue: v / 360 } }, "hue")} format={(v) => `${v}°`} bg={HUE_BG} />
              <Slider label="عرض اللون" value={Math.round(S.key.hueWidth * 360)} min={2} max={180} step={1} disabled={D} onChange={(v) => setSec2({ key: { ...S.key, hueWidth: v / 360 } }, "hueWidth")} format={(v) => `±${v}°`} />
              <Slider label="نعومة اللون" value={Math.round(S.key.hueSoft * 360)} min={0} max={120} step={1} disabled={D} onChange={(v) => setSec2({ key: { ...S.key, hueSoft: v / 360 } }, "hueSoft")} format={(v) => `${v}°`} />
              <div className="grid grid-cols-2 gap-x-2">
                <Slider label="تشبع من" value={Math.round(S.key.satLo * 100)} min={0} max={100} step={1} disabled={D} onChange={(v) => setSec2({ key: { ...S.key, satLo: v / 100 } }, "satLo")} />
                <Slider label="إلى" value={Math.round(S.key.satHi * 100)} min={0} max={100} step={1} disabled={D} onChange={(v) => setSec2({ key: { ...S.key, satHi: v / 100 } }, "satHi")} />
                <Slider label="إضاءة من" value={Math.round(S.key.lumLo * 100)} min={0} max={100} step={1} disabled={D} onChange={(v) => setSec2({ key: { ...S.key, lumLo: v / 100 } }, "lumLo")} />
                <Slider label="إلى" value={Math.round(S.key.lumHi * 100)} min={0} max={100} step={1} disabled={D} onChange={(v) => setSec2({ key: { ...S.key, lumHi: v / 100 } }, "lumHi")} />
              </div>
              <Slider label="نعومة الحواف" value={Math.round(S.key.soft * 100)} min={0} max={50} step={1} disabled={D} onChange={(v) => setSec2({ key: { ...S.key, soft: v / 100 } }, "soft")} />
              <Slider label="وسّع / ضيّق" value={Math.round(S.key.grow * 100)} min={-100} max={100} step={1} disabled={D} onChange={(v) => setSec2({ key: { ...S.key, grow: v / 100 } }, "grow")} format={signed} center />
              <label className="flex items-center gap-1.5 text-[11px]">
                <input type="checkbox" checked={S.key.invert} disabled={D} onChange={(e) => setSec2({ key: { ...S.key, invert: e.target.checked } }, "kinv")} /> اعكس الاختيار
              </label>
              <p className="pt-1 text-[11px] font-semibold text-jw-muted">التعديل</p>
              <Slider label="حوّل اللون" value={Math.round(S.hue)} min={-180} max={180} step={1} disabled={D} onChange={(v) => setSec2({ hue: v }, "ahue")} format={(v) => `${signed(v)}°`} center />
              <Slider label="التشبع" value={Math.round(S.sat * 100)} min={0} max={250} step={1} disabled={D} onChange={(v) => setSec2({ sat: v / 100 }, "asat")} format={pct0} />
              <Slider label="الإضاءة" value={+S.lum.toFixed(2)} min={-2} max={2} step={0.05} disabled={D} onChange={(v) => setSec2({ lum: v }, "alum")} format={(v) => signed(+v.toFixed(2))} center />
              <Slider label="الحرارة" value={Math.round(S.temp * 100)} min={-100} max={100} step={1} disabled={D} onChange={(v) => setSec2({ temp: v / 100 }, "atemp")} format={signed} center bg="linear-gradient(90deg,#3b82f6,#e5e7eb,#f59e0b)" />
              <Slider label="التباين" value={Math.round(S.contrast * 100)} min={40} max={200} step={1} disabled={D} onChange={(v) => setSec2({ contrast: v / 100 }, "acon")} format={pct0} />
              <details className="rounded-lg border border-jw-line p-1.5">
                <summary className="cursor-pointer text-[11px] text-jw-muted">ماسك خاص بهذا الثانوي</summary>
                <div className="pt-2">
                  <MaskEditor mask={S.mask} thumb={thumb} disabled={D} clipT={clipT} inClip={inClip} tools={tools} onChange={(m) => setSec2({ mask: m }, "mask")} />
                </div>
              </details>
            </div>
          )}
        </Section>

        <Section id="mask" title="ماسك (Power Window)" hint="التلوين يطبّق جوا الشكل بس (أو برّاه)، ويتحرك مع الوقت" open={open.includes("mask")} onToggle={toggle} badge={!!g.mask} onReset={() => resetKeys(["mask"])}>
          <MaskEditor mask={g.mask} thumb={thumb} disabled={D} clipT={clipT} inClip={inClip} tools={tools} onChange={(m) => set({ mask: m }, "mask")} />
        </Section>

        <Section id="film" title="فيلم والإطار" hint="هالة، حبيبات، زوايا، وقوة الطبقة" open={open.includes("film")} onToggle={toggle} badge={!isOff(g, ["halation", "grain", "vignette"])} onReset={() => resetKeys(["halation", "grain", "vignette", "pivot", "amount"])}>
          <Slider label="هالة الفيلم" value={Math.round(g.halation.amount * 100)} min={0} max={100} step={1} disabled={D} onChange={(v) => set({ halation: { ...g.halation, amount: v / 100 } }, "halation")} />
          {g.halation.amount > 0 && (
            <div className="grid grid-cols-2 gap-x-2">
              <Slider label="من سطوع" value={Math.round(g.halation.threshold * 100)} min={30} max={100} step={1} disabled={D} onChange={(v) => set({ halation: { ...g.halation, threshold: v / 100 } }, "halation")} />
              <Slider label="الحجم" value={Math.round(g.halation.size * 100)} min={0} max={100} step={1} disabled={D} onChange={(v) => set({ halation: { ...g.halation, size: v / 100 } }, "halation")} />
            </div>
          )}
          <Slider label="الحبيبات" value={Math.round(g.grain.amount * 100)} min={0} max={100} step={1} disabled={D} onChange={(v) => set({ grain: { ...g.grain, amount: v / 100 } }, "grain")} />
          {g.grain.amount > 0 && <Slider label="حجم الحبة" value={Math.round(g.grain.size * 100)} min={0} max={100} step={1} disabled={D} onChange={(v) => set({ grain: { ...g.grain, size: v / 100 } }, "grain")} />}
          <Slider label="الزوايا" value={Math.round(g.vignette.amount * 100)} min={-100} max={100} step={1} disabled={D} onChange={(v) => set({ vignette: { ...g.vignette, amount: v / 100 } }, "vignette")} format={signed} center />
          {g.vignette.amount !== 0 && (
            <div className="grid grid-cols-3 gap-x-2">
              <Slider label="الحجم" value={Math.round(g.vignette.size * 100)} min={10} max={150} step={1} disabled={D} onChange={(v) => set({ vignette: { ...g.vignette, size: v / 100 } }, "vignette")} />
              <Slider label="النعومة" value={Math.round(g.vignette.soft * 100)} min={0} max={100} step={1} disabled={D} onChange={(v) => set({ vignette: { ...g.vignette, soft: v / 100 } }, "vignette")} />
              <Slider label="الاستدارة" value={Math.round(g.vignette.round * 100)} min={0} max={100} step={1} disabled={D} onChange={(v) => set({ vignette: { ...g.vignette, round: v / 100 } }, "vignette")} />
            </div>
          )}
          <Slider label="محور التباين" value={Math.round(g.pivot * 100)} min={10} max={90} step={1} disabled={D} onChange={(v) => set({ pivot: v / 100 }, "pivot")} />
          <Slider label="قوة الطبقة" value={Math.round(g.amount * 100)} min={0} max={100} step={1} disabled={D} onChange={(v) => set({ amount: v / 100 }, "amount")} />
        </Section>
      </div>

      <div className="flex gap-1.5">
        <button type="button" className="jw-btn jw-btn-quiet !min-h-8 flex-1 text-xs" disabled={!layers.length} onClick={exportCube} title="التلوين (بدون الماسكات والحبيبات) كملف .cube لبريمير ودافنشي وكاب كت">
          <Icon name="download" size={13} /> صدّر LUT
        </button>
        <button type="button" className="jw-btn jw-btn-quiet !min-h-8 flex-1 text-xs" disabled={D || !layers.length} onClick={() => { run({ type: "update_clip", clipId: clip.id, patch: { grade: null } }); setLi(0); }}>
          <Icon name="retry" size={13} /> شيل التلوين كله
        </button>
      </div>

      {/* big wheels / curves for precise work: over the timeline, the picture stays in view */}
      {big && (
        <div className="fixed inset-x-3 bottom-3 z-[65] flex h-[min(46vh,560px)] flex-col rounded-2xl border border-jw-line bg-jw-surface p-3 shadow-2xl" role="dialog" aria-label={big === "wheels" ? "عجلات الألوان" : "المنحنيات"}>
          <div className="mb-2 flex items-center gap-2">
            <b className="text-sm">{big === "wheels" ? "عجلات الألوان" : "المنحنيات"}</b>
            <span className="text-[11px] text-jw-faint">{layers[L]?.name || `طبقة ${L + 1}`}</span>
            <span className="ms-auto">
              <Seg label="قبل وبعد" value={view} onChange={showView} options={[["on", "بعد"], ["off", "قبل"], ["split", "قسمة"]]} />
            </span>
            <button type="button" className="jw-btn jw-btn-quiet !min-h-8 text-xs" onClick={() => setBig(null)}>
              <Icon name="shrink" size={14} /> صغّر
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {big === "wheels" ? (
              wheels(190)
            ) : (
              <div className="mx-auto flex h-full max-w-[1100px] gap-4">
                <div className="w-44 shrink-0 space-y-1">
                  {CURVES.map(([k, label]) => (
                    <button key={k} type="button" className={`block w-full rounded-lg px-2 py-1.5 text-start text-xs ${curve === k ? "bg-jw-accent text-jw-on-accent" : "hover:bg-jw-surface-2"}`} onClick={() => setCurve(k)}>
                      {label}
                    </button>
                  ))}
                  <button type="button" className="jw-btn jw-btn-quiet !min-h-8 w-full text-xs" disabled={D} onClick={() => set({ curves: { ...g.curves, [curve]: flatCurve(curve) ? FLAT : LINE } }, `curve:${curve}:reset`)}>
                    رجّع المنحنى
                  </button>
                </div>
                <div className="aspect-square h-full max-h-full min-w-0">{curveEditor}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
const pct0 = (v: number) => `${v}%`;
void pct;
