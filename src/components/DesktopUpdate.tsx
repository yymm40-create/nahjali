"use client";

import { useEffect, useState } from "react";
import { DESKTOP_LATEST } from "@config/downloads";

const newer = (a: string, b: string) => {
  const x = a.split(".").map(Number);
  const y = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
};

/**
 * Inside the desktop program: an older copy (the first ones were «حيدرة كت» and don't say their version) is told a new
 * one is out, with the download a click away. Hidden for this run once closed.
 */
export default function DesktopUpdate() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const d = (window as unknown as { haidaraDesktop?: { version?: string } }).haidaraDesktop;
    if (!d) return;
    let closed = false;
    try {
      closed = sessionStorage.getItem("desktop-update-closed") === DESKTOP_LATEST;
    } catch {
      /* none */
    }
    const t = setTimeout(() => setShow(!closed && newer(DESKTOP_LATEST, d.version || "0")), 0);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-[9998] flex flex-wrap items-center justify-center gap-3 bg-blue-700 px-4 py-2 text-sm font-bold text-white shadow-lg" dir="rtl">
      <span>✨ نسخة جديدة من البرنامج: «الجواد AI» بواجهة جديدة وتحسينات.</span>
      <a href="/download" className="rounded-full bg-white px-3 py-1 text-blue-700">
        حمّل التحديث
      </a>
      <button
        type="button"
        className="opacity-80 hover:opacity-100"
        aria-label="إغلاق"
        onClick={() => {
          setShow(false);
          try {
            sessionStorage.setItem("desktop-update-closed", DESKTOP_LATEST);
          } catch {
            /* none */
          }
        }}
      >
        ✕
      </button>
    </div>
  );
}
