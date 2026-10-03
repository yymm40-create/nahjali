"use client";

import { useEffect, useState } from "react";
import { fmtNum, t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import type { Privacy } from "@/lib/mahdi/types";
import BoardList, { type BoardRow } from "./BoardList";
import { useMahdi } from "./Provider";

interface Board {
  min: number;
  total: number;
  entries: BoardRow[];
  me: BoardRow | null;
}

/** The general ranking, by week or month. Shows how it is computed and lets the user opt in. */
export default function LeaderboardTab() {
  const { state, store, toast } = useMahdi();
  const [period, setPeriod] = useState<"week" | "month">("week");
  // The answer is stored with the period it belongs to, so switching tabs shows «جارٍ التحميل» without extra state
  const [result, setResult] = useState<{ period: "week" | "month"; board: Board } | null>(null);
  const [failed, setFailed] = useState<{ period: "week" | "month"; message: string } | null>(null);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const optedIn = state.snap.privacy.leaderboard;

  useEffect(() => {
    let live = true;
    mahdiFetch<Board>(`/api/mahdi/leaderboard?period=${period}`)
      .then((board) => live && (setResult({ period, board }), setFailed(null)))
      .catch((e: Error) => live && setFailed({ period, message: e.message }));
    return () => {
      live = false;
    };
  }, [period, optedIn, reload]);
  const board = result?.period === period ? result.board : null;
  const error = failed?.period === period ? failed.message : "";

  const onBoard = Boolean(board?.entries.some((e) => e.mine) || board?.me);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t.leaderboard.title}>
        {(["week", "month"] as const).map((p) => (
          <button key={p} type="button" role="radio" aria-checked={period === p} className="m-option min-h-11 px-3 font-semibold" onClick={() => setPeriod(p)}>
            {t.leaderboard[p]}
          </button>
        ))}
      </div>
      <p className="text-sm m-muted">{t.leaderboard.how}</p>
      <p className="text-sm m-muted">{t.leaderboard.min(board?.min ?? (period === "week" ? 7 : 20))} {t.leaderboard.note}</p>

      {!optedIn && (
        <div className="m-note flex flex-wrap items-center gap-3">
          <span className="flex-1">{t.leaderboard.hidden}</span>
          <button
            type="button"
            className="m-btn m-btn-primary m-btn-sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const { privacy } = await mahdiFetch<{ privacy: Privacy }>("/api/mahdi/privacy", { method: "PATCH", json: { leaderboard: true } });
                store.setSnapPart({ privacy });
                toast(t.leaderboard.shown);
              } catch (e) {
                toast((e as Error).message);
              }
              setBusy(false);
            }}
          >
            {t.leaderboard.optIn}
          </button>
        </div>
      )}
      {optedIn && board && !onBoard && <p className="m-note">{t.leaderboard.notYet(board.min)}</p>}

      {error ? (
        <p className="m-error" role="alert">
          {error} <button type="button" className="underline" onClick={() => setReload((n) => n + 1)}>{t.common.retry}</button>
        </p>
      ) : !board ? (
        <p className="m-muted">{t.common.loading}</p>
      ) : board.entries.length ? (
        <BoardList entries={board.entries} me={board.me} label={`${t.leaderboard.list}: ${t.leaderboard[period]} (${fmtNum(board.total)})`} />
      ) : (
        <p className="m-card p-6 text-center m-muted">{t.leaderboard.empty}</p>
      )}
    </div>
  );
}
