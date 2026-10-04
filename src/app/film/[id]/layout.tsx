import ProjectLayoutView from "../_views/ProjectLayout";

/** Every page of a film project shows the sections bar on top (shared with «الجواد الذكي!»). */
export default async function FilmProjectLayout({ params, children }: LayoutProps<"/film/[id]">) {
  return <ProjectLayoutView id={(await params).id} base="/film">{children}</ProjectLayoutView>;
}
