"use client";

// «الرضا فويس» — the words: the poem or the script, written or pasted once, kept with the project, and read from a
// window that stays open over the tracks while recording (the size of the letters set for reading from a distance).

import { useEffect, useState } from "react";
import { useStudio } from "../ctx";

const KEY = "ridha.lyrics.size";

export default function LyricsPanel() {
  const { project, store } = useStudio();
  const [size, setSize] = useState(20);
  // the size chosen last time on this device
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const v = Number(localStorage.getItem(KEY));
        if (v >= 14 && v <= 44) setSize(v);
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, []);
  const grow = (d: number) => {
    const v = Math.max(14, Math.min(44, size + d));
    setSize(v);
    try {
      localStorage.setItem(KEY, String(v));
    } catch {}
  };
  const text = project.lyrics ?? "";
  const lines = text.split("\n").filter((l) => l.trim()).length;
  return (
    <div className="rv-lyrics" dir="rtl">
      <div className="rv-panel-head">
        <b>الكلمات</b>
        <span className="rv-muted">{lines ? `السطور: ${lines} · تُحفظ مع المشروع` : "تُحفظ مع المشروع"}</span>
        <span className="rv-grow" />
        <button type="button" className="rv-mini" onClick={() => grow(-2)} title="خط أصغر" aria-label="خط أصغر">A−</button>
        <button type="button" className="rv-mini" onClick={() => grow(2)} title="خط أكبر" aria-label="خط أكبر">A+</button>
      </div>
      <textarea value={text} style={{ fontSize: size }} placeholder="اكتب القصيدة أو النص هنا، أو الصقه… خلّ النافذة مفتوحة واقرأ منها وأنت تسجّل." onChange={(e) => store.set((p) => ({ ...p, lyrics: e.target.value }), { merge: "lyrics" })} aria-label="كلمات المشروع" />
    </div>
  );
}
