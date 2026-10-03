"use client";

import { fmtNum, fmtPct, t } from "@/lib/mahdi/i18n";
import { duration } from "@/lib/mahdi/client/reading";
import Avatar from "./Avatar";

export interface BoardRow {
  rank: number;
  displayName: string;
  avatarUrl: string | null;
  frame: string;
  /** 0…1 (commitment rankings) */
  score?: number;
  goals?: number;
  overCount?: number;
  /** Reading rankings */
  seconds?: number;
  pages?: number;
  username?: string;
  mine: boolean;
}

/** A ranking: place, name, percent of goals reached, and extra work shown apart from the percent. */
export default function BoardList({ entries, me, label }: { entries: BoardRow[]; me?: BoardRow | null; label: string }) {
  const row = (e: BoardRow, key: string) => (
    <li key={key} className={`flex items-center gap-3 px-3 py-3 ${e.mine ? "m-soft" : ""}`} aria-current={e.mine ? "true" : undefined}>
      <span className="m-num w-8 shrink-0 text-center text-lg font-semibold" style={{ color: e.rank <= 3 ? "var(--m-gold-text)" : undefined }} aria-label={`${t.leaderboard.rank} ${e.rank}`}>
        {fmtNum(e.rank)}
      </span>
      <Avatar profile={e} size={38} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">
          {t.mawla(e.displayName)}
          {e.mine && <span className="m-chip m-chip-gold ms-2">{t.leaderboard.you}</span>}
        </span>
        <span className="m-num block text-sm m-muted">
          {e.username && <span dir="ltr">@{e.username} · </span>}
          {e.seconds !== undefined ? t.reading.pages(e.pages ?? 0) : t.units.goals(e.goals ?? 0)}
          {(e.overCount ?? 0) > 0 && ` · ${t.leaderboard.extra}: ${fmtNum(e.overCount!)}`}
        </span>
      </span>
      <span className="m-num text-xl font-semibold">{e.seconds !== undefined ? duration(e.seconds) : fmtPct(e.score ?? null)}</span>
    </li>
  );
  return (
    <div className="m-card overflow-hidden">
      <ol aria-label={label} className="divide-y" style={{ borderColor: "var(--m-line)" }}>
        {entries.map((e) => row(e, `${e.rank}-${e.displayName}-${e.mine}`))}
        {me && (
          <>
            <li aria-hidden="true" className="m-muted px-3 py-1 text-center">…</li>
            {row(me, "me")}
          </>
        )}
      </ol>
    </div>
  );
}
