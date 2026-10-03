"use client";

import { useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import type { Privacy } from "@/lib/mahdi/types";
import { useMahdi } from "@/components/mahdi/Provider";

/** Sharing switches. Off by default; nothing becomes visible to others unless switched on here. */
export default function PrivacyPage() {
  const { state, store, toast } = useMahdi();
  const p = state.snap.privacy;
  const [busy, setBusy] = useState(false);

  async function set(patch: Partial<Privacy>) {
    setBusy(true);
    try {
      const { privacy } = await mahdiFetch<{ privacy: Privacy }>("/api/mahdi/privacy", { method: "PATCH", json: patch });
      store.setSnapPart({ privacy });
      toast(t.common.saved);
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  }

  const row = (key: keyof Privacy, label: string, hint: string, disabled = false) => (
    <label className={`flex min-h-14 items-start justify-between gap-4 py-3 ${disabled ? "opacity-50" : ""}`}>
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="block text-sm m-muted">{hint}</span>
      </span>
      <input type="checkbox" role="switch" className="mt-1 size-6 shrink-0 accent-[var(--m-gold)]" checked={p[key]} disabled={busy || disabled} onChange={(e) => set({ [key]: e.target.checked })} />
    </label>
  );

  return (
    <div className="space-y-6">
      <h1 className="m-display text-3xl">{t.privacy.title}</h1>
      <p className="m-note">{t.privacy.intro}</p>
      <section className="m-card divide-y px-5" style={{ borderColor: "var(--m-line)" }}>
        {row("community", t.privacy.community, `${t.privacy.communityHint} ${t.privacy.leaveNote}`)}
        {row("leaderboard", t.privacy.leaderboard, t.privacy.leaderboardHint, !p.community)}
        {row("showAvatar", t.privacy.showAvatar, t.more.avatarHint, !p.community)}
      </section>
    </div>
  );
}
