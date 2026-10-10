"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MAHDI_AUTH } from "@config/mahdi";
import { t } from "@/lib/mahdi/i18n";
import { createClient } from "@/lib/supabase/client";
import Turnstile, { turnstileOn } from "@/components/Turnstile";
import { AuthShell, OAuthButtons, OrLine, PasswordField, authMessage } from "@/components/mahdi/auth";

export default function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Cloudflare's check (when it is set up): a fresh token for every try
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [sentTo, setSentTo] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError(t.auth.e.weak);
    if (password !== confirm) return setError(t.auth.e.mismatch);
    if (turnstileOn() && !captcha) return setError("انتظر علامة التحقق (ثواني) ثم اضغط مرة ثانية.");
    setBusy(true);
    setError("");
    const { data, error } = await createClient().auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${location.origin}/auth/callback?next=/mahdi/welcome`, ...(captcha ? { captchaToken: captcha } : {}) },
    });
    if (turnstileOn()) setResetKey((k) => k + 1);
    if (error) {
      setError(authMessage(error));
      setBusy(false);
      return;
    }
    // Supabase answers without an identity when the email is already registered
    if (data.user && data.user.identities?.length === 0) {
      setError(t.auth.e.exists);
      setBusy(false);
      return;
    }
    if (data.session) {
      router.replace("/mahdi/welcome");
      router.refresh();
    } else setSentTo(email.trim());
  }

  return (
    <AuthShell
      title={t.auth.signup}
      footer={
        <>
          {t.auth.haveAccount} <Link href="/mahdi/login" className="m-gold font-semibold">{t.auth.login}</Link>
        </>
      }
    >
      {sentTo ? (
        <p className="m-note" role="status">{t.auth.checkEmail(sentTo)}</p>
      ) : (
        <>
          <OAuthButtons next="/mahdi" />
          {MAHDI_AUTH.email && (
            <>
              <OrLine />
              <form onSubmit={submit} className="space-y-4">
                <label className="block">
                  <span className="m-label">{t.auth.email}</span>
                  <input className="m-field" type="email" dir="ltr" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </label>
                <PasswordField label={t.auth.password} hint={t.auth.passwordHint} value={password} onChange={setPassword} autoComplete="new-password" />
                <PasswordField label={t.auth.confirmPassword} value={confirm} onChange={setConfirm} autoComplete="new-password" />
                <Turnstile onToken={setCaptcha} resetKey={resetKey} />
                {error && <p className="m-error" role="alert">{error}</p>}
                <button className="m-btn m-btn-primary w-full" disabled={busy}>
                  {busy ? t.common.loading : t.auth.submitSignup}
                </button>
              </form>
            </>
          )}
        </>
      )}
    </AuthShell>
  );
}
