import { requireFilmUser, requireProject } from "@/lib/film/access";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import TeamCoin from "@/components/TeamCoin";
import { teamCoinBalance } from "@/lib/coins";
import { memberRights } from "@/lib/film/team";
import { rightsText } from "@/lib/film/team-rights";
import FilmNav from "../[id]/FilmNav";

/** Every page of a film project shows the sections bar on top. */
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
  // a scene of «المسلسل الذكي»: the way back to its series and episode
  let scene: { href: string; text: string; team: { balance: number; rights: string | null } | null } | null = null;
  if (project.series_id && project.episode_id) {
    const db = createAdminClient();
    const [{ data: s }, { data: e }] = await Promise.all([
      db.from("film_series").select("title,mode").eq("id", project.series_id).maybeSingle(),
      db.from("film_episodes").select("number").eq("id", project.episode_id).maybeSingle(),
    ]);
    // a team series: what is made here comes out of «نقود الفريق الذكي», and a member sees what they may do
    let team: { balance: number; rights: string | null } | null = null;
    if (s?.mode === "team") {
      const [balance, r] = await Promise.all([teamCoinBalance(project.series_id).catch(() => 0), project.user_id === user.id ? null : memberRights(project.series_id, user.id)]);
      team = { balance, rights: r ? rightsText(r) : null };
    }
    if (s) scene = { href: `${base}/series/${project.series_id}`, text: `📺 ${s.title} · الحلقة ${e?.number ?? "؟"} · المشهد ${project.scene_number ?? "؟"}`, team };
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
      {children}
    </div>
  );
}
