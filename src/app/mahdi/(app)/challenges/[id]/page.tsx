"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { summarize } from "@/lib/mahdi/engine";
import { fmtDate, fmtNum, fmtPct, t } from "@/lib/mahdi/i18n";
import { challengeAsHabit, describeGoal } from "@/lib/mahdi/client/derive";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import BoardList, { type BoardRow } from "@/components/mahdi/BoardList";
import ConfirmSheet from "@/components/mahdi/ConfirmSheet";
import Icon from "@/components/mahdi/Icon";
import { useMahdi } from "@/components/mahdi/Provider";

/** One unified challenge: its definition, joining and leaving, my progress, and the ranking of those who chose to appear. */
export default function ChallengePage() {
  const { id } = useParams<{ id: string }>();
  const { state, store, timeline, toast } = useMahdi();
  const { snap, today } = state;
  const c = snap.challenges.list.find((x) => x.id === id);
  const member = snap.challenges.memberships.find((m) => m.challengeId === id);
  const active = Boolean(member && !member.leftOn);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [board, setBoard] = useState<{ entries: BoardRow[]; total: number } | null>(null);
  const [boardError, setBoardError] = useState("");

  const [reload, setReload] = useState(0);
  const loadBoard = () => setReload((n) => n + 1);
  const hasBoard = Boolean(c?.leaderboard);
  useEffect(() => {
    if (!hasBoard) return;
    let live = true;
    mahdiFetch<{ entries: BoardRow[]; total: number }>(`/api/mahdi/challenges/${id}`)
      .then((res) => {
        if (!live) return;
        setBoard(res);
        setBoardError("");
      })
      .catch((e: Error) => live && setBoardError(e.message));
    return () => {
      live = false;
    };
  }, [id, hasBoard, reload]);

  if (!c) {
    return (
      <div className="m-card space-y-4 p-6 text-center">
        <p>{t.errors.notFound}</p>
        <Link href="/mahdi/challenges" className="m-btn m-btn-ghost">{t.challenges.back}</Link>
      </div>
    );
  }

  const section = snap.challenges.sections.find((s) => s.id === c.sectionId);
  const ended = Boolean(c.endsOn && c.endsOn < today);
  const v = challengeAsHabit(c, { joinedOn: c.startsOn, leftOn: null }).versions[0];
  const mine = summarize(timeline.byItem.get(`c:${id}`) ?? []);

  async function act(body: object, done?: string) {
    setBusy(true);
    try {
      await mahdiFetch(`/api/mahdi/challenges/${id}`, { method: "POST", json: body });
      await store.refresh(true);
      if (done) toast(done);
      if (c?.leaderboard) await loadBoard();
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      <Link href="/mahdi/challenges" className="m-btn m-btn-quiet m-btn-sm -ms-3">
        <Icon name="chevronRight" size={18} /> {t.challenges.back}
      </Link>

      <header className="space-y-2">
        <p className="m-eyebrow">{section?.icon} {section?.name}</p>
        <h1 className="m-display text-3xl">{c.title}</h1>
        {c.description && <p className="whitespace-pre-line">{c.description}</p>}
      </header>

      <section className="m-card space-y-3 p-5">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="m-eyebrow">{t.challenges.goal}</dt>
            <dd className="font-semibold">{describeGoal(v, snap.profile.weekStart)}</dd>
          </div>
          <div>
            <dt className="m-eyebrow">{t.challenges.periodLabel}</dt>
            <dd className="m-num font-semibold">{t.challenges.period(fmtDate(c.startsOn), c.endsOn ? fmtDate(c.endsOn) : null)}</dd>
          </div>
        </dl>
        {c.rules && (
          <div>
            <h2 className="m-eyebrow">{t.challenges.rules}</h2>
            <p className="whitespace-pre-line">{c.rules}</p>
          </div>
        )}
      </section>

      <section className="m-card space-y-4 p-5" aria-label={t.challenges.yourStatus}>
        {active ? (
          <>
            <p className="m-chip m-chip-success w-fit"><Icon name="check" size={14} /> {t.challenges.joined} · <span className="m-num">{fmtDate(member!.joinedOn)}</span></p>
            {mine.required > 0 ? (
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="m-soft p-3"><p className="m-num text-2xl font-semibold">{fmtPct(mine.score)}</p><p className="text-sm m-muted">{t.challenges.myScore}</p></div>
                <div className="m-soft p-3"><p className="m-num text-2xl font-semibold">{fmtNum(mine.achieved)}/{fmtNum(mine.required)}</p><p className="text-sm m-muted">{t.progress.goalsReached}</p></div>
                <div className="m-soft p-3"><p className="m-num text-2xl font-semibold">{fmtNum(mine.overCount)}</p><p className="text-sm m-muted">{t.progress.extra}</p></div>
              </div>
            ) : null}
            <p className="text-sm m-muted">{t.challenges.logHint}</p>

            {c.leaderboard && (
              <label className="flex min-h-12 items-start justify-between gap-4">
                <span>
                  <span className="block font-semibold">{t.challenges.showMe}</span>
                  {!snap.privacy.community && (
                    <span className="block text-sm m-muted">
                      {t.challenges.needCommunity} <Link href="/mahdi/more/privacy" className="m-gold underline">{t.privacy.title}</Link>
                    </span>
                  )}
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  className="mt-1 size-6 shrink-0 accent-[var(--m-gold)]"
                  checked={Boolean(member?.onLeaderboard) && snap.privacy.community}
                  disabled={busy || !snap.privacy.community}
                  onChange={(e) => act({ action: "leaderboard", on: e.target.checked }, e.target.checked ? t.leaderboard.shown : t.common.saved)}
                />
              </label>
            )}
            <button type="button" className="m-btn m-btn-ghost w-full" disabled={busy} onClick={() => setLeaving(true)}>{t.challenges.leave}</button>
          </>
        ) : ended ? (
          <p className="m-note">{t.challenges.ended}</p>
        ) : (
          <button type="button" className="m-btn m-btn-primary w-full" disabled={busy} onClick={() => act({ action: "join" }, t.challenges.joinedToast)}>
            <Icon name="plus" size={18} /> {t.challenges.join}
          </button>
        )}
      </section>

      {c.leaderboard ? (
        <section className="space-y-3" aria-labelledby="board-title">
          <h2 id="board-title" className="text-lg font-semibold">{t.challenges.ranking}</h2>
          <p className="text-sm m-muted">{t.challenges.rankingNote}</p>
          {boardError ? (
            <p className="m-error" role="alert">{boardError} <button type="button" className="underline" onClick={loadBoard}>{t.common.retry}</button></p>
          ) : !board ? (
            <p className="m-muted">{t.common.loading}</p>
          ) : board.entries.length ? (
            <BoardList entries={board.entries} label={t.challenges.ranking} />
          ) : (
            <p className="m-card p-5 text-center m-muted">{t.challenges.rankingEmpty}</p>
          )}
        </section>
      ) : (
        <p className="text-sm m-muted">{t.challenges.noRanking}</p>
      )}

      <ConfirmSheet
        open={leaving}
        onClose={() => setLeaving(false)}
        title={t.challenges.leaveTitle}
        body={t.challenges.leaveBody}
        confirmLabel={t.challenges.leave}
        onConfirm={async () => {
          await mahdiFetch(`/api/mahdi/challenges/${id}`, { method: "POST", json: { action: "leave" } });
          await store.refresh(true);
          toast(t.challenges.leftToast);
          if (c.leaderboard) loadBoard();
        }}
      />
    </div>
  );
}
