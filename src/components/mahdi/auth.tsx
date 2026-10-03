"use client";

import Link from "next/link";
import { useState } from "react";
import { MAHDI_AUTH } from "@config/mahdi";
import { t } from "@/lib/mahdi/i18n";
import { createClient } from "@/lib/supabase/client";
import Icon from "./Icon";

/** Centred card for sign-in pages, over the shrine backdrop. */
export function AuthShell({ title, children, footer }: { title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <main id="m-main" className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <Link href="/mahdi/start" className="m-display m-gold m-shadow-text text-center text-4xl">
        {t.brand}
      </Link>
      <section className="m-card space-y-5 p-6">
        <h1 className="text-xl font-semibold">{title}</h1>
        {children}
      </section>
      {footer && <div className="m-shadow-text text-center text-sm">{footer}</div>}
    </main>
  );
}

/** Supabase auth errors → clear Arabic. */
export function authMessage(err: { code?: string; message?: string; status?: number } | null): string {
  if (!err) return t.errors.generic;
  const code = err.code ?? "";
  const msg = (err.message ?? "").toLowerCase();
  if (code === "invalid_credentials" || msg.includes("invalid login")) return t.auth.e.invalid;
  if (code === "email_not_confirmed" || msg.includes("not confirmed")) return t.auth.e.notConfirmed;
  if (code === "user_already_exists" || msg.includes("already registered")) return t.auth.e.exists;
  if (code === "weak_password" || msg.includes("password should")) return t.auth.e.weak;
  if (code === "email_address_invalid" || msg.includes("invalid email")) return t.auth.e.badEmail;
  if (code === "email_address_not_authorized" || msg.includes("not authorized")) return t.auth.e.emailNotAuthorized;
  if (code.includes("rate_limit") || err.status === 429) return t.errors.rateLimited;
  if (msg.includes("fetch")) return t.errors.network;
  return t.errors.generic;
}

/** Google (and later Apple) buttons. They come back through /auth/callback, then to `next`. */
export function OAuthButtons({ next }: { next: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const go = async (provider: "google" | "apple") => {
    setBusy(provider);
    setError("");
    const { error } = await createClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setError(t.auth.loginFailed);
      setBusy(null);
    }
  };
  return (
    <div className="space-y-2">
      {MAHDI_AUTH.google && (
        <button type="button" className="m-btn m-btn-ghost w-full" onClick={() => go("google")} disabled={busy !== null}>
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
            <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
          </svg>
          {busy === "google" ? t.auth.redirecting : t.auth.google}
        </button>
      )}
      {MAHDI_AUTH.apple && (
        <button type="button" className="m-btn m-btn-ghost w-full" onClick={() => go("apple")} disabled={busy !== null}>
          {busy === "apple" ? t.auth.redirecting : t.auth.apple}
        </button>
      )}
      {error && <p className="m-error" role="alert">{error}</p>}
    </div>
  );
}

export function OrLine() {
  return (
    <div className="flex items-center gap-3 text-sm m-muted" aria-hidden="true">
      <span className="h-px flex-1" style={{ background: "var(--m-line)" }} />
      {t.auth.or}
      <span className="h-px flex-1" style={{ background: "var(--m-line)" }} />
    </div>
  );
}

export function PasswordField({ value, onChange, label, autoComplete, hint }: { value: string; onChange: (v: string) => void; label: string; autoComplete: string; hint?: string }) {
  const [show, setShow] = useState(false);
  return (
    <label className="block">
      <span className="m-label">{label}</span>
      <span className="relative block">
        <input className="m-field pe-12" type={show ? "text" : "password"} dir="ltr" value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required minLength={autoComplete === "new-password" ? 8 : undefined} />
        <button type="button" className="m-icon-btn absolute end-1 top-1/2 -translate-y-1/2" onClick={() => setShow((s) => !s)} aria-label={show ? t.auth.hidePassword : t.auth.showPassword}>
          <Icon name={show ? "eyeOff" : "eye"} size={20} />
        </button>
      </span>
      {hint && <span className="m-hint mt-1 block">{hint}</span>}
    </label>
  );
}

