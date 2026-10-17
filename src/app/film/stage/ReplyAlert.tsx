"use client";

// «🔔 وصل رد جديد»: when a reply the scene was waiting for arrives (the screenwriter, the sheet maker, the director…) or
// a video is ready, the person hears a soft chime, the tab's title says so, and a card at the bottom takes them to it.
// Away from the page (another tab, the phone locked), a notification of the device does the same — once they allowed
// it with «🔔 نبّهني».

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Progress, Running } from "@/lib/film/progress-math";

export interface Arrival {
  text: string;
  href: string | null;
}

const MUTE_KEY = "fs-bell-asked";

/** A soft two-note chime (no file to load). */
function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [660, 880].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.16;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.5);
    });
    setTimeout(() => void ctx.close(), 1200);
  } catch {}
}

/** What just finished, as one line: «وصل رد جديد من المخرج — ينتظر ردّك». */
export function arrivalOf(gone: Running[], next: Progress, stepHref: (key: string) => string | null): Arrival | null {
  const done = gone.filter((r) => r.kind === "reply" || r.kind === "video" || r.kind === "impact");
  if (!done.length) return null;
  const first = done[0];
  const ask = next.asking[0];
  const text =
    first.kind === "video"
      ? done.length > 1
        ? `🎬 جهزت ${done.length.toLocaleString("ar")} فيديوهات`
        : `🎬 جهز ${first.label}`
      : ask
        ? `🔔 وصل رد جديد من ${first.label} — ينتظر ردّك`
        : `🔔 ${first.label} خلّص`;
  return { text, href: ask ? stepHref(ask) : null };
}

export function useArrivals(progress: Progress, stepHref: (key: string) => string | null) {
  const prev = useRef<Running[]>(progress.running);
  const [arrival, setArrival] = useState<Arrival | null>(null);
  useEffect(() => {
    const gone = prev.current.filter((r) => !progress.running.some((x) => x.key === r.key));
    prev.current = progress.running;
    const a = arrivalOf(gone, progress, stepHref);
    if (!a) return;
    setArrival(a);
    chime();
    navigator.vibrate?.(120);
    if (document.hidden) {
      const title = document.title.replace(/^🔔 /, "");
      document.title = `🔔 ${title}`;
      const back = () => {
        if (document.hidden) return;
        document.title = title;
        document.removeEventListener("visibilitychange", back);
      };
      document.addEventListener("visibilitychange", back);
      if ("Notification" in window && Notification.permission === "granted") {
        try {
          new Notification("JAWAD AI · صناعة الفيلم", { body: a.text.replace(/^\S+ /, ""), icon: "/jawad-ai/logo.png", tag: "film-reply" });
        } catch {}
      }
    }
  }, [progress, stepHref]);
  const close = useCallback(() => setArrival(null), []);
  return [arrival, close] as const;
}

/** The card at the bottom: what arrived, «اعرضه», and it leaves by itself after a while. */
export function ArrivalCard({ arrival, here, onClose }: { arrival: Arrival; here: boolean; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 15000);
    return () => clearTimeout(t);
  }, [arrival, onClose]);
  const show = () => {
    document.querySelector("[data-reply-now]")?.scrollIntoView({ behavior: "smooth", block: "start" });
    onClose();
  };
  return (
    <div className="fs-alert" role="status" aria-live="polite">
      <span className="flex-1">{arrival.text}</span>
      {arrival.href && !here ? (
        <Link href={arrival.href} className="go" onClick={onClose}>اعرضه</Link>
      ) : (
        <button type="button" className="go" onClick={show}>اعرضه</button>
      )}
      <button type="button" className="x" onClick={onClose} aria-label="سكّر">✕</button>
    </div>
  );
}

/** «🔔 نبّهني لو طلعت من الصفحة»: asks the device's permission once, while something is being made. */
export function BellAsk() {
  const [state, setState] = useState<"hidden" | "ask">("hidden");
  useEffect(() => {
    let asked = false;
    try {
      asked = localStorage.getItem(MUTE_KEY) === "1";
    } catch {}
    const t = setTimeout(() => {
      if (!asked && "Notification" in window && Notification.permission === "default") setState("ask");
    }, 0);
    return () => clearTimeout(t);
  }, []);
  if (state !== "ask") return null;
  const done = () => {
    try {
      localStorage.setItem(MUTE_KEY, "1");
    } catch {}
    setState("hidden");
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="fs-bell" onClick={() => void Notification.requestPermission().finally(done)}>🔔 نبّهني لو طلعت من الصفحة ووصل الرد</button>
      <button type="button" className="text-xs font-bold text-muted underline" onClick={done}>لا شكرًا</button>
    </div>
  );
}
