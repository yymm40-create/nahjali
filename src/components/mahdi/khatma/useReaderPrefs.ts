"use client";

// The Quran reader's own settings, kept on the device: the letter size (rem) and the reading surface («النهار» /
// «قراءة الليل»). Shared by every reader screen, and told to the other tabs too.

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { readSize, readSurface, type ReadSurface } from "@/lib/mahdi/khatma/reader";

const SIZE_KEY = "mahdi-quran-rem";
/** the old reader's five steps (0–4), carried over once */
const OLD_SIZE_KEY = "mahdi-quran-size";
const SURFACE_KEY = "mahdi-quran-surface";
const EVENT = "mahdi-quran-prefs";

const get = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const set = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
};
const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};

export function useReaderPrefs() {
  const size = useSyncExternalStore(subscribe, () => readSize(get(SIZE_KEY), get(OLD_SIZE_KEY)), () => readSize(null, null));
  const surface = useSyncExternalStore(subscribe, () => readSurface(get(SURFACE_KEY)), () => "day" as ReadSurface);
  const setSize = useCallback((rem: number) => set(SIZE_KEY, String(rem)), []);
  const setSurface = useCallback((s: ReadSurface) => set(SURFACE_KEY, s), []);
  return { size, setSize, surface, setSurface };
}

/**
 * While a reader is open: the root says so (data-mreading = the surface), and the CSS takes the tab bar and the backdrop
 * away and lays the solid reading surface under the page.
 */
export function useReadingMode(surface: ReadSurface) {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".mahdi-root:not(.m-sample)");
    if (!root) return;
    root.setAttribute("data-mreading", surface);
    return () => root.removeAttribute("data-mreading");
  }, [surface]);
}
