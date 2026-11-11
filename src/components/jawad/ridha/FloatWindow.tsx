"use client";

// «الرضا فويس» — a tool's window, floating over the tracks: dragged by its bar, resized from its corner, made
// large or folded to its bar with one press, and left open while the tracks are worked on underneath. Where it
// was put and how big is remembered on the device. On a phone it is a sheet along the bottom instead.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
type Mode = "normal" | "large" | "folded";

const load = (id: string): Rect | null => {
  try {
    const v = JSON.parse(localStorage.getItem(`ridha:win:${id}`) ?? "null") as Rect | null;
    return v && [v.x, v.y, v.w, v.h].every((n) => typeof n === "number" && Number.isFinite(n)) ? v : null;
  } catch {
    return null;
  }
};

export default function FloatWindow({ id, title, hint, tabs, size, order, top, onFocus, onClose, children }: {
  id: string;
  title: string;
  hint?: string;
  /** the tools inside, when the window holds several */
  tabs?: ReactNode;
  /** the size it opens at the first time */
  size: { w: number; h: number };
  /** its place in the pile of open windows (0 = the first opened): new ones open a little down and aside */
  order: number;
  top: boolean;
  onFocus(): void;
  onClose(): void;
  children: ReactNode;
}) {
  const el = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [mode, setMode] = useState<Mode>("normal");

  /** Kept inside the studio, with its bar always reachable. */
  const fit = useCallback((r: Rect): Rect => {
    const host = el.current?.parentElement;
    const W = host?.clientWidth ?? 1200, H = host?.clientHeight ?? 700;
    const w = Math.max(320, Math.min(r.w, W - 16)), h = Math.max(200, Math.min(r.h, H - 120));
    return { w, h, x: Math.max(8 - w + 120, Math.min(r.x, W - 120)), y: Math.max(60, Math.min(r.y, H - 96)) };
  }, []);

  // placed once the studio's size is known: where it was last time, or centred above the dock
  useEffect(() => {
    const host = el.current?.parentElement;
    const W = host?.clientWidth ?? 1200, H = host?.clientHeight ?? 700;
    const w = Math.min(size.w, W - 24), h = Math.min(size.h, H - 130);
    setRect(fit(load(id) ?? { w, h, x: Math.round((W - w) / 2) + order * 26, y: H - h - 62 - order * 26 }));
  }, [id, size.w, size.h, order, fit]);

  const keep = (r: Rect) => {
    try {
      localStorage.setItem(`ridha:win:${id}`, JSON.stringify(r));
    } catch {}
  };

  const drag = (e: React.PointerEvent, kind: "move" | "size") => {
    if (!rect || mode === "large" || (kind === "size" && mode === "folded")) return;
    if ((e.target as HTMLElement).closest("button, select, input")) return;
    e.preventDefault();
    onFocus();
    const from = { x: e.clientX, y: e.clientY }, start = rect;
    let last = rect;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - from.x, dy = ev.clientY - from.y;
      last = fit(kind === "move" ? { ...start, x: start.x + dx, y: start.y + dy } : { ...start, w: start.w + dx, h: start.h + dy });
      setRect(last);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      keep(last);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const style = !rect ? { visibility: "hidden" as const } : mode === "large" ? { left: 8, right: 8, top: 62, bottom: 54, zIndex: top ? 16 : 12 } : { left: rect.x, top: rect.y, width: rect.w, height: mode === "folded" ? undefined : rect.h, zIndex: top ? 16 : 12 };
  return (
    <section ref={el} className={`rv-win${top ? " top" : ""} ${mode}`} style={style} onPointerDownCapture={onFocus} aria-label={title}>
      <header className="rv-win-bar" onPointerDown={(e) => drag(e, "move")} onDoubleClick={(e) => !(e.target as HTMLElement).closest("button") && setMode(mode === "large" ? "normal" : "large")}>
        <b>{title}</b>
        {hint ? <span className="rv-muted">{hint}</span> : null}
        {tabs}
        <span className="rv-grow" />
        <button type="button" className="rv-win-b" onClick={() => setMode(mode === "folded" ? "normal" : "folded")} title={mode === "folded" ? "افتح النافذة" : "اطوِها إلى شريطها"} aria-label="طيّ">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 12h12" /></svg>
        </button>
        <button type="button" className="rv-win-b" onClick={() => setMode(mode === "large" ? "normal" : "large")} title={mode === "large" ? "رجّعها لحجمها" : "كبّرها على الشاشة"} aria-label="تكبير">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"><path d={mode === "large" ? "M8 8h11v11H8zM5 16V5h11" : "M5 5h14v14H5z"} /></svg>
        </button>
        <button type="button" className="rv-win-b" onClick={onClose} title="إغلاق" aria-label="إغلاق">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </header>
      {mode === "folded" ? null : <div className="rv-win-body">{children}</div>}
      {mode === "normal" ? <span className="rv-win-grip" onPointerDown={(e) => drag(e, "size")} title="اسحب لتغيير الحجم" /> : null}
    </section>
  );
}
