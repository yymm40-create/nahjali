"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Clip, ClipFx } from "@/lib/editor/model";
import { FX_CATS, FX_LIST, type FxCat } from "@/lib/editor/effects";
import Icon from "../Icon";
import { drawWithFx, fxPlan } from "./fx";
import type { Run } from "./Inspector";

/** One effect's tile: the clip's own picture with the effect, drawn when it comes into view (and moving on hover). */
function Tile({ id, img, on, order, disabled, onPick, label }: { id: string; img: HTMLImageElement | null; on: boolean; order: number; disabled: boolean; onPick: () => void; label: string }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const [seen, setSeen] = useState(false);
  const [hover, setHover] = useState(false);
  useEffect(() => {
    const el = cv.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setSeen(true), { rootMargin: "100px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    const el = cv.current;
    if (!el || !seen) return;
    const g = el.getContext("2d")!;
    let raf = 0;
    const start = performance.now();
    const paint = (now: number) => {
      const t = 0.9 + (hover ? (now - start) / 1000 : 0);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = "#0b1020";
      g.fillRect(0, 0, el.width, el.height);
      g.translate(el.width / 2, el.height / 2);
      g.save();
      g.beginPath();
      g.rect(-el.width / 2, -el.height / 2, el.width, el.height);
      g.clip();
      const src = img && img.complete && img.naturalWidth ? { img: img as CanvasImageSource, sw: img.naturalWidth, sh: img.naturalHeight } : null;
      if (src) drawWithFx(g, src, el.width, el.height, fxPlan([{ id, amount: 1 }], t, 6), "");
      g.restore();
      if (hover) raf = requestAnimationFrame(paint);
    };
    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, [seen, hover, img, id]);
  return (
    <button type="button" disabled={disabled} onClick={onPick} onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)} aria-pressed={on} className={`jw-3d relative overflow-hidden rounded-xl border text-start ${on ? "border-jw-accent ring-2 ring-jw-accent" : "border-jw-line"}`}>
      <canvas ref={cv} width={128} height={80} className="block h-auto w-full" />
      {on && <span className="absolute end-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-jw-accent text-[10px] font-bold text-jw-on-accent">{order}</span>}
      <span className="block truncate px-1.5 py-1 text-[10px]">{label}</span>
    </button>
  );
}

/** «مؤثرات»: up to three effects on a picture or video, each with its strength. */
export default function FxPanel({ clip, thumb, locked, run, flash, others }: { clip: Clip; thumb: string | null; locked: boolean; run: Run; flash: (m: string, bad?: boolean) => void; others: string[] }) {
  const [cat, setCat] = useState<FxCat | "all">("all");
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!thumb) return;
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = thumb;
  }, [thumb]);
  const list = useMemo(() => FX_LIST.filter((f) => cat === "all" || f.cat === cat), [cat]);
  const set = (fx: ClipFx[], key: string) => run({ type: "update_clip", clipId: clip.id, patch: { fx } }, { coalesce: `${clip.id}:fx:${key}` });
  const toggle = (id: string) => {
    if (clip.fx.some((f) => f.id === id)) return set(clip.fx.filter((f) => f.id !== id), `off:${id}`);
    if (clip.fx.length >= 3) return flash("ثلاث مؤثرات بالكثير على المقطع؛ شيل واحد أول.", true);
    set([...clip.fx, { id, amount: 0.8 }], `on:${id}`);
  };
  return (
    <div className="space-y-3">
      {clip.fx.length > 0 && (
        <div className="space-y-2 rounded-xl border border-jw-line p-2">
          {clip.fx.map((f, i) => {
            const p = FX_LIST.find((x) => x.id === f.id)!;
            return (
              <div key={f.id} className="space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-jw-accent text-[10px] font-bold text-jw-on-accent">{i + 1}</span>
                  <span className="flex-1 font-semibold">{p.label}</span>
                  <span className="tabular-nums text-jw-muted" dir="ltr">{Math.round(f.amount * 100)}%</span>
                  <button type="button" disabled={locked} className="text-jw-muted hover:text-jw-danger" onClick={() => toggle(f.id)} aria-label={`شيل ${p.label}`}>
                    <Icon name="x" size={14} />
                  </button>
                </div>
                <input type="range" className="w-full accent-[var(--jw-accent)]" min={5} max={100} step={5} disabled={locked} value={Math.round(f.amount * 100)} aria-label={`قوة ${p.label}`} onChange={(e) => set(clip.fx.map((x) => (x.id === f.id ? { ...x, amount: Number(e.target.value) / 100 } : x)), `amount:${f.id}`)} />
              </div>
            );
          })}
          <div className="flex gap-1.5">
            {others.length > 0 && (
              <button type="button" className="jw-btn !min-h-8 flex-1 text-[11px]" disabled={locked} onClick={() => run(others.map((id) => ({ type: "update_clip" as const, clipId: id, patch: { fx: clip.fx } })), { label: "نفس المؤثرات لكل المسار" })}>
                طبّقها على كل المسار
              </button>
            )}
            <button type="button" className="jw-btn jw-btn-quiet !min-h-8 flex-1 text-[11px]" disabled={locked} onClick={() => set([], "clear")}>
              <Icon name="retry" size={13} /> بدون مؤثرات
            </button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-1">
        {(["all", ...Object.keys(FX_CATS)] as (FxCat | "all")[]).map((k) => (
          <button key={k} type="button" aria-pressed={cat === k} onClick={() => setCat(k)} className={`jw-chip !px-2 !py-0.5 !text-[11px] ${cat === k ? "!border-jw-accent !text-jw-ink" : ""}`}>
            {k === "all" ? `الكل (${FX_LIST.length})` : FX_CATS[k]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {list.map((f) => {
          const i = clip.fx.findIndex((x) => x.id === f.id);
          return <Tile key={f.id} id={f.id} label={f.label} img={img} on={i >= 0} order={i + 1} disabled={locked} onPick={() => toggle(f.id)} />;
        })}
      </div>
      <p className="text-[10px] leading-4 text-jw-faint">مرّر على أي مؤثر تشوفه يتحرك. تقدر تجمع لين ثلاث مؤثرات، والتصدير يطلع مثل المعاينة.</p>
    </div>
  );
}
