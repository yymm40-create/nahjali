"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fmtNum, t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import type { ReadChallenge, ReadPhase } from "@/lib/mahdi/read-challenge";
import Avatar from "@/components/mahdi/Avatar";
import Icon from "@/components/mahdi/Icon";
import ReadChallengeDetail from "@/components/mahdi/ReadChallengeDetail";

const R = t.readChallenge;
const MEDALS = ["🥇", "🥈", "🥉"];

interface Row {
  rank: number;
  displayName: string;
  avatarUrl: string | null;
  pages: number;
  days: number;
  mine: boolean;
  /** only for the owner: whose breakdown to open */
  id?: string;
  /** only for the owner: sessions that only repeated pages, or a very big day */
  flag?: { repeats: number; maxDay: number } | null;
}
interface Data {
  challenge: ReadChallenge | null;
  phase?: ReadPhase;
  day?: number;
  length?: number;
  left?: number;
  joined?: boolean;
  total?: number;
  board?: Row[];
  owner?: boolean;
}

/** «تحدي القراءة»: my place, the top three and the whole list (everyone who joined). */
export default function ReadChallengePage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  // whose breakdown is open: "me", or (the owner) a member's id
  const [detail, setDetail] = useState<{ who: string; name: string } | null>(null);

  const load = useCallback(() => {
    return mahdiFetch<Data>("/api/mahdi/read-challenge?board=1")
      .then((d) => {
        setData(d);
        setError("");
      })
      .catch((e) => setError((e as Error).message));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function join() {
    setBusy(true);
    try {
      await mahdiFetch("/api/mahdi/read-challenge", { method: "POST", json: { agree: true } });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) return <p className="m-error" role="alert">{error}</p>;
  if (!data) return <p className="m-muted">{t.common.loading}</p>;
  if (!data.challenge) return <p className="m-note">{R.none}</p>;

  const board = data.board ?? [];
  const me = board.find((r) => r.mine);
  const above = me ? board.filter((r) => r.pages > me.pages).at(-1) : undefined;
  const over = data.phase === "over";
  const winners = board.filter((r) => r.rank === 1 && r.pages > 0);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="m-display text-3xl">📖 {data.challenge.title}</h1>
        <p className="m-chip w-fit">
          {data.phase === "soon" ? R.soon(new Date(`${data.challenge.startsOn}T12:00:00Z`).toLocaleDateString("ar", { day: "numeric", month: "long", timeZone: "UTC" })) : over ? R.overChip : R.dayOf(data.day ?? 1, data.length ?? 7, data.left ?? 0)}
        </p>
        <p className="m-note">{R.howWins}</p>
      </header>

      {over && winners.length > 0 && (
        <section className="m-card space-y-1 p-5 text-center">
          <p className="text-4xl" aria-hidden="true">🏆</p>
          <p className="m-display m-gold text-2xl">{R.winner(winners.map((w) => w.displayName).join(" و "))}</p>
          <p className="m-muted">{R.pagesN(winners[0].pages)}</p>
        </section>
      )}

      {data.joined ? (
        me && (
          <section className="m-card space-y-2 p-5" aria-labelledby="my-place">
            <h2 id="my-place" className="font-semibold">{R.myPlace}</h2>
            <p className="m-display m-gold text-4xl">
              {R.rankOf(me.rank, data.total ?? board.length)}
            </p>
            <p>{R.myPages(me.pages, me.days)}</p>
            {!over && (above ? <p className="m-muted text-sm">{R.toNext(above.pages - me.pages + 1, above.rank)}</p> : me.pages > 0 && <p className="m-muted text-sm">{R.onTop}</p>)}
            {!over && (
              <Link href="/mahdi/reading" className="m-btn m-btn-primary m-btn-sm w-fit">
                <Icon name="book" size={18} /> {R.readNow}
              </Link>
            )}
          </section>
        )
      ) : (
        !over && (
          <section className="m-card space-y-3 p-5">
            <ul className="m-muted list-disc space-y-1 ps-5 text-sm">
              {R.rules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <label className="m-option flex items-start gap-3 p-3">
              <input type="checkbox" className="mt-1 size-5 shrink-0" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <span className="font-semibold">{R.consent}</span>
            </label>
            {error && <p className="m-error" role="alert">{error}</p>}
            <button type="button" className="m-btn m-btn-primary w-full" disabled={!agree || busy} onClick={join}>
              {busy ? t.common.saving : R.join}
            </button>
          </section>
        )
      )}

      <section className="space-y-3" aria-labelledby="board">
        <div className="flex items-center justify-between gap-3">
          <h2 id="board" className="text-xl font-semibold">{R.boardTitle(data.total ?? board.length)}</h2>
          <button type="button" className="m-btn m-btn-ghost m-btn-sm" onClick={() => load()}>
            {R.refresh}
          </button>
        </div>
        {board.length === 0 ? (
          <p className="m-note">{R.empty}</p>
        ) : (
          <ol className="m-card divide-y divide-[var(--m-line)] overflow-hidden">
            {board.map((r, i) => (
              <li
                key={`${r.rank}-${i}`}
                style={r.mine ? { background: "color-mix(in srgb, var(--m-gold) 16%, transparent)" } : undefined}
                aria-current={r.mine ? "true" : undefined}
              >
                {/* my own line (or anyone's, for the owner) opens what my pages are made of */}
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-3 text-start disabled:cursor-default"
                  disabled={!r.mine && !r.id}
                  onClick={() => setDetail({ who: r.mine ? "me" : r.id!, name: r.displayName })}
                  aria-label={r.mine || r.id ? R.detail.open(r.displayName) : undefined}
                >
                <span className="m-num w-9 shrink-0 text-center text-lg font-bold">{r.pages > 0 && r.rank <= 3 ? MEDALS[r.rank - 1] : fmtNum(r.rank)}</span>
                <Avatar profile={{ displayName: r.displayName, avatarUrl: r.avatarUrl }} size={36} />
                <span className="min-w-0 flex-1 truncate font-semibold" dir="auto">
                  {r.displayName}
                  {r.mine && <span className="m-gold"> · {R.you}</span>}
                  {r.flag && <span className="block text-xs font-normal" style={{ color: "var(--m-error)" }}>⚠️ {R.flag(r.flag.repeats, r.flag.maxDay)}</span>}
                </span>
                <span className="m-num shrink-0 text-end">
                  <b>{fmtNum(r.pages)}</b> <span className="m-muted text-sm">{R.pageWord}</span>
                </span>
                {(r.mine || r.id) && <Icon name="chevronLeft" size={16} className="m-muted shrink-0" />}
                </button>
              </li>
            ))}
          </ol>
        )}
        {board.some((r) => r.mine) && <p className="text-xs m-muted">{R.detail.tapHint}</p>}
      </section>
      {detail && <ReadChallengeDetail who={detail.who} name={detail.name} onClose={() => setDetail(null)} onChanged={() => void load()} />}
    </div>
  );
}
