import { requireFilmUser, requireProject } from "@/lib/film/access";
import FilmNav from "./FilmNav";

/** Every page of a film project shows the sections bar on top. */
export default async function FilmProjectLayout({ params, children }: LayoutProps<"/film/[id]">) {
  const { id } = await params;
  const { user, allowed } = await requireFilmUser(`/film/${id}`);
  // Without access the page itself redirects
  if (!allowed) return children;
  const project = await requireProject(id, user.id);
  return (
    <div className="space-y-5">
      <FilmNav projectId={id} stage={project.stage} />
      {children}
    </div>
  );
}
