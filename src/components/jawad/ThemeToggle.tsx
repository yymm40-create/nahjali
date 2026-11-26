"use client";

import { useEffect, useState } from "react";

const KEY = "jw-theme";
const LIGHT_BAR = "#eef3ff";
const DARK_BAR = "#05070f";

/** The browser bar follows the base the page is actually drawn on (a page not yet ready for light stays black). */
function paintBar() {
  const root = document.querySelector<HTMLElement>(".jw");
  const light = root?.dataset.jwTheme === "light" && Boolean(root.querySelector(".jw-light-ok"));
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", light ? LIGHT_BAR : DARK_BAR));
}

/**
 * «الخلفية»: فاتحة (the default) or سوداء — the same «كوبالت» identity on either base (the owner, 26 November 2026).
 * Remembered on this device; applied before paint by the layout's inline script (`data-jw-theme` on the JAWAD root).
 * Pages move to the light base one by one (`.jw-light-ok`), so on a page that is not ready yet the black base stays.
 */
export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      setDark(document.querySelector<HTMLElement>(".jw")?.dataset.jwTheme === "dark");
      paintBar();
    }, 0);
    return () => clearTimeout(t);
  }, []);
  const toggle = () => {
    const v = !dark;
    setDark(v);
    try {
      localStorage.setItem(KEY, v ? "dark" : "light");
    } catch {}
    const root = document.querySelector<HTMLElement>(".jw");
    if (root) root.dataset.jwTheme = v ? "dark" : "light";
    paintBar();
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      className="grid size-7 shrink-0 place-items-center rounded-full text-jw-muted transition hover:bg-jw-accent-soft hover:text-jw-ink md:flex md:h-9 md:w-auto md:gap-1.5 md:px-2.5 md:text-xs"
      title={dark ? "الخلفية سوداء: اضغط للفاتحة" : "الخلفية فاتحة: اضغط للسوداء"}
      aria-label={dark ? "الخلفية: سوداء" : "الخلفية: فاتحة"}
    >
      {dark ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
        </svg>
      )}
      <span className="hidden md:inline">{dark ? "سوداء" : "فاتحة"}</span>
    </button>
  );
}
