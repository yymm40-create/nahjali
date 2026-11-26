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
import PageHead from "@/components/mahdi/social/PageHead";
import { Empty, ErrorState, Skeleton } from "@/components/mahdi/social/States";
import type { SteadyRow } from "@/lib/mahdi/groups/kind";
import GroupStats from "@/components/mahdi/groups/GroupStats";
import VisibilityChoice from "@/components/mahdi/groups/VisibilityChoice";
import type { GroupVisibility } from "@/lib/mahdi/groups/privacy";
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
  /** «ذكّرته بلطف» today already (undefined: not for this member — me, or not active) */
  nudged?: boolean;
}
interface Detail {
  group: { id: string; name: string; isLeader: boolean };
  /** who sees each member's progress; before SQL 0129 `ready` is false and everyone sees, as before */
  privacy?: { visibility: GroupVisibility; ready: boolean; full: boolean; canChange: boolean };
  me?: { role: "leader" | "admin" | "member"; perms: GroupPerm[]; grantable: GroupPerm[]; seatsReady: boolean };
  program?: ProgramData;
  members: Member[];
  requests?: { displayName: string; username: string; avatarUrl: string | null }[];
  /** small for everyone: the first places and my own (`me`, when I am below them); `unranked` is only ever me */
  ranking: { ranked: BoardRow[]; me?: BoardRow | null; total?: number; unranked: { displayName: string; username: string; avatarUrl: string | null; mine: boolean }[]; min?: number; onlyMine?: boolean };
  /** «أهل الثبات»: only who earned it (in a private group, only me) */
  steady?: SteadyRow[];
  /** SQL 0135 is in the database («ذكّرته بلطف») */
  nudgesReady?: boolean;
  // in a private group a member gets only their own tick (no counts); the leaders also get who did it
  works: { id: string; title: string; details: string; cadence: "daily" | "once"; dueDate: string | null; mineDone: boolean; doneCount: number | null; memberCount: number | null; doneBy?: string[] }[];
  worksReady: boolean;
  today: string;
}
type Confirm = { kind: "remove" | "transfer"; m: Member } | { kind: "leave" | "delete" } | null;
type Tab = "home" | "program" | "stats" | "people";
const TABS: Tab[] = ["home", "program", "stats", "people"];

/**
 * One group, run like its own «لأجل المهدي»: «اليوم» (its khatma, shared works, a small weekly ranking and «أهل
 * الثبات»), its program, every member's numbers, and its members («ذكّرته بلطف» once a day; each member's commands
 * behind «⋯»). The settings live in a sheet. Each tool shows to whoever holds its permission (the leader holds them
 * all); in a private group a member never sees the others' progress (PR 838).
 */
export default function GroupPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useMahdi();
  // the group ranking is a small weekly one (the plan of 26 November 2026)
  const period = "week";
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
  const [settings, setSettings] = useState(false);
  const [addingWork, setAddingWork] = useState(false);
  const [member, setMember] = useState<Member | null>(null);
  const [nudging, setNudging] = useState<string | null>(null);
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
    setResult((current) => current ? { ...current, data: { ...current.data, works: current.data.works.map((item) => item.id === work.id ? { ...item, mineDone: !item.mineDone, doneCount: item.doneCount === null ? null : Math.max(0, item.doneCount + (item.mineDone ? -1 : 1)) } : item) } } : current);
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

  // «ذكّرته بلطف»: once a day to another member; says nothing about how they are doing
  async function nudge(m: Member) {
    if (nudging) return;
    setNudging(m.username);
    try {
      await mahdiFetch(`/api/mahdi/groups/${id}`, { method: "POST", json: { action: "nudge", username: m.username } });
      setResult((cur) => (cur ? { ...cur, data: { ...cur.data, members: cur.data.members.map((x) => (x.username === m.username ? { ...x, nudged: true } : x)) } } : cur));
      toast(t.groups.kind.nudgeSent);
    } catch (e) {
      toast((e as Error).message);
    }
    setNudging(null);
  }

  if (error && !data) {
    return (
      <ErrorState message={error} onRetry={() => setReload((n) => n + 1)}>
        <Link href="/mahdi/groups" className="m-btn m-btn-quiet m-btn-sm">{t.groups.back}</Link>
      </ErrorState>
    );
  }
  if (!data)
    return (
      <div className="space-y-4" role="status" aria-label={t.common.loading}>
        <div className="m-skel h-9 w-1/2" />
        <div className="m-skel h-11" />
        <Skeleton count={3} label={t.common.loading} />
      </div>
    );
  const { group, members, ranking } = data;
  const isPrivate = data.privacy?.visibility === "leaders";
  const active = members.filter((m) => m.status === "active");
  const invited = members.filter((m) => m.status === "invited");
  // what I may do here (before migration 0083 the leader alone, as before)
  const mine = data.me?.perms ?? [];
  const may = (perm: GroupPerm) => group.isLeader || mine.includes(perm);
  const K = t.groups.kind;
  const full = data.privacy ? data.privacy.full : true;
  const steady = data.steady ?? [];
  const mySteady = steady.find((x) => x.mine);
  const meUnranked = ranking.unranked.find((u) => u.mine);
  // the commands a member's «⋯» holds (for those who may act on them)
  const hasCommands = (m: Member) => !m.mine && (m.canAdmin || (group.isLeader && m.status === "active") || (m.canRemove ?? group.isLeader));
  const pickTab = (next: Tab) => {
    setTab(next);
    window.history.replaceState(null, "", next === "home" ? window.location.pathname : `?tab=${next}`);
  };

  return (
    <div className="space-y-6">
      <PageHead
        eyebrow={t.groups.title}
        title={group.name}
        sub={
          <>
            <span className="m-num">{t.groups.members(active.length)}</span>
            {data.me?.role === "admin" && (
              <span className="mt-1 block">
                <span className="m-chip m-chip-gold">{t.groups.admin}</span> {t.groups.admins.yours}: {mine.map((x) => t.groups.admins.short[x]).join("، ")}
              </span>
            )}
          </>
        }
      >
        <button type="button" className="m-icon-btn" aria-label={K.settings} aria-haspopup="dialog" onClick={() => setSettings(true)}>
          <Icon name="settings" size={22} />
        </button>
      </PageHead>
      {isPrivate && <p className="m-note text-sm">{data.privacy?.full ? t.groups.privacy.leaderNote : t.groups.privacy.memberNote}</p>}

      <div className="grid grid-cols-4 gap-1.5" role="tablist" aria-label={group.name}>
        {TABS.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className="m-option min-h-11 px-1 text-sm font-semibold" onClick={() => pickTab(k)}>
            {k === "home" ? K.today : t.groups.tabs[k]}
          </button>
        ))}
      </div>

      {tab === "program" && <GroupProgram groupId={id} program={data.program ?? { ready: false, projects: [], habits: [] }} canEdit={may("program")} onChanged={() => setReload((n) => n + 1)} />}
      {tab === "stats" && <GroupStats groupId={id} reload={reload} />}

      {tab === "home" && (<>

      <Link href={`/mahdi/khatma/${id}`} className="m-card flex items-center gap-3 p-4">
        <span className="m-row-ic" aria-hidden="true">
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
          <span className="min-w-0 flex-1">
            <h2 id="group-works" className="text-lg font-semibold">{t.groups.worksTitle}</h2>
            <p className="text-sm m-muted">{t.groups.worksHint}</p>
          </span>
          {may("program") && data.worksReady && (
            <button type="button" className="m-btn m-btn-primary m-btn-sm shrink-0" onClick={() => setAddingWork(true)}>
              <Icon name="plus" size={18} /> {t.groups.workAdd}
            </button>
          )}
        </div>

        {!data.worksReady ? (
          <p className="m-note">{t.groups.worksNotReady}</p>
        ) : data.works.length === 0 ? (
          <Empty icon="check" title={t.groups.worksEmpty} />
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
                  style={{ borderColor: work.mineDone ? "var(--m-gold)" : "var(--m-line)", background: work.mineDone ? "var(--m-gold)" : "transparent", color: "var(--m-gold-ink)" }}
                >
                  {work.mineDone && <Icon name="check" size={18} />}
                </button>
                <span className="min-w-0 flex-1">
                  <span className={`block font-semibold ${work.mineDone ? "line-through m-muted" : ""}`}>{work.title}</span>
                  {work.details && <span className="mt-0.5 block whitespace-pre-line text-sm m-muted">{work.details}</span>}
                  <span className="m-num mt-1 flex flex-wrap gap-x-2 text-xs m-muted">
                    <span>{work.cadence === "daily" ? t.groups.workToday : t.groups.workOn(work.dueDate ?? "")}</span>
                    {work.doneCount !== null && work.memberCount !== null ? <span>· {t.groups.workProgress(work.doneCount, work.memberCount)}</span> : <span>· {t.groups.privacy.workMine}</span>}
                  </span>
                  {work.doneCount !== null && work.memberCount !== null && (
                    <span className="mt-2 block h-1.5 overflow-hidden rounded-full" style={{ background: "var(--m-track)" }}>
                      <span className="block h-full rounded-full transition-[width]" style={{ width: `${work.memberCount ? Math.round(work.doneCount / work.memberCount * 100) : 0}%`, background: "var(--m-gold)" }} />
                    </span>
                  )}
                  {work.doneBy && <span className="mt-1 block text-xs m-muted">{work.doneBy.length ? t.groups.privacy.doneBy(work.doneBy.join("، ")) : t.groups.privacy.doneByNone}</span>}
                </span>
                {may("program") && (
                  <button type="button" className="m-icon-btn shrink-0 m-muted" disabled={workBusy === work.id} aria-label={t.groups.workRemove} onClick={() => act({ action: "work_archive", workId: work.id }, t.groups.workArchived)}>
                    <Icon name="trash" size={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="steady">
        <div>
          <h2 id="steady" className="text-lg font-semibold">{K.steadyTitle}</h2>
          <p className="text-sm m-muted">{K.steadyHint}</p>
        </div>
        {!full ? (
          mySteady ? (
            <p className="m-card flex items-center gap-3 p-4 font-semibold">
              <span className="m-empty-ic !size-10 !rounded-2xl" aria-hidden="true"><Icon name="star" size={20} /></span>
              {K.steadyMine}
            </p>
          ) : null
        ) : steady.length ? (
          <ul className="m-card divide-y" style={{ borderColor: "var(--m-line)" }} aria-label={K.steadyTitle}>
            {steady.map((x) => (
              <li key={x.username || x.displayName} className="flex items-center gap-3 px-4 py-3">
                <Avatar profile={x} size={34} />
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {t.mawla(x.displayName)}
                  {x.mine && <span className="m-chip m-chip-gold ms-2">{t.leaderboard.you}</span>}
                </span>
                <span className="m-chip m-chip-gold m-num shrink-0"><Icon name="star" size={14} /> {K.steadyDays(x.days)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm m-muted">{K.steadyEmpty}</p>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="rank">
        <div>
          <h2 id="rank" className="text-lg font-semibold">{K.weekTitle}</h2>
          <p className="text-sm m-muted">{ranking.onlyMine ? t.groups.privacy.rankingMine : K.weekHint}</p>
        </div>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t.leaderboard.metric}>
          {(["score", "reading"] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={metric === m} className="m-option min-h-10 px-3 text-sm font-semibold" onClick={() => setMetric(m)}>
              {m === "score" ? t.groups.metricScore : t.groups.metricReading}
            </button>
          ))}
        </div>
        <div className={fresh ? "" : "opacity-60"} aria-busy={!fresh}>
          {ranking.ranked.length > 0 || ranking.me ? (
            <BoardList entries={ranking.ranked} me={ranking.me ?? null} label={K.weekTitle} />
          ) : !meUnranked ? (
            <Empty icon="progress" title={t.leaderboard.empty} />
          ) : null}
          {meUnranked && <p className="mt-3 text-sm m-muted">{K.notYet(ranking.min ?? 7)}</p>}
        </div>
      </section>

      </>)}

      {tab === "people" && (<>
      <section className="space-y-3" aria-labelledby="members">
        <h2 id="members" className="text-lg font-semibold">{t.groups.membersTitle}</h2>
        <ul className="m-card divide-y" style={{ borderColor: "var(--m-line)" }}>
          {[...active, ...invited].map((m) => (
            <li key={m.username || m.displayName} className="flex items-center gap-3 px-4 py-3">
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
              {data.nudgesReady && m.nudged !== undefined && (
                <button
                  type="button"
                  className="m-btn m-btn-quiet m-btn-sm shrink-0"
                  disabled={m.nudged || nudging === m.username}
                  aria-pressed={m.nudged}
                  onClick={() => void nudge(m)}
                >
                  {m.nudged ? <><Icon name="check" size={16} /> {K.nudged}</> : <><Icon name="bell" size={16} /> {K.nudge}</>}
                </button>
              )}
              {hasCommands(m) && (
                <button type="button" className="m-icon-btn shrink-0 m-muted" aria-label={t.mawla(m.displayName)} aria-haspopup="dialog" onClick={() => setMember(m)}>
                  <Icon name="more" size={22} />
                </button>
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
                  <button type="button" className="m-btn m-btn-ghost m-btn-sm" disabled={busy} onClick={() => act({ action: "approve", username: r.username }, t.groups.approved)}>{t.groups.approve}</button>
                  <button type="button" className="m-btn m-btn-quiet m-btn-sm" disabled={busy} onClick={() => act({ action: "reject", username: r.username }, t.groups.rejected)}>{t.groups.reject}</button>
                </li>
              ))}
            </ul>
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
                  <button type="button" className="m-btn m-btn-ghost" onClick={() => navigator.clipboard?.writeText(link).then(() => toast(t.groups.linkCopied)).catch(() => {})}>{t.groups.linkCopy}</button>
                  <button type="button" className="m-btn m-btn-ghost" onClick={() => (navigator.share ? navigator.share({ title: group.name, url: link }).catch(() => {}) : navigator.clipboard?.writeText(link).then(() => toast(t.groups.linkCopied)))}>{t.groups.linkShare}</button>
                </div>
                <button type="button" className="m-btn m-btn-quiet m-btn-sm" onClick={() => getLink(true)}>{t.groups.linkReset}</button>
              </div>
            )}
          </div>
        )}
      </section>
      </>)}

      {/* the group's settings: who sees the progress, the name, and leaving or deleting */}
      <Sheet open={settings} onClose={() => setSettings(false)} title={K.settings}>
        <div className="space-y-4">
          {group.isLeader && data.privacy && (
            <VisibilityChoice
              value={data.privacy.visibility}
              disabled={!data.privacy.canChange}
              busy={busy}
              note={data.privacy.ready ? t.groups.privacy.leaderOnly : t.groups.privacy.notReady}
              onChange={(v) => v !== data.privacy?.visibility && act({ action: "privacy", visibility: v }, t.groups.privacy.saved)}
            />
          )}
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
            <button type="button" className="m-btn m-btn-danger w-full justify-start" onClick={() => (setSettings(false), setConfirm({ kind: "delete" }))}>
              <Icon name="trash" /> {t.groups.delete}
            </button>
          ) : (
            <button type="button" className="m-btn m-btn-danger w-full justify-start" onClick={() => (setSettings(false), setConfirm({ kind: "leave" }))}>
              <Icon name="logout" /> {t.groups.leave}
            </button>
          )}
          {group.isLeader && <p className="text-sm m-muted">{t.groups.leaderLeave}</p>}
          <p className="m-num text-center text-xs m-muted">{fmtNum(members.length)} / 50</p>
        </div>
      </Sheet>

      {/* one member's commands («⋯»): permissions, the leadership, removing */}
      <Sheet open={Boolean(member)} onClose={() => setMember(null)} title={member ? t.mawla(member.displayName) : ""}>
        {member && (
          <div className="m-card m-rows">
            {member.canAdmin && (
              <button type="button" className="m-row w-full text-start" onClick={() => (setMember(null), setPerms({ m: member, list: member.perms?.length ? member.perms : [] }))}>
                <span className="m-row-ic" aria-hidden="true"><Icon name="shield" size={20} /></span>
                {member.admin ? t.groups.admins.edit : t.groups.admins.make}
              </button>
            )}
            {group.isLeader && member.status === "active" && (
              <button type="button" className="m-row w-full text-start" onClick={() => (setMember(null), setConfirm({ kind: "transfer", m: member }))}>
                <span className="m-row-ic" aria-hidden="true"><Icon name="star" size={20} /></span>
                {t.groups.makeLeader}
              </button>
            )}
            {(member.canRemove ?? group.isLeader) && (
              <button type="button" className="m-row w-full text-start" style={{ color: "var(--m-error)" }} onClick={() => (setMember(null), setConfirm({ kind: "remove", m: member }))}>
                <span className="m-row-ic" aria-hidden="true"><Icon name="logout" size={20} /></span>
                {t.groups.remove}
              </button>
            )}
          </div>
        )}
      </Sheet>

      {/* adding a shared work: the screen's one primary action for whoever holds «البرنامج» */}
      <Sheet open={addingWork} onClose={() => setAddingWork(false)} title={t.groups.workAdd}>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            act(
              { action: "work_create", title: workTitle, details: workDetails, cadence: workCadence, dueDate: workCadence === "once" ? workDate : null },
              t.groups.workCreated,
              () => (setWorkTitle(""), setWorkDetails(""), setAddingWork(false), setReload((n) => n + 1)),
            );
          }}
        >
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
      </Sheet>

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
