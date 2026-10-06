"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Every tap shows: a link to another page starts a bar across the top (and «يحمّل…») until the new page is there,
 * so a press never looks like nothing happened. The press itself is drawn in globals.css (buttons and links sink).
 */
export default function NavFeedback() {
  const [on, setOn] = useState(false);
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const finish = () => {
      if (timer.current) clearTimeout(timer.current);
      setDone(true);
      timer.current = setTimeout(() => {
        setOn(false);
        setDone(false);
      }, 260);
    };
    const start = () => {
      if (timer.current) clearTimeout(timer.current);
      setDone(false);
      setOn(true);
      // never stuck: a page that doesn't come back in time lets the bar go
      timer.current = setTimeout(finish, 12_000);
    };
    const click = (e: MouseEvent) => {
      // (caught on the way down: Next.js's own links cancel the click's default to move the page themselves)
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download") || a.getAttribute("role") === "button" || a.getAttribute("href")?.startsWith("#")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      // the same page (or only a place on it) moves nowhere
      if (url.pathname === location.pathname && url.search === location.search) return;
      start();
    };
    // the new page is in when the address changes (Next.js moves it then); a form sent or a page left starts it too
    const push = history.pushState.bind(history);
    const replace = history.replaceState.bind(history);
    history.pushState = (...args: Parameters<History["pushState"]>) => {
      push(...args);
      finish();
    };
    history.replaceState = (...args: Parameters<History["replaceState"]>) => {
      const before = location.pathname + location.search;
      replace(...args);
      if (location.pathname + location.search !== before) finish();
    };
    const submit = (e: SubmitEvent) => {
      const f = e.target as HTMLFormElement;
      if (!e.defaultPrevented && f.method !== "dialog" && !f.target) start();
    };
    window.addEventListener("click", click, true);
    window.addEventListener("submit", submit);
    window.addEventListener("popstate", finish);
    window.addEventListener("pageshow", finish);
    return () => {
      window.removeEventListener("click", click, true);
      window.removeEventListener("submit", submit);
      window.removeEventListener("popstate", finish);
      window.removeEventListener("pageshow", finish);
      history.pushState = push;
      history.replaceState = replace;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (!on) return null;
  return (
    <div className="nav-feedback" data-done={done || undefined} role="status" aria-live="polite">
      <div className="nav-feedback-bar" />
      <span className="nav-feedback-pill">
        <span className="nav-feedback-dot" aria-hidden />
        يحمّل…
      </span>
    </div>
  );
}
