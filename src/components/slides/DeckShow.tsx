"use client";

// «▶️ اعرض»: the deck full screen, slide by slide, the way a presentation is given — ←/مسافة/الضغط للتالية، → للسابقة،
// N لملاحظات المحاضر، Esc للخروج. Arabic decks go right to left, so «التالية» is the left arrow (the right arrow too
// works backwards, like PowerPoint in Arabic).

import { useCallback, useEffect, useRef, useState } from "react";
import SlideFrame from "./SlideFrame";
import { DECK_SIZE, type Deck } from "@/lib/slides/format";

export default function DeckShow({ deck, images, fontCss, start = 0, onClose }: { deck: Deck; images: Record<string, string>; fontCss: string; start?: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const [notes, setNotes] = useState(false);
  const [size, setSize] = useState({ w: 1280, h: 720 });
  const box = useRef<HTMLDivElement>(null);
  const n = deck.slides.length;
  const next = useCallback(() => setI((x) => Math.min(n - 1, x + 1)), [n]);
  const prev = useCallback(() => setI((x) => Math.max(0, x - 1)), []);

  // the latest close, without starting the show again on every render
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    const el = box.current;
    // the keys come here even when the editor's slide had the focus
    (document.activeElement as HTMLElement | null)?.blur?.();
    el?.focus();
    el?.requestFullscreen?.().catch(() => {});
    const fit = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    fit();
    window.addEventListener("resize", fit);
    const key = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowDown", "PageDown", " ", "Enter"].includes(e.key)) {
        e.preventDefault();
        next();
      } else if (["ArrowRight", "ArrowUp", "PageUp", "Backspace"].includes(e.key)) {
        e.preventDefault();
        prev();
      }
      else if (e.key === "Home") setI(0);
      else if (e.key === "End") setI(n - 1);
      else if (e.key.toLowerCase() === "n") setNotes((v) => !v);
      else if (e.key === "Escape") close.current();
    };
    window.addEventListener("keydown", key);
    const left = () => {
      if (!document.fullscreenElement) close.current();
    };
    document.addEventListener("fullscreenchange", left);
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("keydown", key);
      document.removeEventListener("fullscreenchange", left);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [next, prev, n]);

  const { w, h } = DECK_SIZE[deck.aspect];
  const room = notes ? size.h - 160 : size.h;
  const width = Math.max(200, Math.min(size.w, (room * w) / h));
  const slide = deck.slides[i];
  return (
    <div ref={box} tabIndex={-1} className="fixed inset-0 outline-none z-[200] flex flex-col items-center justify-center bg-black text-white select-none" role="dialog" aria-label="عرض الشرائح">
      <button type="button" className="flex flex-1 items-center justify-center" onClick={next} aria-label="الشريحة التالية">
        {slide && <SlideFrame deck={deck} slide={slide} images={images} width={width} fontCss={fontCss} />}
      </button>
      {notes && <div className="h-40 w-full overflow-y-auto bg-neutral-900 p-4 text-lg leading-relaxed" dir="rtl">{slide?.notes || "ما فيه ملاحظات لهالشريحة."}</div>}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm opacity-60 transition-opacity hover:opacity-100" dir="rtl">
        <button type="button" onClick={prev} aria-label="السابقة" className="px-2">→</button>
        <span>{(i + 1).toLocaleString("ar")} / {n.toLocaleString("ar")}</span>
        <button type="button" onClick={next} aria-label="التالية" className="px-2">←</button>
        <button type="button" onClick={() => setNotes((v) => !v)} className="px-2">📝 الملاحظات</button>
        <button type="button" onClick={onClose} className="px-2">✕ خروج</button>
      </div>
    </div>
  );
}
