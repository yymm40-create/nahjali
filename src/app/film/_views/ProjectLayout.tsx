import { requireFilmUser, requireProject } from "@/lib/film/access";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import TeamCoin from "@/components/TeamCoin";
import { teamCoinBalance } from "@/lib/coins";
import { memberRights } from "@/lib/film/team";
import { rightsText } from "@/lib/film/team-rights";
import { credits } from "@/lib/film/credits";
import { impactsOf } from "@/lib/film/impact";
import { filmProgress } from "@/lib/film/progress";
import { projectCost } from "@/lib/film/usage";
import FilmNav from "../[id]/FilmNav";
import SajjadPanel from "../SajjadPanel";
import FilmStage from "../stage/FilmStage";
import ContinuityAlerts from "../series/ContinuityAlerts";
import { openAlerts, readWatch } from "@/lib/film/watch";

/**
 * Every page of a film project lives inside the scene's one shell («المشهد»: the steps' rail, the meter, the library,
 * سجاد). A scene of «المسلسل الذكي» keeps the series' own look and bar.
 */
export default async function ProjectLayoutView({ id, base, children }: { id: string; base: string; children: React.ReactNode }) {
  const { user, allowed } = await requireFilmUser(`${base}/${id}`);
  // Without access the page itself redirects
  if (!allowed) return children;
  const project = await requireProject(id, user.id);
  const { count } = await createAdminClient()
    .from("film_versions")
    .select("id", { count: "exact", head: true })
    .eq("project_id", id)
    .eq("kind", "dir_generation")
    .eq("status", "approved");

  if (!project.series_id) {
    const [progress, impacts, cost] = await Promise.all([filmProgress(project), impactsOf(project.id), projectCost(project.id)]);
    return (
      <FilmStage projectId={id} title={project.title} stage={project.stage} videosOpen={Boolean(count)} cost={credits(cost.total)} progress={progress} impacts={impacts}>
        {children}
        {/* سجاد: the consultant, who knows this film */}
        <SajjadPanel kind="film" id={id} />
      </FilmStage>
    );
  }

  // a scene of «المسلسل الذكي»: the way back to its series and episode
  let scene: { href: string; text: string; team: { balance: number; rights: string | null } | null } | null = null;
  // this scene's open continuity alerts from سجاد
  let alerts: ReturnType<typeof openAlerts> = [];
  if (project.series_id && project.episode_id) {
    const db = createAdminClient();
    const [{ data: s }, { data: e }] = await Promise.all([
      db.from("film_series").select("title,mode,watch").eq("id", project.series_id).maybeSingle(),
      db.from("film_episodes").select("number").eq("id", project.episode_id).maybeSingle(),
    ]);
    // a team series: what is made here comes out of «نقود الفريق الذكي», and a member sees what they may do
    let team: { balance: number; rights: string | null } | null = null;
    if (s?.mode === "team") {
      const [balance, r] = await Promise.all([teamCoinBalance(project.series_id).catch(() => 0), project.user_id === user.id ? null : memberRights(project.series_id, user.id)]);
      team = { balance, rights: r ? rightsText(r) : null };
    }
    if (s) scene = { href: `${base}/series/${project.series_id}`, text: `📺 ${s.title} · الحلقة ${e?.number ?? "؟"} · المشهد ${project.scene_number ?? "؟"}`, team };
    if (s) alerts = openAlerts(readWatch(s.watch), project.id);
  }
  return (
    <div className="space-y-5">
      {scene && (
        <div className="flex flex-wrap items-center gap-2">
          <Link href={scene.href} className="inline-flex items-center gap-1 rounded-full bg-[#0b1d47] px-3 py-1 text-xs font-extrabold text-white">
            → {scene.text}
          </Link>
          {scene.team && (
            <span className="team-wallet inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold text-white" title="كل شي ينصنع في هذا المشهد ينقص من نقود الفريق الذكي">
              <TeamCoin size={18} /> <span dir="ltr">{scene.team.balance.toLocaleString("en")}</span> نقدة فريق
            </span>
          )}
          {scene.team?.rights && <span className="chip text-xs">🔑 {scene.team.rights}</span>}
        </div>
      )}
      <FilmNav projectId={id} stage={project.stage} videosOpen={Boolean(count)} />
      {project.series_id && (alerts.length > 0 || project.stage !== "screenwriter") && (
        <ContinuityAlerts seriesId={project.series_id} sceneId={id} sceneKind="film" canAct alerts={alerts.map((a) => ({ ...a }))} />
      )}
      {children}
      {/* سجاد: the consultant, who knows this film (and its series) */}
      <SajjadPanel kind="film" id={id} />
    </div>
  );
}
