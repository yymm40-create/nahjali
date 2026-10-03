"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import { createClient } from "@/lib/supabase/client";
import { AuthShell, PasswordField, authMessage } from "@/components/mahdi/auth";

export default function ResetForm({ hasSession }: { hasSession: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (!hasSession) {
    return (
      <AuthShell title={t.auth.resetTitle}>
        <p className="m-error">{t.auth.resetNoSession}</p>
        <Link href="/mahdi/forgot" className="m-btn m-btn-primary w-full">{t.auth.forgotSubmit}</Link>
      </AuthShell>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError(t.auth.e.weak);
    if (password !== confirm) return setError(t.auth.e.mismatch);
    setBusy(true);
    setError("");
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(authMessage(error));
    setDone(true);
    setTimeout(() => {
      router.replace("/mahdi");
      router.refresh();
    }, 1200);
  }

  return (
    <AuthShell title={t.auth.resetTitle}>
      {done ? (
        <p className="m-note" role="status">{t.auth.resetDone}</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <PasswordField label={t.auth.password} hint={t.auth.passwordHint} value={password} onChange={setPassword} autoComplete="new-password" />
          <PasswordField label={t.auth.confirmPassword} value={confirm} onChange={setConfirm} autoComplete="new-password" />
          {error && <p className="m-error" role="alert">{error}</p>}
          <button className="m-btn m-btn-primary w-full" disabled={busy}>
            {busy ? t.common.saving : t.auth.resetSubmit}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
