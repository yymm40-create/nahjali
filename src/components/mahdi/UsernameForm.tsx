"use client";

import { useState } from "react";
import { cleanUsername, USERNAME_RE } from "@/lib/mahdi/engine";
import { t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { useMahdi } from "./Provider";

/** Choosing or changing the site-wide @username. */
export default function UsernameForm({ compact = false }: { compact?: boolean }) {
  const { state, store, toast } = useMahdi();
  const current = state.snap.username;
  const [value, setValue] = useState(current ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const name = cleanUsername(value);
  const valid = USERNAME_RE.test(name);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return setError(t.username.invalid);
    setBusy(true);
    setError("");
    try {
      const { username } = await mahdiFetch<{ username: string }>("/api/mahdi/username", { method: "PUT", json: { username: name } });
      store.setSnapPart({ username });
      toast(t.username.saved);
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  return (
    <form className="space-y-2" onSubmit={save}>
      {!compact && <p className="text-sm m-muted">{t.username.hint}</p>}
      <div className="flex items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="m-label">{t.username.label}</span>
          <span className="relative block">
            <input
              className="m-field"
              style={{ paddingLeft: "2rem" }}
              dir="ltr"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={21}
              value={value}
              onChange={(e) => setValue(e.target.value.toLowerCase())}
              placeholder={t.username.placeholder.replace(/^.*: /, "")}
              aria-describedby="username-rules"
            />
            <span className="m-muted pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" dir="ltr">@</span>
          </span>
        </label>
        <button className="m-btn m-btn-ghost" disabled={busy || !valid || name === current}>{t.username.save}</button>
      </div>
      <p id="username-rules" className="m-hint">{t.username.rules}</p>
      {error && <p className="m-error" role="alert">{error}</p>}
    </form>
  );
}
