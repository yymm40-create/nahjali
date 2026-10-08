"use client";

import { useEffect, useState } from "react";

/** The build this page was loaded from (inlined when the site is built). */
export const PAGE_BUILD = process.env.NEXT_PUBLIC_BUILD ?? "dev";

/**
 * «🆕 في نسخة جديدة»: a page kept open for a long time (the editor, for hours) keeps running the code it was loaded
 * with, so fixes made since don't reach it. Every 2 minutes (and when the window comes back) it asks which build is
 * live, and offers to reload when it changed.
 */
export default function NewVersion() {
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    if (PAGE_BUILD === "dev") return;
    let live = true;
    const check = async () => {
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        const { build } = (await r.json()) as { build?: string };
        if (live && build && build !== "dev" && build !== PAGE_BUILD) setFresh(true);
      } catch {
        /* offline: next time */
      }
    };
    const t = setInterval(check, 120_000);
    const onFocus = () => document.visibilityState === "visible" && void check();
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      live = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, []);
  if (!fresh) return null;
  return (
    <div role="status" dir="rtl" style={{ position: "fixed", insetInline: 12, bottom: 12, zIndex: 9999, margin: "0 auto", maxWidth: 520, display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 14, background: "#0f2a4a", color: "#fff", boxShadow: "0 8px 30px rgba(0,0,0,.35)", fontSize: 14, fontWeight: 700 }}>
      <span style={{ flex: 1 }}>🆕 نزلت نسخة جديدة من الموقع — حدّث الصفحة عشان توصلك آخر التعديلات (شغلك محفوظ).</span>
      <button type="button" onClick={() => location.reload()} style={{ background: "#2fd3a6", color: "#06231b", border: 0, borderRadius: 10, padding: "6px 12px", fontWeight: 800, cursor: "pointer" }}>
        حدّث الحين
      </button>
      <button type="button" aria-label="لاحقًا" onClick={() => setFresh(false)} style={{ background: "transparent", color: "#cfe", border: 0, cursor: "pointer", fontSize: 16 }}>
        ✕
      </button>
    </div>
  );
}
