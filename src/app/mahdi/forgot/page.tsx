"use client";

import Link from "next/link";
import { useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import { createClient } from "@/lib/supabase/client";
import { AuthShell, authMessage } from "@/components/mahdi/auth";

/** Sends a reset link. The answer is the same whether or not the email is registered. */
export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${location.origin}/auth/callback?next=/mahdi/reset`,
    });
    setBusy(false);
    // Rate limits and broken delivery are shown; "no such user" is never revealed
    if (error && (error.status === 429 || error.code === "email_address_not_authorized")) return setError(authMessage(error));
    setSent(true);
  }

  return (
    <AuthShell title={t.auth.forgotTitle} footer={<Link href="/mahdi/login" className="m-gold font-semibold">{t.auth.login}</Link>}>
      {sent ? (
        <p className="m-note" role="status">{t.auth.forgotSent}</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="m-muted">{t.auth.forgotBody}</p>
          <label className="block">
            <span className="m-label">{t.auth.email}</span>
            <input className="m-field" type="email" dir="ltr" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          {error && <p className="m-error" role="alert">{error}</p>}
          <button className="m-btn m-btn-primary w-full" disabled={busy}>
            {busy ? t.common.loading : t.auth.forgotSubmit}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
