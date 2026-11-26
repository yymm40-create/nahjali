"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fmtNum, t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import Icon from "./Icon";
import { useMahdi } from "./Provider";
import Sheet from "./Sheet";
import UsernameForm from "./UsernameForm";
import VisibilityChoice from "./groups/VisibilityChoice";
import PageHead from "./social/PageHead";
import { Empty, ErrorState, Skeleton } from "./social/States";

interface GroupItem {
  id: string;
  name: string;
  isLeader: boolean;
  leaderName: string;
  members: number;
  invitedBy?: string;
  visibility?: "all" | "leaders";
}
type Visibility = "all" | "leaders";
const K = t.groups.kind;

/**
 * «المجموعات» (إخوة الولاية): invitations waiting for me, my groups, and one primary action — «مجموعة جديدة», which
 * opens its form in a sheet. Loading, empty and error look like the rest of «المجتمع».
 */
export default function GroupsHome() {
  const router = useRouter();
  const { state, toast } = useMahdi();
  const [data, setData] = useState<{ groups: GroupItem[]; invites: GroupItem[]; privacyReady?: boolean } | null>(null);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  // who sees each member's progress in the new group (everyone, as before, unless the leader picks otherwise)
  const [visibility, setVisibility] = useState<Visibility>("all");
  const [busy, setBusy] = useState(false);
  const hasUsername = Boolean(state.snap.username);

  useEffect(() => {
    let live = true;
    mahdiFetch<{ groups: GroupItem[]; invites: GroupItem[]; privacyReady?: boolean }>("/api/mahdi/groups")
      .then((d) => live && (setData(d), setError(false)))
      .catch(() => live && setError(true));
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
      const privacyReady = Boolean(data?.privacyReady);
      const { id, privacyKept } = await mahdiFetch<{ id: string; privacyKept?: boolean }>("/api/mahdi/groups", { method: "POST", json: { name: name.trim(), visibility: privacyReady ? visibility : "all" } });
      toast(privacyKept === false ? t.groups.privacy.notKept : t.groups.created);
      router.push(`/mahdi/groups/${id}`);
    } catch (err) {
      toast((err as Error).message);
    }
    setBusy(false);
  }

  const canCreate = hasUsername && data !== null;

  return (
    <div className="space-y-6">
      <PageHead title={t.groups.title} sub={t.groups.intro}>
        {canCreate && (
          <button type="button" className="m-btn m-btn-primary m-btn-sm" onClick={() => setCreating(true)}>
            <Icon name="plus" size={18} /> {K.newGroup}
          </button>
        )}
      </PageHead>

      {!hasUsername && (
        <section className="m-card space-y-2 p-5">
          <p className="font-semibold">{t.username.needed}</p>
          <UsernameForm />
        </section>
      )}

      {error && !data && <ErrorState message={K.listError} onRetry={() => setReload((n) => n + 1)} />}
      {!data && !error && <Skeleton count={3} label={t.common.loading} />}

      {data && data.invites.length > 0 && (
        <section className="space-y-2" aria-labelledby="invites">
          <h2 id="invites" className="text-lg font-semibold">{t.groups.invites}</h2>
          <ul className="space-y-2">
            {data.invites.map((g) => (
              <li key={g.id} className="m-card flex flex-wrap items-center gap-3 p-4">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    {g.name}
                    {g.visibility === "leaders" && <span className="m-chip ms-2 text-xs">{t.groups.privacy.chip}</span>}
                  </span>
                  <span className="block text-sm m-muted">{t.groups.invitedBy(g.invitedBy ?? g.leaderName)}</span>
                </span>
                <button type="button" className="m-btn m-btn-ghost m-btn-sm" disabled={busy} onClick={() => respond(g.id, "accept")}>
                  <Icon name="check" size={16} /> {t.groups.accept}
                </button>
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
            <Empty icon="users" title={K.noneTitle} body={K.noneBody} />
          ) : (
            <ul className="space-y-2">
              {data.groups.map((g) => (
                <li key={g.id}>
                  <Link href={`/mahdi/groups/${g.id}`} className="m-card flex items-center gap-3 p-4">
                    <span className="m-row-ic" aria-hidden="true">
                      <Icon name="users" size={20} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">
                        {g.name}
                        {g.visibility === "leaders" && <span className="m-chip ms-2 text-xs">{t.groups.privacy.chip}</span>}
                      </span>
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

      <Sheet open={creating} onClose={() => setCreating(false)} title={t.groups.create}>
        {data && (
          <form className="space-y-4" onSubmit={create}>
            <label className="block">
              <span className="m-label">{t.groups.name}</span>
              <input className="m-field" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder={t.groups.namePlaceholder} autoFocus />
            </label>
            <VisibilityChoice value={visibility} onChange={setVisibility} disabled={!data.privacyReady} />
            <button className="m-btn m-btn-primary w-full" disabled={busy || !name.trim()}>
              <Icon name="plus" size={18} /> {t.groups.create}
            </button>
            <p className="m-num text-center text-xs m-muted">{fmtNum(data.groups.length + data.invites.length)} / 5</p>
          </form>
        )}
      </Sheet>
    </div>
  );
}
