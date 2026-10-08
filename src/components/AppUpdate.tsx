"use client";

import { useEffect, useState } from "react";
import { DESKTOP_LATEST, MOBILE_LATEST, SITE_ADDRESS } from "@config/downloads";

/** a is newer than b ("1.2.2" > "1.2.1"; a missing part is 0) */
export const newer = (a: string, b: string) => {
  const x = a.split(".").map(Number);
  const y = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
};

/**
 * Which program this page runs in and whether it is older than the newest one: the desktop program says its version
 * (preload.js; the first ones, «حيدرة كت», say none), the phone app says it in its user agent («NahjAliApp/1.1»).
 * A browser is never told (the site itself is always the newest; NewVersion covers a page left open).
 */
export function outdatedApp(w: { haidaraDesktop?: { version?: string } }, ua: string): "desktop" | "phone" | null {
  if (w.haidaraDesktop) return newer(DESKTOP_LATEST, w.haidaraDesktop.version || "0") ? "desktop" : null;
  const m = /NahjAliApp\/([\d.]+)/.exec(ua);
  if (m) return newer(MOBILE_LATEST, m[1]) ? "phone" : null;
  return null;
}

const CLOSED = "app-update-closed";

/**
 * Inside an older copy of the desktop program or the phone app: a notice on entering, that a new version is out (on
 * the new address) with its download a click away. Closed, it stays away until the app is opened again; the newest
 * copy never sees it.
 */
export default function AppUpdate() {
  const [kind, setKind] = useState<"desktop" | "phone" | null>(null);
  useEffect(() => {
    let closed = false;
    try {
      closed = sessionStorage.getItem(CLOSED) === `${DESKTOP_LATEST}|${MOBILE_LATEST}`;
    } catch {
      /* none */
    }
    const t = setTimeout(() => setKind(closed ? null : outdatedApp(window as never, navigator.userAgent)), 0);
    return () => clearTimeout(t);
  }, []);
  if (!kind) return null;
  const close = () => {
    setKind(null);
    try {
      sessionStorage.setItem(CLOSED, `${DESKTOP_LATEST}|${MOBILE_LATEST}`);
    } catch {
      /* none */
    }
  };
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="app-update-title" dir="rtl" className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center text-slate-900 shadow-2xl">
        <div className="text-4xl">✨</div>
        <h2 id="app-update-title" className="mt-2 text-xl font-extrabold">
          نزلت نسخة جديدة من {kind === "desktop" ? "البرنامج" : "التطبيق"}
        </h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          الموقع صار على عنوانه الجديد <b dir="ltr">{SITE_ADDRESS}</b>، والنسخة اللي عندك قديمة وممكن تعلّق. حمّل النسخة الجديدة وركّبها فوق القديمة — حسابك وشغلك يظلون مثل ما هم.
        </p>
        <a href={`https://${SITE_ADDRESS}/download`} className="mt-5 block rounded-full bg-blue-700 px-4 py-3 font-bold text-white">
          حمّل النسخة الجديدة
        </a>
        <button type="button" onClick={close} className="mt-3 text-sm text-slate-500 underline">
          لاحقًا
        </button>
      </div>
    </div>
  );
}
