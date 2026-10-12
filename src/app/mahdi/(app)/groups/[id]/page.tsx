"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import qrcode from "qrcode-generator";
import { fmtNum, t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import Avatar from "@/components/mahdi/Avatar";
import BoardList, { type BoardRow } from "@/components/mahdi/BoardList";
import ConfirmSheet from "@/components/mahdi/ConfirmSheet";
import Icon from "@/components/mahdi/Icon";
import { useMahdi } from "@/components/mahdi/Provider";

interface Member {
  displayName: string;
  username: string;
  avatarUrl: string | null;
  status: "invited" | "active";
  leader: boolean;
  mine: boolean;
}
interface Detail {
  group: { id: string; name: string; isLeader: boolean };
  members: Member[];
  requests?: { displayName: string; username: string; avatarUrl: string | null }[];
  ranking: { ranked: BoardRow[]; unranked: { displayName: string; username: string; avatarUrl: string | null; mine: boolean }[]; min?: number };
}
type Confirm = { kind: "remove" | "transfer"; m: Member } | { kind: "leave" | "delete" } | null;

/** One group: its closed ranking (week / month, commitment / reading), its members, and the leader's tools. */
export default function GroupPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useMahdi();
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [metric, setMetric] = useState<"score" | "reading">("score");
  const [result, setResult] = useState<{ key: string; data: Detail } | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [username, setUsername] = useState("");
  const [rename, setRename] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const key = `${period}:${metric}:${reload}`;
  // the join link (the leader's): its token comes from the server once asked
  const [token, setToken] = useState<string | null>(null);
  const link = token && typeof window !== "undefined" ? `${window.location.origin}/api/mahdi/groups/go?t=${token}` : "";
  const qr = useMemo(() => {
    if (!link) return "";
    const q = qrcode(0, "M");
    q.addData(link);
    q.make();
    return q.createDataURL(6, 8);
  }, [link]);
  async function getLink(reset = false) {
    try {
      const r = await mahdiFetch<{ token: string }>(`/api/mahdi/groups/${id}`, { method: "POST", json: { action: reset ? "link_reset" : "link" } });
      setToken(r.token);
      if (reset) toast(t.groups.linkResetDone);
    } catch (e) {
      toast((e as Error).message);
    }
  }

  useEffect(() => {
    let live = true;
    const k = `${period}:${metric}:${reload}`;
    mahdiFetch<Detail>(`/api/mahdi/groups/${id}?period=${period}&metric=${metric}`)
      .then((data) => live && (setResult({ key: k, data }), setError("")))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [id, period, metric, reload]);

  const data = result?.data ?? null;
  const fresh = result?.key === key;

  async function act(body: object, done: string, after?: () => void) {
    setBusy(true);
    try {
      await mahdiFetch(`/api/mahdi/groups/${id}`, { method: "POST", json: body });
      toast(done);
      if (after) after();
      else setReload((n) => n + 1);
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  }

  if (error && !data) {
    return (
      <div className="m-card space-y-4 p-6 text-center">
        <p>{error}</p>
        <Link href="/mahdi/groups" className="m-btn m-btn-ghost">{t.groups.back}</Link>
      </div>
    );
  }
  if (!data) return <p className="m-muted">{t.common.loading}</p>;
  const { group, members, ranking } = data;
  const active = members.filter((m) => m.status === "active");
  const invited = members.filter((m) => m.status === "invited");

  return (
    <div className="space-y-6">
      <Link href="/mahdi/groups" className="m-btn m-btn-quiet m-btn-sm -ms-3">
        <Icon name="chevronRight" size={18} /> {t.groups.back}
      </Link>
      <header className="space-y-1">
        <p className="m-eyebrow">{t.groups.title}</p>
        <h1 className="m-display text-3xl">{group.name}</h1>
        <p className="m-num text-sm m-muted">{t.groups.members(active.length)}</p>
      </header>

      <section className="space-y-3" aria-labelledby="rank">
        <h2 id="rank" className="text-lg font-semibold">{t.groups.ranking}</h2>
        <p className="text-sm m-muted">{t.groups.rankingHint}</p>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t.leaderboard.metric}>
          {(["score", "reading"] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={metric === m} className="m-option min-h-10 px-3 text-sm font-semibold" onClick={() => setMetric(m)}>
              {m === "score" ? t.groups.metricScore : t.groups.metricReading}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t.leaderboard.title}>
          {(["week", "month"] as const).map((p) => (
            <button key={p} type="button" role="radio" aria-checked={period === p} className="m-option min-h-10 px-3 text-sm font-semibold" onClick={() => setPeriod(p)}>
              {t.leaderboard[p]}
            </button>
          ))}
        </div>
        <div className={fresh ? "" : "opacity-60"} aria-busy={!fresh}>
          {ranking.ranked.length > 0 ? <BoardList entries={ranking.ranked} label={t.groups.ranking} /> : <p className="m-card p-5 text-center m-muted">{t.leaderboard.empty}</p>}
          {ranking.unranked.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-sm m-muted">{t.groups.belowMin}{ranking.min ? ` (${t.leaderboard.min(ranking.min)})` : ""}</p>
              <ul className="flex flex-wrap gap-2">
                {ranking.unranked.map((u) => (
                  <li key={u.username || u.displayName} className="m-chip">{u.displayName}{u.mine && ` · ${t.leaderboard.you}`}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="members">
        <h2 id="members" className="text-lg font-semibold">{t.groups.membersTitle}</h2>
        <ul className="m-card divide-y" style={{ borderColor: "var(--m-line)" }}>
          {[...active, ...invited].map((m) => (
            <li key={m.username || m.displayName} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Avatar profile={m} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{t.mawla(m.displayName)}</span>
                <span className="flex flex-wrap items-center gap-2 text-sm m-muted">
                  {m.username && <bdi dir="auto">{m.username}</bdi>}
                  {m.leader && <span className="m-chip m-chip-gold">{t.groups.leader}</span>}
                  {m.status === "invited" && <span className="m-chip">{t.groups.pending}</span>}
                </span>
              </span>
              {group.isLeader && !m.mine && (
                <span className="flex gap-1">
                  {m.status === "active" && (
                    <button type="button" className="m-btn m-btn-quiet m-btn-sm" onClick={() => setConfirm({ kind: "transfer", m })}>{t.groups.makeLeader}</button>
                  )}
                  <button type="button" className="m-btn m-btn-quiet m-btn-sm" onClick={() => setConfirm({ kind: "remove", m })}>{t.groups.remove}</button>
                </span>
              )}
            </li>
          ))}
        </ul>

        {group.isLeader && (data.requests?.length ?? 0) > 0 && (
          <div className="m-card space-y-2 p-4">
            <h3 className="font-semibold">{t.groups.requestsTitle}</h3>
            <ul className="divide-y" style={{ borderColor: "var(--m-line)" }}>
              {data.requests!.map((r) => (
                <li key={r.username || r.displayName} className="flex items-center gap-3 py-2">
                  <Avatar profile={{ ...r }} size={32} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{t.mawla(r.displayName)} <bdi dir="auto" className="text-sm font-normal m-muted">{r.username}</bdi></span>
                  <button type="button" className="m-btn m-btn-primary m-btn-sm" disabled={busy} onClick={() => act({ action: "approve", username: r.username }, t.groups.approved)}>{t.groups.approve}</button>
                  <button type="button" className="m-btn m-btn-quiet m-btn-sm" disabled={busy} onClick={() => act({ action: "reject", username: r.username }, t.groups.rejected)}>{t.groups.reject}</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {group.isLeader && (
          <div className="m-card space-y-3 p-4">
            <h3 className="font-semibold">{t.groups.linkTitle}</h3>
            <p className="text-sm m-muted">{t.groups.linkHint}</p>
            {!token ? (
              <button type="button" className="m-btn m-btn-ghost w-full" onClick={() => getLink()}>{t.groups.linkShow}</button>
            ) : (
              <div className="space-y-3 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {qr && <img src={qr} alt="QR" width={180} height={180} className="mx-auto rounded-lg bg-white" />}
                <input className="m-field" dir="ltr" readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label={t.groups.linkTitle} />
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" className="m-btn m-btn-primary" onClick={() => navigator.clipboard?.writeText(link).then(() => toast(t.groups.linkCopied)).catch(() => {})}>{t.groups.linkCopy}</button>
                  <button type="button" className="m-btn m-btn-ghost" onClick={() => (navigator.share ? navigator.share({ title: group.name, url: link }).catch(() => {}) : navigator.clipboard?.writeText(link).then(() => toast(t.groups.linkCopied)))}>{t.groups.linkShare}</button>
                </div>
                <button type="button" className="m-btn m-btn-quiet m-btn-sm" onClick={() => getLink(true)}>{t.groups.linkReset}</button>
              </div>
            )}
          </div>
        )}

        {group.isLeader && (
          <form
            className="m-card space-y-2 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              act({ action: "invite", username }, t.groups.invited, () => (setUsername(""), setReload((n) => n + 1)));
            }}
          >
            <label className="block">
              <span className="m-label">{t.groups.invite}</span>
              <input className="m-field" dir="auto" autoCapitalize="none" autoCorrect="off" spellCheck={false} required maxLength={24} value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t.username.placeholder.replace(/^.*: /, "")} aria-label={t.groups.inviteLabel} />
            </label>
            <button className="m-btn m-btn-primary w-full" disabled={busy || !username.trim()}>{t.groups.inviteSend}</button>
          </form>
        )}
      </section>

      <section className="m-card space-y-2 p-4">
        {group.isLeader && (
          rename === null ? (
            <button type="button" className="m-btn m-btn-ghost w-full justify-start" onClick={() => setRename(group.name)}>
              <Icon name="edit" /> {t.groups.rename}
            </button>
          ) : (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                act({ action: "rename", name: rename }, t.groups.renamed, () => (setRename(null), setReload((n) => n + 1)));
              }}
            >
              <input className="m-field flex-1" required maxLength={40} value={rename} onChange={(e) => setRename(e.target.value)} aria-label={t.groups.name} autoFocus />
              <button className="m-btn m-btn-ghost" disabled={busy}>{t.common.save}</button>
            </form>
          )
        )}
        {group.isLeader ? (
          <button type="button" className="m-btn m-btn-danger w-full justify-start" onClick={() => setConfirm({ kind: "delete" })}>
            <Icon name="trash" /> {t.groups.delete}
          </button>
        ) : (
          <button type="button" className="m-btn m-btn-danger w-full justify-start" onClick={() => setConfirm({ kind: "leave" })}>
            <Icon name="logout" /> {t.groups.leave}
          </button>
        )}
        {group.isLeader && <p className="text-sm m-muted">{t.groups.leaderLeave}</p>}
        <p className="m-num text-center text-xs m-muted">{fmtNum(members.length)} / 50</p>
      </section>

      <ConfirmSheet
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={
          confirm?.kind === "remove"
            ? t.groups.removeTitle(confirm.m.displayName)
            : confirm?.kind === "transfer"
              ? t.groups.transferTitle(confirm.m.displayName)
              : confirm?.kind === "delete"
                ? t.groups.deleteTitle
                : t.groups.leaveTitle
        }
        body={confirm?.kind === "delete" ? t.groups.deleteBody : confirm?.kind === "leave" ? t.groups.leaveBody : ""}
        confirmLabel={
          confirm?.kind === "remove" ? t.groups.remove : confirm?.kind === "transfer" ? t.groups.makeLeader : confirm?.kind === "delete" ? t.groups.delete : t.groups.leave
        }
        onConfirm={async () => {
          const c = confirm;
          if (!c) return;
          const body =
            c.kind === "remove" || c.kind === "transfer" ? { action: c.kind, username: c.m.username } : { action: c.kind };
          await mahdiFetch(`/api/mahdi/groups/${id}`, { method: "POST", json: body });
          if (c.kind === "delete" || c.kind === "leave") {
            toast(c.kind === "delete" ? t.groups.deleted : t.groups.left);
            router.push("/mahdi/groups");
          } else {
            toast(c.kind === "remove" ? t.groups.removed : t.groups.transferred);
            setReload((n) => n + 1);
          }
        }}
      />
    </div>
  );
}
