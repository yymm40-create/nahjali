"use client";

import { useSyncExternalStore } from "react";

const THEMES = [
  { key: "day", label: "النهار", icon: "☀️" },
  { key: "night", label: "ليل النجف", icon: "🌙" },
  { key: "dawn", label: "الفجر", icon: "🌅" },
] as const;
type Theme = (typeof THEMES)[number]["key"];

/** Runs before paint (in <head>) so the saved mood never flashes. */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("theme");if(!t)t=matchMedia("(prefers-color-scheme: dark)").matches?"night":"day";document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="day"}`;

// The current mood lives on <html data-theme>; components subscribe to changes.
const EVENT = "themechange";
const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
};
const getTheme = () => (document.documentElement.dataset.theme as Theme) ?? "day";

function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem("theme", t);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export default function ThemeSwitcher() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => null);

  return (
    <div role="radiogroup" aria-label="مود الموقع" className="flex rounded-full border border-line bg-surface p-1">
      {THEMES.map((t) => (
        <button
          key={t.key}
          role="radio"
          aria-checked={theme === t.key}
          aria-label={t.label}
          title={t.label}
          onClick={() => applyTheme(t.key)}
          className={`grid size-9 place-items-center rounded-full text-lg transition ${
            theme === t.key ? "bg-gold/25 ring-2 ring-gold" : "opacity-60 hover:opacity-100"
          }`}
        >
          {t.icon}
        </button>
      ))}
    </div>
  );
}
