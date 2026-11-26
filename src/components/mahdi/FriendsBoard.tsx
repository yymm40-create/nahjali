"use client";

import { useEffect, useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import type { Privacy } from "@/lib/mahdi/types";
import BoardList, { type BoardRow } from "./BoardList";
import { useMahdi } from "./Provider";
import { Empty, ErrorState, Skeleton } from "./social/States";

const K = t.groups.kind;

interface Board {
  min: number;
  friends: number;
  total: number;
  entries: BoardRow[];
  me: BoardRow | null;
}

/**
 * «أنت وأصحابك هالأسبوع»: a small weekly ranking among friends (we follow each other), in place of the general
 * ranking that listed everyone down to the last (the plan of 26 November 2026). The first three and my own place.
 */
export default function FriendsBoard() {
  const { state, store, toast } = useMahdi();
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const joined = state.snap.privacy.community;
  const optedIn = state.snap.privacy.leaderboard;

  useEffect(() => {
    if (!joined) return;
    let live = true;
    mahdiFetch<Board>("/api/mahdi/leaderboard/friends")
      .then((b) => live && (setBoard(b), setError(false)))
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [joined, optedIn, reload]);

  if (!joined) return null;
  const onBoard = Boolean(board?.entries.some((e) => e.mine) || board?.me);

  return (
    <section className="space-y-3" aria-labelledby="friends-board">
      <div>
        <h2 id="friends-board" className="text-lg font-semibold">{K.friendsTitle}</h2>
        <p className="text-sm m-muted">{K.friendsHint}</p>
      </div>
      {!optedIn && (
        <div className="m-note flex flex-wrap items-center gap-3">
          <span className="flex-1 text-sm">{K.friendsHidden}</span>
          <button
            type="button"
            className="m-btn m-btn-ghost m-btn-sm"
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
      {error ? (
        <ErrorState message={K.boardError} onRetry={() => setReload((n) => n + 1)} />
      ) : !board ? (
        <Skeleton count={2} label={t.common.loading} />
      ) : board.entries.length ? (
        <>
          <BoardList entries={board.entries} me={board.me} label={K.friendsTitle} />
          {optedIn && !onBoard && <p className="text-sm m-muted">{K.notYet(board.min)}</p>}
        </>
      ) : (
        <Empty icon="users" title={K.friendsEmpty} />
      )}
    </section>
  );
}
