"use client";

// A small floating button that never sits on the page's content: it can be dragged anywhere on the screen (kept inside it),
// folded with «–» into a thin tab on the nearest side, and its place and fold are remembered on this device. A press
// (without moving) calls `onPress`. Used by the student's «رأيك».

import { useEffect, useRef, useState } from "react";
import "./movable-bubble.css";

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private window: kept for this page only */
  }
};

export default function MovableBubble({
  id,
  size = 46,
  corner = "left",
  gradient,
  label,
  onPress,
  hidden = false,
  children,
}: {
  /** storage key part: one place per bubble */
  id: string;
  size?: number;
  /** where it starts: the bottom of the screen on this side */
  corner?: "left" | "right";
  gradient: string;
  label: string;
  onPress: () => void;
  hidden?: boolean;
  children: React.ReactNode;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [folded, setFolded] = useState(false);
  const drag = useRef<{ dx: number; dy: number; moved: boolean; id: number } | null>(null);
  const clamp = (x: number, y: number) => ({
    x: Math.min(Math.max(6, x), window.innerWidth - size - 6),
    y: Math.min(Math.max(60, y), window.innerHeight - size - 10),
  });

  useEffect(() => {
    const t = window.setTimeout(() => {
      let saved: { x: number; y: number } | null = null;
      try {
        saved = JSON.parse(read(`jw-bubble-pos:${id}`) ?? "null");
      } catch {
        saved = null;
      }
      const x = corner === "left" ? 12 : window.innerWidth - size - 12;
      const start = saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) ? saved : { x, y: window.innerHeight - size - 84 };
      setPos(clamp(start.x, start.y));
      setFolded(read(`jw-bubble-fold:${id}`) === "1");
    }, 0);
    const keep = () => setPos((p) => (p ? clamp(p.x, p.y) : p));
    window.addEventListener("resize", keep);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", keep);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, corner, size]);

  if (!pos || hidden) return null;

  const onDown = (e: React.PointerEvent) => {
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, moved: false, id: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const next = clamp(e.clientX - d.dx, e.clientY - d.dy);
    if (!d.moved && Math.hypot(next.x - pos.x, next.y - pos.y) < 6) return;
    d.moved = true;
    setPos(next);
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) write(`jw-bubble-pos:${id}`, JSON.stringify(pos));
    else onPress();
  };
  const fold = (v: boolean) => {
    setFolded(v);
    write(`jw-bubble-fold:${id}`, v ? "1" : "0");
  };
  const left = pos.x < window.innerWidth / 2;

  if (folded) {
    return (
      <button type="button" className={`mb-tab ${left ? "left" : "right"}`} style={{ top: pos.y, background: gradient }} onClick={() => fold(false)} aria-label={`أظهر ${label}`} title={label}>
        {children}
      </button>
    );
  }
  return (
    <div className="mb-wrap" style={{ left: pos.x, top: pos.y, width: size, height: size }}>
      <button
        type="button"
        className="mb-btn"
        style={{ background: gradient, width: size, height: size }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => (drag.current = null)}
        aria-label={label}
        title={`${label} — اسحبني لأي مكان`}
      >
        {children}
      </button>
      <button type="button" className="mb-fold" onClick={() => fold(true)} aria-label="صغّر على الجنب" title="صغّر على الجنب">
        –
      </button>
    </div>
  );
}
