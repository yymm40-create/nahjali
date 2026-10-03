"use client";

import { useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import type { Privacy } from "@/lib/mahdi/types";
import Icon from "./Icon";
import { useMahdi } from "./Provider";

/** Shown instead of the feed and the ranking until the user switches the community on. */
export default function JoinPrompt() {
  const { store, toast } = useMahdi();
  const [busy, setBusy] = useState(false);
  return (
    <section className="m-card space-y-4 p-6 text-center">
      <Icon name="globe" size={36} className="m-gold mx-auto" />
      <h2 className="m-display text-2xl">{t.community.join}</h2>
      <p>{t.community.joinBody}</p>
      <p className="text-sm m-muted">{t.community.joinNote}</p>
      <button
        type="button"
        className="m-btn m-btn-primary w-full sm:w-auto"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const { privacy } = await mahdiFetch<{ privacy: Privacy }>("/api/mahdi/privacy", { method: "PATCH", json: { community: true } });
            store.setSnapPart({ privacy });
            toast(t.community.joined);
          } catch (e) {
            toast((e as Error).message);
          }
          setBusy(false);
        }}
      >
        {t.community.join}
      </button>
    </section>
  );
}
