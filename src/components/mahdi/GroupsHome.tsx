"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fmtNum, t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import Icon from "./Icon";
import { useMahdi } from "./Provider";
import UsernameForm from "./UsernameForm";

interface GroupItem {
  id: string;
  name: string;
  isLeader: boolean;
  leaderName: string;
  members: number;
  invitedBy?: string;
}

/** «إخوة الولاية»: my groups, invitations waiting for me, and creating a group. */
export default function GroupsHome() {
  const router = useRouter();
  const { state, toast } = useMahdi();
  const [data, setData] = useState<{ groups: GroupItem[]; invites: GroupItem[] } | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const hasUsername = Boolean(state.snap.username);

  useEffect(() => {
    let live = true;
    mahdiFetch<{ groups: GroupItem[]; invites: GroupItem[] }>("/api/mahdi/groups")
      .then((d) => live && (setData(d), setError("")))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [reload]);

  async function respond(id: string, action: "accept" | "decline") {
    setBusy(true);
    try {
      await mahdiFetch(`/api/mahdi/groups/${id}`, { method: "POST", json: { action } });
      toast(action === "accept" ? t.groups.accepted : t.groups.declined);
      if (action === "accept") router.push(`/mahdi/groups/${id}`);
      else setReload((n) => n + 1);
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { id } = await mahdiFetch<{ id: string }>("/api/mahdi/groups", { method: "POST", json: { name: name.trim() } });
      toast(t.groups.created);
      router.push(`/mahdi/groups/${id}`);
    } catch (err) {
      toast((err as Error).message);
    }
    setBusy(false);
  }

  return (
    <div className="space-y-5">
      <p className="m-note">{t.groups.intro}</p>

      {!hasUsername && (
        <section className="m-card space-y-2 p-5">
          <p className="font-semibold">{t.username.needed}</p>
          <UsernameForm />
        </section>
      )}

      {error && (
        <p className="m-error" role="alert">
          {error} <button type="button" className="underline" onClick={() => setReload((n) => n + 1)}>{t.common.retry}</button>
        </p>
      )}
      {!data && !error && <p className="m-muted">{t.common.loading}</p>}

      {data && data.invites.length > 0 && (
        <section className="space-y-2" aria-labelledby="invites">
          <h2 id="invites" className="text-lg font-semibold">{t.groups.invites}</h2>
          <ul className="space-y-2">
            {data.invites.map((g) => (
              <li key={g.id} className="m-card flex flex-wrap items-center gap-3 p-4">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{g.name}</span>
                  <span className="block text-sm m-muted">{t.groups.invitedBy(g.invitedBy ?? g.leaderName)}</span>
                </span>
                <button type="button" className="m-btn m-btn-primary m-btn-sm" disabled={busy} onClick={() => respond(g.id, "accept")}>{t.groups.accept}</button>
                <button type="button" className="m-btn m-btn-quiet m-btn-sm" disabled={busy} onClick={() => respond(g.id, "decline")}>{t.groups.decline}</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data && (
        <section className="space-y-2" aria-labelledby="mine">
          <h2 id="mine" className="text-lg font-semibold">{t.groups.mine}</h2>
          {data.groups.length === 0 ? (
            <p className="m-card p-5 text-center m-muted">{t.groups.none}</p>
          ) : (
            <ul className="space-y-2">
              {data.groups.map((g) => (
                <li key={g.id}>
                  <Link href={`/mahdi/groups/${g.id}`} className="m-card flex items-center gap-3 p-4">
                    <Icon name="users" className="m-gold" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{g.name}</span>
                      <span className="m-num block text-sm m-muted">
                        {t.groups.members(g.members)} · {g.isLeader ? t.groups.leader : `${t.groups.leader}: ${g.leaderName}`}
                      </span>
                    </span>
                    <Icon name="chevronLeft" size={18} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {hasUsername && data && (
        <form className="m-card space-y-3 p-5" onSubmit={create}>
          <label className="block">
            <span className="m-label">{t.groups.create}</span>
            <input className="m-field" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder={t.groups.namePlaceholder} aria-label={t.groups.name} />
          </label>
          <button className="m-btn m-btn-primary w-full" disabled={busy || !name.trim()}>
            <Icon name="plus" size={18} /> {t.groups.create}
          </button>
          <p className="m-num text-center text-xs m-muted">{fmtNum(data.groups.length + data.invites.length)} / 5</p>
        </form>
      )}
    </div>
  );
}
