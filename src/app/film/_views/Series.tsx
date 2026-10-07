import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import "@/app/jawad-ai/film/film-theme.css";
import { requireFilmUser } from "@/lib/film/access";
import { episodesOf, membersOf, openSeries, scenesOf, teamWallet } from "@/lib/film/series";
import { memberRights } from "@/lib/film/team";
import TeamWallet from "../series/TeamWallet";
import { FILM_STAGES } from "@config/film";
import SeriesBoard from "../series/SeriesBoard";
import SeriesTeam from "../series/SeriesTeam";

/** One series: its episodes, each with its scenes (small squares on top, the scenes' cards below), and its team. */
export default async function SeriesView({ id, base }: { id: string; base: string }) {
  const { user, allowed } = await requireFilmUser(`${base}/series/${id}`);
  if (!allowed) redirect(base);
  const open = await openSeries(id, user.id);
  if (!open) notFound();
  const { series, owner } = open;
  const [episodes, scenes, members, wallet, mine] = await Promise.all([
    episodesOf(series.id),
    scenesOf(series.id),
    owner ? membersOf(series.id) : Promise.resolve([]),
    teamWallet(series.id),
    owner ? Promise.resolve(null) : memberRights(series.id, user.id),
  ]);
  const stage = (k: string) => FILM_STAGES.find((s) => s.key === k);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link href={`${base}/series`} className="text-sm font-bold text-muted">→ المسلسل الذكي</Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="display text-4xl">📺 {series.title}</h1>
          <span className="chip">{series.mode === "team" ? "👥 فريق" : "👤 فردي"}</span>
        </div>
        {series.about && <p className="whitespace-pre-wrap text-sm font-bold leading-7 text-muted">{series.about}</p>}
        {!owner && <p className="rounded-2xl bg-gold/15 p-3 text-sm font-bold">أنت في فريق هذا المسلسل: تشتغل على مشاهده بالصلاحيات اللي أعطاك إياها صاحبه، وكل شي تصنعه ينقص من «نقود الفريق الذكي».</p>}
      </header>

      {/* the team's own coins (in individual mode only while something is left in it, to take it back) */}
      {(series.mode === "team" || wallet.balance > 0) && <TeamWallet seriesId={series.id} owner={owner} balance={wallet.balance} ledger={wallet.ledger} />}

      <SeriesBoard
        seriesId={series.id}
        owner={owner}
        episodes={episodes.map((e) => ({
          id: e.id,
          number: e.number,
          title: e.title,
          scenes: (scenes.get(e.id) ?? []).map((s) => ({ ...s, icon: stage(s.stage)?.icon ?? "🎞️", stageLabel: stage(s.stage)?.label ?? s.stage })),
        }))}
      />

      <SeriesTeam seriesId={series.id} owner={owner} mode={series.mode} members={members} mine={mine} />
    </div>
  );
}
