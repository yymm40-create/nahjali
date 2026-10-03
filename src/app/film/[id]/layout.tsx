import { requireFilmUser, requireProject } from "@/lib/film/access";
import { createAdminClient } from "@/lib/supabase/admin";
import FilmNav from "./FilmNav";

/** Every page of a film project shows the sections bar on top. */
export default async function FilmProjectLayout({ params, children }: LayoutProps<"/film/[id]">) {
  const { id } = await params;
  const { user, allowed } = await requireFilmUser(`/film/${id}`);
  // Without access the page itself redirects
  if (!allowed) return children;
  const project = await requireProject(id, user.id);
  const { count } = await createAdminClient()
    .from("film_versions")
    .select("id", { count: "exact", head: true })
    .eq("project_id", id)
    .eq("kind", "dir_generation")
    .eq("status", "approved");
  return (
    <div className="space-y-5">
      <FilmNav projectId={id} stage={project.stage} videosOpen={Boolean(count)} />
      {children}
    </div>
  );
}
