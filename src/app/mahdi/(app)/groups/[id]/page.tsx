"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import qrcode from "qrcode-generator";
import { fmtNum, t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import Avatar from "@/components/mahdi/Avatar";
import BoardList, { type BoardRow } from "@/components/mahdi/BoardList";
import ConfirmSheet from "@/components/mahdi/ConfirmSheet";
import Icon from "@/components/mahdi/Icon";
import { useMahdi } from "@/components/mahdi/Provider";
import Sheet from "@/components/mahdi/Sheet";
import GroupProgram, { type ProgramData } from "@/components/mahdi/groups/GroupProgram";
import GroupStats from "@/components/mahdi/groups/GroupStats";
import { GROUP_PERMS, type GroupPerm } from "@/lib/mahdi/groups/program";

interface Member {
  displayName: string;
  username: string;
  avatarUrl: string | null;
  status: "invited" | "active";
  leader: boolean;
  mine: boolean;
  admin?: boolean;
  perms?: GroupPerm[];
  appointedBy?: string;
  canRemove?: boolean;
  canAdmin?: boolean;
}
interface Detail {
  group: { id: string; name: string; isLeader: boolean };
  me?: { role: "leader" | "admin" | "member"; perms: GroupPerm[]; grantable: GroupPerm[]; seatsReady: boolean };
  program?: ProgramData;
  members: Member[];
  requests?: { displayName: string; username: string; avatarUrl: string | null }[];
  ranking: { ranked: BoardRow[]; unranked: { displayName: string; username: string; avatarUrl: string | null; mine: boolean }[]; min?: number };
  works: { id: string; title: string; details: string; cadence: "daily" | "once"; dueDate: string | null; mineDone: boolean; doneCount: number; memberCount: number }[];
  worksReady: boolean;
  today: string;
}
type Confirm = { kind: "remove" | "transfer"; m: Member } | { kind: "leave" | "delete" } | null;
type Tab = "home" | "program" | "stats" | "people";
const TABS: Tab[] = ["home", "program", "stats", "people"];

/**
 * One group, run like its own «لأجل المهدي»: its khatma, shared works and closed ranking; its program (projects and
 * habits its leaders build); every member's numbers and comparisons; its members, the admins under the leader and
 * their permissions. Each tool shows to whoever holds its permission (the leader holds them all).
 */
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
  const [workBusy, setWorkBusy] = useState<string | null>(null);
  const [workTitle, setWorkTitle] = useState("");
  const [workDetails, setWorkDetails] = useState("");
  const [workCadence, setWorkCadence] = useState<"daily" | "once">("daily");
  const [workDate, setWorkDate] = useState("");
  const [confirm, setConfirm] = useState<Confirm>(null);
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => {
    const want = params.get("tab") as Tab | null;
    return want && TABS.includes(want) ? want : "home";
  });
  const [perms, setPerms] = useState<{ m: Member; list: GroupPerm[] } | null>(null);
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

  async function toggleWork(work: Detail["works"][number]) {
    if (workBusy) return;
    setWorkBusy(work.id);
    setResult((current) => current ? { ...current, data: { ...current.data, works: current.data.works.map((item) => item.id === work.id ? { ...item, mineDone: !item.mineDone, doneCount: Math.max(0, item.doneCount + (item.mineDone ? -1 : 1)) } : item) } } : current);
    try {
      await mahdiFetch(`/api/mahdi/groups/${id}`, { method: "POST", json: { action: "work_toggle", workId: work.id, done: !work.mineDone } });
      toast(work.mineDone ? t.groups.workUndone : t.groups.workDone);
    } catch (e) {
      setReload((n) => n + 1);
      toast((e as Error).message);
    } finally {
      setWorkBusy(null);
    }
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
  // what I may do here (before migration 0083 the leader alone, as before)
  const mine = data.me?.perms ?? [];
  const may = (perm: GroupPerm) => group.isLeader || mine.includes(perm);
  const pickTab = (next: Tab) => {
    setTab(next);
    window.history.replaceState(null, "", next === "home" ? window.location.pathname : `?tab=${next}`);
  };

  return (
    <div className="space-y-6">
      <Link href="/mahdi/groups" className="m-btn m-btn-quiet m-btn-sm -ms-3">
        <Icon name="chevronRight" size={18} /> {t.groups.back}
      </Link>
      <header className="space-y-1">
        <p className="m-eyebrow">{t.groups.title}</p>
        <h1 className="m-display text-3xl">{group.name}</h1>
        <p className="m-num text-sm m-muted">{t.groups.members(active.length)}</p>
        {data.me?.role === "admin" && (
          <p className="text-sm">
            <span className="m-chip m-chip-gold">{t.groups.admin}</span> <span className="m-muted">{t.groups.admins.yours}: {mine.map((x) => t.groups.admins.short[x]).join("، ")}</span>
          </p>
        )}
      </header>

      <div className="m-card grid grid-cols-4 gap-1 p-1" role="tablist" aria-label={group.name}>
        {TABS.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={`min-h-10 rounded-xl px-2 text-sm font-semibold transition-colors ${tab === k ? "" : "m-muted"}`} style={tab === k ? { background: "var(--m-gold)", color: "var(--m-gold-ink)" } : undefined} onClick={() => pickTab(k)}>
            {t.groups.tabs[k]}
          </button>
        ))}
      </div>

      {tab === "program" && <GroupProgram groupId={id} program={data.program ?? { ready: false, projects: [], habits: [] }} canEdit={may("program")} onChanged={() => setReload((n) => n + 1)} />}
      {tab === "stats" && <GroupStats groupId={id} reload={reload} />}

      {tab === "home" && (<>

      <Link href={`/mahdi/khatma/${id}`} className="m-card flex items-center gap-3 p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl" style={{ background: "color-mix(in srgb, #16a34a 18%, transparent)", color: "#16a34a" }}>
          <Icon name="book" size={21} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{t.khatma.groupCard}</span>
          <span className="block text-sm m-muted">{t.khatma.groupCardHint}</span>
        </span>
        <Icon name="chevronLeft" size={18} />
      </Link>

      <section className="space-y-3" aria-labelledby="group-works">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl" style={{ background: "color-mix(in srgb, var(--m-gold) 16%, transparent)", color: "var(--m-gold)" }}>
            <Icon name="check" size={21} />
          </span>
          <span className="min-w-0 flex-1">
            <h2 id="group-works" className="text-lg font-semibold">{t.groups.worksTitle}</h2>
            <p className="text-sm m-muted">{t.groups.worksHint}</p>
          </span>
        </div>

        {!data.worksReady ? (
          <p className="m-note">{t.groups.worksNotReady}</p>
        ) : data.works.length === 0 ? (
          <p className="m-card p-5 text-center m-muted">{t.groups.worksEmpty}</p>
        ) : (
          <ul className="m-card divide-y" style={{ borderColor: "var(--m-line)" }}>
            {data.works.map((work) => (
              <li key={work.id} className="flex items-start gap-3 px-4 py-3">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={work.mineDone}
                  aria-label={work.title}
                  disabled={workBusy === work.id}
                  onClick={() => void toggleWork(work)}
                  className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full border-2 transition-all active:scale-90"
                  style={{ borderColor: work.mineDone ? "var(--m-gold)" : "var(--m-line)", background: work.mineDone ? "var(--m-gold)" : "transparent", color: "var(--m-bg, #fff)" }}
                >
                  {work.mineDone && <Icon name="check" size={18} />}
                </button>
                <span className="min-w-0 flex-1">
                  <span className={`block font-semibold ${work.mineDone ? "line-through m-muted" : ""}`}>{work.title}</span>
                  {work.details && <span className="mt-0.5 block whitespace-pre-line text-sm m-muted">{work.details}</span>}
                  <span className="m-num mt-1 flex flex-wrap gap-x-2 text-xs m-muted">
                    <span>{work.cadence === "daily" ? t.groups.workToday : t.groups.workOn(work.dueDate ?? "")}</span>
                    <span>· {t.groups.workProgress(work.doneCount, work.memberCount)}</span>
                  </span>
                  <span className="mt-2 block h-1.5 overflow-hidden rounded-full" style={{ background: "var(--m-track)" }}>
                    <span className="block h-full rounded-full transition-[width]" style={{ width: `${work.memberCount ? Math.round(work.doneCount / work.memberCount * 100) : 0}%`, background: "var(--m-gold)" }} />
                  </span>
                </span>
                {may("program") && (
                  <button type="button" className="m-icon-btn m-btn-ghost shrink-0" disabled={workBusy === work.id} aria-label={t.groups.workRemove} onClick={() => act({ action: "work_archive", workId: work.id }, t.groups.workArchived)}>
                    <Icon name="trash" size={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {may("program") && data.worksReady && (
          <form
            className="m-card space-y-3 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              act(
                { action: "work_create", title: workTitle, details: workDetails, cadence: workCadence, dueDate: workCadence === "once" ? workDate : null },
                t.groups.workCreated,
                () => (setWorkTitle(""), setWorkDetails(""), setReload((n) => n + 1)),
              );
            }}
          >
            <h3 className="font-semibold">{t.groups.workAdd}</h3>
            <input className="m-field" required maxLength={120} value={workTitle} onChange={(event) => setWorkTitle(event.target.value)} placeholder={t.groups.workTitlePlaceholder} aria-label={t.groups.workTitle} />
            <textarea className="m-field min-h-20 resize-y" maxLength={500} value={workDetails} onChange={(event) => setWorkDetails(event.target.value)} placeholder={t.groups.workDetailsPlaceholder} aria-label={t.groups.workDetails} />
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t.groups.workAdd}>
              {(["daily", "once"] as const).map((cadence) => (
                <button key={cadence} type="button" role="radio" aria-checked={workCadence === cadence} className="m-option min-h-11 px-3 font-semibold" onClick={() => (setWorkCadence(cadence), cadence === "once" && !workDate && setWorkDate(data.today))}>
                  {cadence === "daily" ? t.groups.workDaily : t.groups.workOnce}
                </button>
              ))}
            </div>
            {workCadence === "once" && (
              <label className="block">
                <span className="m-label">{t.groups.workDueDate}</span>
                <input type="date" className="m-field m-num" required min={data.today} value={workDate} onChange={(event) => setWorkDate(event.target.value)} />
              </label>
            )}
            <button className="m-btn m-btn-primary w-full" disabled={busy || !workTitle.trim() || (workCadence === "once" && !workDate)}>
              <Icon name="plus" size={18} /> {t.groups.workAdd}
            </button>
          </form>
        )}
      </section>

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

      </>)}

      {tab === "people" && (<>
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
                  {m.admin && <span className="m-chip m-chip-gold">{t.groups.admin}</span>}
                  {m.status === "invited" && <span className="m-chip">{t.groups.pending}</span>}
                </span>
                {m.admin && (m.perms?.length ?? 0) > 0 && (
                  <span className="mt-0.5 block text-xs m-muted">
                    {m.perms!.map((x) => t.groups.admins.short[x]).join("، ")}
                    {m.appointedBy && ` · ${t.groups.admins.by(m.appointedBy)}`}
                  </span>
                )}
              </span>
              {!m.mine && (group.isLeader || m.canRemove || m.canAdmin) && (
                <span className="flex flex-wrap gap-1">
                  {m.canAdmin && (
                    <button type="button" className="m-btn m-btn-quiet m-btn-sm" onClick={() => setPerms({ m, list: m.perms?.length ? m.perms : [] })}>
                      {m.admin ? t.groups.admins.edit : t.groups.admins.make}
                    </button>
                  )}
                  {group.isLeader && m.status === "active" && (
                    <button type="button" className="m-btn m-btn-quiet m-btn-sm" onClick={() => setConfirm({ kind: "transfer", m })}>{t.groups.makeLeader}</button>
                  )}
                  {(m.canRemove ?? group.isLeader) && <button type="button" className="m-btn m-btn-quiet m-btn-sm" onClick={() => setConfirm({ kind: "remove", m })}>{t.groups.remove}</button>}
                </span>
              )}
            </li>
          ))}
        </ul>

        {may("admins") && (
          <p className="m-note text-sm">
            <b>{t.groups.admins.title}:</b> {t.groups.admins.hint}
            {data.me && !data.me.seatsReady && ` ${t.groups.admins.notReady}`}
          </p>
        )}

        {may("members") && (data.requests?.length ?? 0) > 0 && (
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

        {may("members") && (
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

        {may("members") && (
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
        {may("settings") && (
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
      </>)}

      <Sheet open={Boolean(perms)} onClose={() => setPerms(null)} title={perms ? t.groups.admins.sheetTitle(perms.m.displayName) : ""}>
        {perms && (
          <div className="space-y-4">
            <p className="text-sm m-muted">{t.groups.admins.hint}</p>
            <ul className="space-y-2">
              {GROUP_PERMS.filter((x) => data.me?.grantable.includes(x) || group.isLeader).map((x) => (
                <li key={x}>
                  <label className="m-option flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2">
                    <input
                      type="checkbox"
                      className="size-5"
                      checked={perms.list.includes(x)}
                      onChange={() => setPerms((cur) => (cur ? { ...cur, list: cur.list.includes(x) ? cur.list.filter((y) => y !== x) : [...cur.list, x] } : cur))}
                    />
                    <span className="text-sm font-semibold">{t.groups.admins.perms[x]}</span>
                  </label>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="m-btn m-btn-primary w-full"
              disabled={busy || !perms.list.length}
              onClick={() => act({ action: "admin_set", username: perms.m.username, perms: perms.list }, t.groups.admins.saved, () => (setPerms(null), setReload((n) => n + 1)))}
            >
              {t.common.save}
            </button>
            {!perms.list.length && <p className="text-sm m-muted">{t.groups.admins.none}</p>}
            {perms.m.admin && (
              <button type="button" className="m-btn m-btn-danger w-full" disabled={busy} onClick={() => act({ action: "admin_remove", username: perms.m.username }, t.groups.admins.removed, () => (setPerms(null), setReload((n) => n + 1)))}>
                {t.groups.admins.remove}
              </button>
            )}
          </div>
        )}
      </Sheet>

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
