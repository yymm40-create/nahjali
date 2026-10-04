import ProjectLayoutView from "@/app/film/_views/ProjectLayout";

export default async function JawadFilmProjectLayout({ params, children }: LayoutProps<"/jawad-ai/film/[id]">) {
  return <ProjectLayoutView id={(await params).id} base="/jawad-ai/film">{children}</ProjectLayoutView>;
}
