"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { INBOX_EVENT } from "@/components/mahdi/AppShell";
import Icon from "@/components/mahdi/Icon";
import Robot from "@/components/mahdi/Robot";
import { useMahdi } from "@/components/mahdi/Provider";

const I = t.inbox;
const when = new Intl.DateTimeFormat("ar-u-nu-latn", { dateStyle: "medium", timeStyle: "short" });

interface Note {
  id: string;
  kind: string;
  title: string;
  body: string;
  url: string;
  createdAt: string;
  read: boolean;
}

/** The bell: replies of «المساعد» and everything new for this person. Opening the page reads them. */
export default function InboxPage() {
  const { toast } = useMahdi();
  const [items, setItems] = useState<Note[] | null>(null);
  const [ready, setReady] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    mahdiFetch<{ ready: boolean; unread: number; items: Note[] }>("/api/mahdi/inbox")
      .then(async (r) => {
        if (!live) return;
        setReady(r.ready);
        setItems(r.items);
        // Seen now: the badge goes away, the "جديد" marks stay until the page is left
        if (r.unread > 0) {
          await mahdiFetch("/api/mahdi/inbox", { method: "POST", json: { read: "all" } }).catch(() => {});
          window.dispatchEvent(new Event(INBOX_EVENT));
        }
      })
      .catch((e) => live && setError((e as Error).message || I.loadError));
    return () => {
      live = false;
    };
  }, []);

  async function remove(id: string) {
    const before = items;
    setItems((list) => list?.filter((n) => n.id !== id) ?? null);
    try {
      await mahdiFetch("/api/mahdi/inbox", { method: "POST", json: { delete: id } });
    } catch (e) {
      setItems(before);
      toast((e as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="m-display text-3xl">{I.title}</h1>
        <Link href="/mahdi/more/notifications" className="m-btn m-btn-ghost m-btn-sm">
          <Icon name="settings" size={18} /> {I.settings}
        </Link>
      </header>

      {error && <p className="m-error" role="alert">{error}</p>}
      {!ready && <p className="m-note">{I.notReady}</p>}
      {items === null && !error && <p className="m-muted">{t.common.loading}</p>}

      {items?.length === 0 && ready && (
        <section className="m-card space-y-2 p-6 text-center">
          <Icon name="bell" size={36} className="m-gold mx-auto" />
          <p className="font-semibold">{I.empty}</p>
          <p className="m-muted text-sm">{I.emptyHint}</p>
        </section>
      )}

      {items && items.length > 0 && (
        <ul className="m-card divide-y px-2" style={{ borderColor: "var(--m-line)" }}>
          {items.map((n) => {
            const content = (
              <>
                <span className="m-soft grid size-11 shrink-0 place-items-center">
                  {n.kind.startsWith("assistant") ? <Robot size={34} /> : <Icon name="bell" size={20} />}
                </span>
                <span className="min-w-0 flex-1 space-y-0.5">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-semibold">{n.title}</span>
                    {!n.read && <span className="m-chip m-chip-success shrink-0 !px-2 !py-0 text-[11px]">{I.unread}</span>}
                  </span>
                  {n.body && <span className="m-muted line-clamp-2 block whitespace-pre-line text-sm" dir="auto">{n.body}</span>}
                  <span className="m-muted m-num block text-[11px]">{when.format(new Date(n.createdAt))}</span>
                </span>
              </>
            );
            return (
              <li key={n.id} className="flex items-start gap-1 py-1">
                {n.url ? (
                  <Link href={n.url} className="flex min-w-0 flex-1 items-start gap-3 rounded-xl px-2 py-2 hover:bg-[var(--m-surface-2)]">{content}</Link>
                ) : (
                  <div className="flex min-w-0 flex-1 items-start gap-3 px-2 py-2">{content}</div>
                )}
                <button type="button" className="m-icon-btn m-muted mt-1" aria-label={I.delete} onClick={() => remove(n.id)}>
                  <Icon name="close" size={18} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
