"use client";

import { useEffect, useState } from "react";
import { inNativeApp, nativeSave } from "@/lib/native-app";

/**
 * Inside the phone app: the page is marked (what doesn't belong in a store app hides, see globals.css), and every
 * download link («نزّل»، an exported video, a booklet's PDF) opens the phone's save / share sheet instead.
 */
export default function NativeAppBridge() {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!inNativeApp()) return;
    document.documentElement.dataset.nativeApp = "1";
    const click = async (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[download]") as HTMLAnchorElement | null;
      if (!a?.href) return;
      e.preventDefault();
      e.stopPropagation();
      setBusy(true);
      try {
        const res = await fetch(a.href);
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        const name = a.getAttribute("download") || decodeURIComponent(new URL(a.href, location.href).pathname.split("/").pop() || "file");
        await nativeSave(blob, name);
      } catch (err) {
        // the person closing the share sheet is not an error
        if (!/cancel/i.test(String(err))) alert("ما قدرنا نحفظ الملف. جرّب مرة ثانية.");
      } finally {
        setBusy(false);
      }
    };
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  }, []);
  if (!busy) return null;
  return (
    <div role="status" className="fixed inset-x-0 bottom-6 z-[9999] mx-auto w-fit rounded-full bg-black/80 px-4 py-2 text-sm font-bold text-white">
      نجهّز الملف…
    </div>
  );
}
