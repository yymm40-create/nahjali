"use client";

import { useEffect, useRef, useState } from "react";

export default function LoginButton({ next }: { next: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Coming back to this page (the browser's back button) shows the button ready again
  useEffect(() => {
    const reset = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      clearTimeout(timer.current);
      setLoading(false);
    };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  // The server starts the sign-in and sends the browser to Google: a plain link, nothing in the page can hang
  // (the browser-side sign-in call sometimes waited forever and the button stayed on «جاري التحويل…»)
  const href = `/auth/google?next=${encodeURIComponent(next)}`;
  function signIn() {
    setLoading(true);
    setError("");
    // If the page is still here after a while (no connection), let the person try again
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setLoading(false);
      setError("ما انفتحت صفحة جوجل. تأكد من الإنترنت وجرّب مرة ثانية.");
    }, 15_000);
  }

  return (
    <div className="space-y-3">
      <a href={href} className="btn btn-ghost w-full" onClick={signIn} aria-disabled={loading}>
        <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden>
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
        {loading ? "جاري التحويل…" : "الدخول بحساب جوجل"}
      </a>
      {error && <p className="error-box">{error}</p>}
    </div>
  );
}
