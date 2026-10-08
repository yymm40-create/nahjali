"use client";

import { useEffect, useRef, useState } from "react";

const KEY = "notes-pin-pos";
type Pos = { x: number; y: number };
const SIZE = { w: 170, h: 52 };
const clamp = (p: Pos): Pos => ({
  x: Math.min(Math.max(8, p.x), Math.max(8, window.innerWidth - SIZE.w - 8)),
  y: Math.min(Math.max(8, p.y), Math.max(8, window.innerHeight - SIZE.h - 8)),
});

/**
 * «الملاحظ حسن»'s floating button: a tap opens the note, a drag moves it anywhere on the screen (the spot is kept on
 * this device, and brought back inside the screen when it is resized).
 */
export default function NotesDrag({ onTap }: { onTap: () => void }) {
  const [pos, setPos] = useState<Pos | null>(null);
  const drag = useRef<{ dx: number; dy: number; sx: number; sy: number; moved: boolean } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      let saved: Pos | null = null;
      try {
        saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
      } catch {}
      setPos(clamp(saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) ? saved : { x: 16, y: window.innerHeight - SIZE.h - 16 }));
    }, 0);
    const onResize = () => setPos((p) => (p ? clamp(p) : p));
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  if (!pos) return null;
  return (
    <button
      type="button"
      title="الملاحظ حسن: اضغط تكتب ملاحظتك، واسحبه تغيّر مكانه"
      aria-label="الملاحظ حسن: حط ملاحظة"
      className="fixed z-[90] flex cursor-grab touch-none select-none items-center gap-2 rounded-full border-2 border-white/60 bg-amber-400 px-4 py-2.5 text-base font-extrabold text-slate-900 shadow-xl transition-transform active:scale-95 active:cursor-grabbing"
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, sx: e.clientX, sy: e.clientY, moved: false };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 6) return;
        d.moved = true;
        setPos(clamp({ x: e.clientX - d.dx, y: e.clientY - d.dy }));
      }}
      onPointerUp={() => {
        const d = drag.current;
        drag.current = null;
        if (!d) return;
        if (!d.moved) return onTap();
        setPos((p) => {
          try {
            if (p) localStorage.setItem(KEY, JSON.stringify(p));
          } catch {}
          return p;
        });
      }}
      onPointerCancel={() => (drag.current = null)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onTap())}
    >
      <span className="text-2xl" aria-hidden>📝</span> الملاحظ حسن
    </button>
  );
}
