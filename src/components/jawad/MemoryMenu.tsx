"use client";

// «🧠 ذاكرتي» at the top of JAWAD AI: the memory the robots keep about the person — on for this conversation or off
// («محادثة بدون ذاكرة»: nothing read, nothing learned, until turned back on in this tab), and the way to «ذاكرتي»
// (see it, edit it, clear it, turn it off for good). The off switch rides on every request of this tab as a header.

import Link from "next/link";
import { useEffect, useState } from "react";
import { JAWAD } from "@config/jawad/brand";

const KEY = "jw-memory-off";
const HEADER = "x-jw-memory";
const readOff = () => {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

export default function MemoryMenu() {
  const [off, setOff] = useState(readOff);
  const [open, setOpen] = useState(false);

  // every request of this tab to the site's API carries the switch (read at the moment it is sent)
  useEffect(() => {
    const orig = window.fetch;
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      if (!readOff()) return orig(input, init);
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const same = url.startsWith("/") || url.startsWith(location.origin);
      if (!same || !url.replace(location.origin, "").startsWith("/api/")) return orig(input, init);
      const h = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      h.set(HEADER, "off");
      return orig(input, { ...init, headers: h });
    };
    return () => {
      window.fetch = orig;
    };
  }, []);

  const toggle = () => {
    const next = !off;
    try {
      if (next) sessionStorage.setItem(KEY, "1");
      else sessionStorage.removeItem(KEY);
    } catch { /* fine */ }
    setOff(next);
  };

  return (
    <div className="relative">
      <button type="button" suppressHydrationWarning className="jw-btn h-9 min-h-9 px-2.5" aria-label="ذاكرتي" title={off ? "الذاكرة طافية لهذي المحادثة" : "الذاكرة شغّالة"} onClick={() => setOpen((o) => !o)}>
        {off ? "🧠🚫" : "🧠"}
      </button>
      {open && (
        <div className="jw-panel absolute end-0 top-11 z-[80] w-72 space-y-2 p-3 text-sm" dir="rtl">
          <b>🧠 ذاكرتي</b>
          <p className="text-xs text-jw-muted">الروبوتات تتذكرك: مشاريعك، أفكارك، أسلوبك، عشان تفهمك بدون ما تعيد.</p>
          <button type="button" className={`jw-btn w-full ${off ? "jw-btn-primary" : ""}`} onClick={toggle}>
            {off ? "✅ شغّل الذاكرة لهذي المحادثة" : "🚫 محادثة بدون ذاكرة"}
          </button>
          <p className="text-[11px] text-jw-muted">{off ? "طافية في هذي النافذة: ما تُقرأ ولا تتعلّم لين ترجعها." : "تقدر تطفيها لهذي المحادثة بس، أو تطفيها كليًا من «ذاكرتي»."}</p>
          <Link href={`${JAWAD.base}/memory`} className="jw-btn jw-btn-quiet w-full" onClick={() => setOpen(false)}>افتح «ذاكرتي»</Link>
        </div>
      )}
    </div>
  );
}
