"use client";

// The site's owner: every game with its counter (opens, players, minutes, last played, its maker), the most played first;
// a row opens that game's full numbers.

import { useEffect, useState } from "react";
import GameStats from "@/components/jawad/games/GameStats";
import { api } from "@/lib/fetch";
import type { GameStatsRow } from "@/lib/games/plays";

export default function GamesPlays() {
  const [d, setD] = useState<{ ready: boolean; games: GameStatsRow[] } | null>(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    let on = true;
    api<{ ready: boolean; games: GameStatsRow[] }>("/api/games/admin?plays=1")
      .then((r) => on && setD(r))
      .catch((e) => on && setErr(e instanceof Error ? e.message : "تعذّر التحميل."));
    return () => {
      on = false;
    };
  }, []);
  return (
    <section className="card space-y-3 p-4">
      <h2 className="text-xl font-extrabold">📊 مين لعب الألعاب</h2>
      <p className="text-sm font-bold text-muted">كل مرة انفتحت فيها لعبة، وكم لاعب مختلف، وكم دقيقة لعبوا. لعب صاحب اللعبة نفسه ما ينحسب، والعدّ يبدأ من يوم ما تشغّل هجرة 0082.</p>
      {err && <p className="text-sm font-bold text-red-600">{err}</p>}
      {!d && !err && <p className="text-sm font-bold text-muted">جاري التحميل…</p>}
      {d && !d.ready && <p className="text-sm font-bold text-red-600">جدول العدّاد مو موجود. شغّل هجرة supabase/migrations/0082_game_plays.sql في Supabase.</p>}
      {d?.ready && !d.games.length && <p className="text-sm font-bold text-muted">لسا محد لعب أي لعبة من يوم ما بدأ العدّ.</p>}
      {d?.ready && d.games.length > 0 && (
        <ul className="space-y-2">
          {d.games.map((g) => (
            <li key={g.id} className="rounded-xl border border-line p-3 text-sm">
              <button type="button" className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-start" onClick={() => setOpen(open === g.id ? null : g.id)} aria-expanded={open === g.id}>
                <b className="min-w-0 flex-1 truncate">{g.title || "لعبة"}</b>
                <span>👁 {g.opens}</span>
                <span>🎮 {g.players} لاعب</span>
                <span>⏱ {Math.round(g.minutes)} د</span>
                <span className="text-xs text-muted">{g.owner}</span>
                <a className="text-xs text-teal underline" href={`/play/${g.id}`} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}>افتح ↗</a>
              </button>
              {open === g.id && <GameStats id={g.id} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
