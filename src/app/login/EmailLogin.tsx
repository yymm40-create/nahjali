"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Turnstile, { turnstileOn } from "@/components/Turnstile";

/**
 * TEMPORARY: email magic-link sign-in for testing until Google sign-in is configured.
 * Shown only when EMAIL_LOGIN_ENABLED in config/pricing.ts is true.
 */
export default function EmailLogin({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  // Cloudflare's check (when it is set up): a fresh token for every try
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (turnstileOn() && !captcha) {
      setError("انتظر علامة التحقق تحت (ثواني) ثم اضغط مرة ثانية.");
      return;
    }
    setState("sending");
    setError("");
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`, ...(captcha ? { captchaToken: captcha } : {}) },
    });
    // the token is used: a fresh one for the next try
    if (turnstileOn()) setResetKey((k) => k + 1);
    if (error) {
      console.error("signInWithOtp failed", error.status, error.code, error.message);
      if (process.env.NODE_ENV !== "production") {
        // Dev only: show the technical reason so setup problems are easy to spot
        setError(`ما قدرنا نرسل الرابط. (${error.status ?? ""} ${error.code ?? ""}: ${error.message})`);
        setState("idle");
        return;
      }
      setError(
        error.status === 429 ? "أرسلنا رسائل كثيرة. انتظر شوي وجرّب مرة ثانية." : "ما قدرنا نرسل الرابط. تأكد من الإيميل وجرّب مرة ثانية.",
      );
      setState("idle");
    } else {
      setState("sent");
    }
  }

  if (state === "sent") {
    return (
      <p className="rounded-2xl bg-surface-2 p-4 font-bold">
        أرسلنا رابط الدخول إلى {email}. افتح الإيميل من نفس هذا المتصفح واضغط الرابط. (شيّك على البريد المزعج إذا ما لقيته)
      </p>
    );
  }

  return (
    <form onSubmit={send} className="space-y-3">
      <input
        type="email"
        required
        dir="ltr"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="field"
      />
      <Turnstile onToken={setCaptcha} resetKey={resetKey} />
      <button className="btn btn-secondary w-full" disabled={state === "sending"}>
        {state === "sending" ? "نرسل…" : "أرسل لي رابط الدخول"}
      </button>
      {error && <p className="error-box">{error}</p>}
    </form>
  );
}
