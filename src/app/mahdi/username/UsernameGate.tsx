"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cleanUsername } from "@/lib/username-rules";
import { t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { UsernameField, useUsernameCheck } from "@/components/mahdi/UsernameForm";

/** The required step: choose a free username, then the app opens. */
export default function UsernameGate({ suggestion }: { suggestion: string }) {
  const router = useRouter();
  const [value, setValue] = useState(suggestion);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const status = useUsernameCheck(value, null);

  return (
    <main id="m-main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <form
        className="m-card space-y-5 p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await mahdiFetch("/api/mahdi/username", { method: "PUT", json: { username: cleanUsername(value) } });
            router.replace("/mahdi");
            router.refresh();
          } catch (err) {
            setError((err as Error).message);
            setBusy(false);
          }
        }}
      >
        <h1 className="m-display text-3xl">{t.username.gateTitle}</h1>
        <p className="m-muted">{t.username.gateBody}</p>
        <UsernameField value={value} onChange={(v) => (setValue(v), setError(""))} status={status} autoFocus />
        {error && <p className="m-error" role="alert">{error}</p>}
        <button className="m-btn m-btn-primary w-full" disabled={busy || status.state !== "ok"}>{busy ? t.common.saving : t.username.continue}</button>
      </form>
    </main>
  );
}
