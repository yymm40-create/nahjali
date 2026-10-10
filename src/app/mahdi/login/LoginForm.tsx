"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MAHDI_AUTH } from "@config/mahdi";
import { t } from "@/lib/mahdi/i18n";
import { createClient } from "@/lib/supabase/client";
import Turnstile, { turnstileOn } from "@/components/Turnstile";
import { AuthShell, OAuthButtons, OrLine, PasswordField, authMessage } from "@/components/mahdi/auth";

export default function LoginForm({ next, failed }: { next: string; failed: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(failed ? t.auth.loginFailed : "");
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [resent, setResent] = useState(false);
  // Cloudflare's check (when it is set up): a fresh token for every try
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (turnstileOn() && !captcha) {
      setError("انتظر علامة التحقق تحت (ثواني) ثم اضغط مرة ثانية.");
      return;
    }
    setBusy(true);
    setError("");
    const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password, ...(captcha ? { options: { captchaToken: captcha } } : {}) });
    if (turnstileOn()) setResetKey((k) => k + 1);
    if (error) {
      setError(authMessage(error));
      setUnconfirmed(error.code === "email_not_confirmed");
      setBusy(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <AuthShell
      title={t.auth.login}
      footer={
        <>
          {t.auth.noAccount} <Link href="/mahdi/signup" className="m-gold font-semibold">{t.auth.signup}</Link>
        </>
      }
    >
      <OAuthButtons next={next} />
      {MAHDI_AUTH.email && (
        <>
          <OrLine />
          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="m-label">{t.auth.email}</span>
              <input className="m-field" type="email" dir="ltr" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <PasswordField label={t.auth.password} value={password} onChange={setPassword} autoComplete="current-password" />
            <Turnstile onToken={setCaptcha} resetKey={resetKey} />
            {error && <p className="m-error" role="alert">{error}</p>}
            {unconfirmed && (
              <button
                type="button"
                className="m-btn m-btn-quiet m-btn-sm"
                disabled={resent}
                onClick={async () => {
                  await createClient().auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: `${location.origin}/auth/callback?next=/mahdi/welcome`, ...(captcha ? { captchaToken: captcha } : {}) } });
                  if (turnstileOn()) setResetKey((k) => k + 1);
                  setResent(true);
                }}
              >
                {resent ? t.auth.resent : t.auth.resend}
              </button>
            )}
            <button className="m-btn m-btn-primary w-full" disabled={busy}>
              {busy ? t.common.loading : t.auth.submitLogin}
            </button>
            <Link href="/mahdi/forgot" className="m-btn m-btn-quiet w-full">{t.auth.forgot}</Link>
          </form>
        </>
      )}
    </AuthShell>
  );
}
