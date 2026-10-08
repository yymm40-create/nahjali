"use client";

import { useEffect, useState } from "react";
import { FILM_WHY } from "@config/film-why";
import { openSajjad } from "./SajjadPanel";

const KEY = (k: string) => `film:why-hidden:${k}`;

/**
 * «ليش هالخطوة؟» — a small explainer under a step: why it exists, what it gives, what to do here, what comes next.
 * Open the first time, a one-line bar once the person says «فهمت» (per browser, per step); «اسأل سجاد» opens him
 * with the question when he is on the page.
 */
export default function StepWhy({ step, sajjad = true }: { step: string; sajjad?: boolean }) {
  const w = FILM_WHY[step];
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let hidden = false;
    try {
      hidden = localStorage.getItem(KEY(step)) === "1";
    } catch {}
    const t = setTimeout(() => {
      setOpen(!hidden);
      setReady(true);
    }, 0);
    return () => clearTimeout(t);
  }, [step]);
  if (!w || !ready) return null;
  const remember = (v: boolean) => {
    setOpen(v);
    try {
      localStorage.setItem(KEY(step), v ? "0" : "1");
    } catch {}
  };
  if (!open) {
    return (
      <button type="button" className="flex w-full items-center gap-2 rounded-2xl bg-white/60 px-3 py-2 text-start text-xs font-extrabold text-muted hover:bg-white" onClick={() => remember(true)}>
        <span aria-hidden>💡</span> ليش خطوة «{w.title}»؟ وش فايدتها؟
      </button>
    );
  }
  return (
    <aside className="space-y-2 rounded-2xl border border-[#e2a72c]/50 bg-white/80 p-3 text-sm leading-7" aria-label={`ليش خطوة ${w.title}`}>
      <p className="font-black">💡 ليش خطوة «{w.title}»؟</p>
      <p><b>ليش:</b> {w.why}</p>
      <p><b>وش تطلّع:</b> {w.gives}</p>
      <p><b>وش تسوي هنا:</b> {w.doHere}</p>
      <p className="text-muted"><b>بعدها:</b> {w.next}</p>
      <div className="flex flex-wrap gap-2 pt-1">
        <button type="button" className="btn btn-ghost min-h-8 px-3 text-xs" onClick={() => remember(false)}>فهمت ✓</button>
        {sajjad && (
          <button type="button" className="btn btn-secondary min-h-8 px-3 text-xs" onClick={() => openSajjad(`اشرح لي خطوة «${w.title}» أكثر: ليش موجودة، وش فايدتها لشغلي الحالي بالذات، ووش الأفضل أسوي فيها الحين؟`)}>
            🧑‍🏫 اسأل سجاد عنها
          </button>
        )}
      </div>
    </aside>
  );
}
