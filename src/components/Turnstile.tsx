"use client";

// Cloudflare Turnstile — the quiet «are you human?» check before an email sign-in, so bots can't open accounts or send
// sign-in mails by the thousand. It shows only when the site key is set in Vercel (NEXT_PUBLIC_TURNSTILE_SITE_KEY);
// the secret key lives in Supabase (Authentication → Bot and abuse protection), which checks the token it gets.
// A token is good for one sign-in: after each try the widget is reset for a fresh one.

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, o: { sitekey: string; callback: (t: string) => void; "expired-callback"?: () => void; "error-callback"?: () => void; language?: string; theme?: "auto" | "light" | "dark" }) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
export const turnstileOn = () => !!TURNSTILE_SITE_KEY;

const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<void> | null = null;
function load(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.onload = () => res();
    s.onerror = () => {
      loading = null;
      rej(new Error("turnstile"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** The widget. `onToken(null)` when the token expires or the check fails; `resetKey` changing asks for a fresh token. */
export default function Turnstile({ onToken, resetKey = 0 }: { onToken: (t: string | null) => void; resetKey?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const id = useRef<string | null>(null);
  const cb = useRef(onToken);
  useEffect(() => {
    cb.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !box.current) return;
    let live = true;
    load()
      .then(() => {
        if (!live || !box.current || !window.turnstile || id.current) return;
        id.current = window.turnstile.render(box.current, {
          sitekey: TURNSTILE_SITE_KEY,
          language: "ar",
          theme: "auto",
          callback: (t) => cb.current(t),
          "expired-callback": () => cb.current(null),
          "error-callback": () => cb.current(null),
        });
      })
      .catch(() => cb.current(null));
    return () => {
      live = false;
      if (id.current) window.turnstile?.remove(id.current);
      id.current = null;
    };
  }, []);

  useEffect(() => {
    if (resetKey && id.current) {
      window.turnstile?.reset(id.current);
      cb.current(null);
    }
  }, [resetKey]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={box} className="flex min-h-[65px] justify-center" />;
}
