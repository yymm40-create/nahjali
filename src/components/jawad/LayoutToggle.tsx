"use client";

import { useEffect, useState } from "react";

const KEY = "jw-layout";

/**
 * On a computer: «🖥️ عرض الديسكتوب» uses the whole width of the screen (the pages' centred columns open up) or
 * «📱 عرض الجوال» keeps everything in a phone-wide column in the middle. Remembered on this device; applied before
 * paint by the layout's inline script (the class `jw-wide` on the JAWAD root, see jawad.css).
 */
export default function LayoutToggle() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        setWide(localStorage.getItem(KEY) === "wide");
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, []);
  const toggle = () => {
    const v = !wide;
    setWide(v);
    try {
      localStorage.setItem(KEY, v ? "wide" : "phone");
    } catch {}
    document.querySelector(".jw")?.classList.toggle("jw-wide", v);
  };
  // the wrapper hides it on phones: `.jw-btn` sets its own display, which would win over a `hidden` on the button
  return (
    <span className="hidden lg:contents">
      <button type="button" onClick={toggle} aria-pressed={wide} className="jw-btn jw-btn-quiet h-9 min-h-9 gap-1.5 px-2.5 text-xs" title={wide ? "ارجع لعرض الجوال (عمود في النص)" : "استغل عرض الشاشة كله"}>
        <span aria-hidden>{wide ? "🖥️" : "📱"}</span>
        <span>{wide ? "عرض الديسكتوب" : "عرض الجوال"}</span>
      </button>
    </span>
  );
}
