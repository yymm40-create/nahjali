import { requireFilmUser, requireProject } from "@/lib/film/access";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
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
  let scene: { href: string; text: string } | null = null;
  if (project.series_id && project.episode_id) {
    const db = createAdminClient();
    const [{ data: s }, { data: e }] = await Promise.all([
      db.from("film_series").select("title").eq("id", project.series_id).maybeSingle(),
      db.from("film_episodes").select("number").eq("id", project.episode_id).maybeSingle(),
    ]);
    if (s) scene = { href: `${base}/series/${project.series_id}`, text: `📺 ${s.title} · الحلقة ${e?.number ?? "؟"} · المشهد ${project.scene_number ?? "؟"}` };
  }
  return (
    <div className="space-y-5">
      {scene && (
        <Link href={scene.href} className="inline-flex items-center gap-1 rounded-full bg-[#0b1d47] px-3 py-1 text-xs font-extrabold text-white">
          → {scene.text}
        </Link>
      )}
      <FilmNav projectId={id} stage={project.stage} videosOpen={Boolean(count)} />
      {children}
    </div>
  );
}
