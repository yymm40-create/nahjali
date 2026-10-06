"use client";

// A right-click menu (two fingers on a Mac trackpad): Premiere's clip menu — cut, copy, paste, paste attributes…
// Opens where it was asked, stays on the screen, closes on a choice, a click outside, Esc or a scroll.

import { useEffect, useLayoutEffect, useRef, useState } from "react";

export interface MenuItem {
  label: string;
  /** the keys that do the same (shown on the side) */
  keys?: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  /** a line before it */
  sep?: boolean;
  /** a submenu */
  items?: MenuItem[];
}

export default function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });
  const [sub, setSub] = useState<number | null>(null);
  useLayoutEffect(() => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ x: Math.max(8, Math.min(x, window.innerWidth - r.width - 8)), y: Math.max(8, Math.min(y, window.innerHeight - r.height - 8)) });
  }, [x, y]);
  useEffect(() => {
    const away = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("pointerdown", away, true);
    window.addEventListener("keydown", key, true);
    window.addEventListener("wheel", onClose, { passive: true });
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("pointerdown", away, true);
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("wheel", onClose);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  const row = (it: MenuItem, i: number, inSub = false) => (
    <div key={`${it.label}${i}`}>
      {it.sep && <div className="my-1 border-t border-jw-line" />}
      <button
        type="button"
        role="menuitem"
        disabled={it.disabled}
        className={`flex w-full items-center gap-3 rounded-md px-2.5 py-1.5 text-start text-xs disabled:opacity-40 ${it.danger ? "text-jw-danger hover:bg-jw-danger/10" : "hover:bg-jw-accent hover:text-jw-on-accent"}`}
        onPointerEnter={() => !inSub && setSub(it.items ? i : null)}
        onClick={() => {
          if (it.items) return setSub(sub === i ? null : i);
          it.onClick?.();
          onClose();
        }}
      >
        <span className="flex-1">{it.label}</span>
        {it.keys && (
          <span className="text-[10px] opacity-60" dir="ltr">
            {it.keys}
          </span>
        )}
        {it.items && <span aria-hidden>‹</span>}
      </button>
      {it.items && sub === i && (
        <div className="ms-3 border-s border-jw-line ps-1" role="menu">
          {it.items.map((s, k) => row(s, k, true))}
        </div>
      )}
    </div>
  );

  return (
    <div ref={ref} role="menu" dir="rtl" className="fixed z-[90] min-w-52 rounded-xl border border-jw-line bg-jw-surface p-1 shadow-2xl" style={{ left: pos.x, top: pos.y }} onContextMenu={(e) => e.preventDefault()}>
      {items.map((it, i) => row(it, i))}
    </div>
  );
}
