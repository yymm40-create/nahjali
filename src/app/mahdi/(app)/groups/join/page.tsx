"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { useMahdi } from "@/components/mahdi/Provider";

interface Info {
  name: string;
  status: "active" | "invited" | "requested" | null;
  id: string;
}

/** Arrived from a group's join link: the group's name, and a button that asks its leader to let the visitor in. */
export default function JoinGroup() {
  const { toast } = useMahdi();
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    mahdiFetch<Info>("/api/mahdi/groups/join")
      .then(setInfo)
      .catch((e: Error) => setError(e.message));
  }, []);

  async function send() {
    setBusy(true);
    try {
      await mahdiFetch("/api/mahdi/groups/join", { method: "POST", json: {} });
      setSent(true);
      toast(t.groups.joinSent);
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  }

  if (error)
    return (
      <div className="m-card space-y-4 p-6 text-center">
        <p>{error}</p>
        <Link href="/mahdi/groups" className="m-btn m-btn-ghost">{t.groups.back}</Link>
      </div>
    );
  if (!info) return <p className="m-muted">{t.common.loading}</p>;
  const note = sent || info.status === "requested" ? (sent ? t.groups.joinSent : t.groups.joinWaiting) : info.status === "active" ? t.groups.joinAlready : info.status === "invited" ? t.groups.joinInvited : null;
  return (
    <div className="m-card space-y-4 p-6 text-center">
      <h1 className="m-display text-2xl">{t.groups.joinTitle(info.name)}</h1>
      {note ? <p>{note}</p> : <p className="m-muted">{t.groups.joinBody}</p>}
      {!note && (
        <button type="button" className="m-btn m-btn-primary w-full" disabled={busy} onClick={send}>{t.groups.joinSend}</button>
      )}
      <Link href={info.status === "active" ? `/mahdi/groups/${info.id}` : "/mahdi/groups"} className="m-btn m-btn-ghost w-full" onClick={() => !note && void mahdiFetch("/api/mahdi/groups/join", { method: "DELETE" }).catch(() => {})}>
        {note ? t.groups.back : t.groups.joinNot}
      </Link>
    </div>
  );
}
