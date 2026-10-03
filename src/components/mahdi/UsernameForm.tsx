"use client";

import { useEffect, useState } from "react";
import { cleanUsername, USERNAME_RE } from "@/lib/username-rules";
import { t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { useMahdi } from "./Provider";

export type UsernameStatus = { state: "idle" | "checking" | "ok" | "bad"; message: string };

/** Checks a wanted username as it is typed (a short pause first). `current` is the user's own name (always fine). */
export function useUsernameCheck(value: string, current: string | null): UsernameStatus {
  const name = cleanUsername(value);
  const [result, setResult] = useState<{ name: string; status: UsernameStatus } | null>(null);
  useEffect(() => {
    if (!USERNAME_RE.test(name) || name === current) return;
    let live = true;
    const id = setTimeout(() => {
      mahdiFetch<{ available: boolean; message: string }>(`/api/mahdi/username?check=${encodeURIComponent(name)}`)
        .then((r) => live && setResult({ name, status: r.available ? { state: "ok", message: t.username.available } : { state: "bad", message: r.message } }))
        .catch(() => {});
    }, 350);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [name, current]);
  if (!name) return { state: "idle", message: "" };
  if (!USERNAME_RE.test(name)) return { state: "bad", message: t.username.invalid };
  if (name === current) return { state: "ok", message: "" };
  return result?.name === name ? result.status : { state: "checking", message: t.username.checking };
}

/** The username input with its live check. */
export function UsernameField({ value, onChange, status, autoFocus = false }: { value: string; onChange: (v: string) => void; status: UsernameStatus; autoFocus?: boolean }) {
  const color = status.state === "ok" ? "var(--m-success)" : status.state === "bad" ? "var(--m-error)" : undefined;
  return (
    <label className="block">
      <span className="m-label">{t.username.label}</span>
      <input
        className="m-field"
        dir="auto"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        maxLength={24}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t.username.placeholder.replace(/^.*: /, "")}
        aria-invalid={status.state === "bad"}
        aria-describedby="username-rules username-status"
      />
      {cleanUsername(value) !== value.trim() && USERNAME_RE.test(cleanUsername(value)) && (
        <span className="m-hint mt-1 block" dir="auto">{t.username.yours(cleanUsername(value))}</span>
      )}
      <span id="username-status" className="mt-1 block text-sm font-semibold" style={{ color }} role="status">{status.message}</span>
      <span id="username-rules" className="m-hint block">{t.username.rules}</span>
    </label>
  );
}

/** Choosing or changing the site-wide username (in «المزيد», and in the groups page when missing). */
export default function UsernameForm({ compact = false, onSaved, submitLabel }: { compact?: boolean; onSaved?: (name: string) => void; submitLabel?: string }) {
  const { state, store, toast } = useMahdi();
  const current = state.snap.username;
  const [value, setValue] = useState(current ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const status = useUsernameCheck(value, current);
  const name = cleanUsername(value);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (status.state === "bad") return setError(status.message);
    setBusy(true);
    setError("");
    try {
      const { username } = await mahdiFetch<{ username: string }>("/api/mahdi/username", { method: "PUT", json: { username: name } });
      store.setSnapPart({ username });
      toast(t.username.saved);
      onSaved?.(username);
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  return (
    <form className="space-y-3" onSubmit={save}>
      {!compact && <p className="text-sm m-muted">{t.username.hint}</p>}
      <UsernameField value={value} onChange={(v) => (setValue(v), setError(""))} status={status} />
      {error && <p className="m-error" role="alert">{error}</p>}
      <button className="m-btn m-btn-ghost w-full sm:w-auto" disabled={busy || status.state !== "ok" || name === current}>
        {busy ? t.common.saving : (submitLabel ?? t.username.save)}
      </button>
    </form>
  );
}
