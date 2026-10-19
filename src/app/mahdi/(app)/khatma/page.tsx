"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import Icon from "@/components/mahdi/Icon";

interface Item {
  id: string;
  name: string;
  isLeader: boolean;
  active: boolean;
  khatma: { number: number; status: "open" | "done" | "closed"; endsAt: string; done: number; total: number; mine: number } | null;
}

/** «الختمة العلوية»: the khatma of each of my private groups. */
export default function KhatmaHome() {
  const [data, setData] = useState<{ ready: boolean; groups: Item[] } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    mahdiFetch<{ ready: boolean; groups: Item[] }>("/api/mahdi/khatma")
      .then((d) => live && (setData(d), setError("")))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="m-eyebrow">لأجل المهدي</p>
        <h1 className="m-display text-3xl">{t.khatma.title}</h1>
        <p className="m-muted">{t.khatma.intro}</p>
        <p className="text-sm m-muted">{t.khatma.privateOnly}</p>
      </header>

      {error && !data ? (
        <p className="m-card p-5 text-center">{error}</p>
      ) : !data ? (
        <p className="m-muted">{t.common.loading}</p>
      ) : !data.ready ? (
        <p className="m-note">{t.khatma.tablesNotReady}</p>
      ) : data.groups.length === 0 ? (
        <div className="m-card space-y-3 p-6 text-center">
          <p>{t.khatma.noGroups}</p>
          <Link href="/mahdi/groups" className="m-btn m-btn-primary">{t.khatma.toGroups}</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {data.groups.map((g) => {
            const k = g.khatma;
            const running = g.active && k;
            return (
              <li key={g.id}>
                <Link href={`/mahdi/khatma/${g.id}`} className="m-card flex items-center gap-3 p-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl" style={{ background: "color-mix(in srgb, var(--m-gold) 16%, transparent)", color: "var(--m-gold)" }}>
                    <Icon name="book" size={22} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{g.name}</span>
                    <span className="m-num block text-sm m-muted">
                      {running
                        ? `${t.khatma.number(k.number)} · ${t.khatma.progress(k.done, k.total)}${k.mine ? ` · ${t.khatma.mineCount(k.mine)}` : ""}`
                        : !g.active && k
                          ? t.khatma.stopped
                          : g.isLeader
                            ? t.khatma.notStarted
                            : t.khatma.notStartedMember}
                    </span>
                    {running && (
                      <span className="mt-2 block h-1.5 overflow-hidden rounded-full" style={{ background: "var(--m-track)" }}>
                        <span className="block h-full rounded-full" style={{ width: `${Math.round((k.done / k.total) * 100)}%`, background: "#22c55e" }} />
                      </span>
                    )}
                  </span>
                  <Icon name="chevronLeft" size={18} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
