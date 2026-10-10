import ProjectView from "../_views/Project";

export const metadata = { title: "مشروع فيلم | الجواد الذكي" };
export const dynamic = "force-dynamic";

// The page itself is shared with «الجواد الذكي!» (src/app/jawad-ai/film): same projects, stages and approvals.
export default async function FilmProjectPage({ params }: PageProps<"/film/[id]">) {
  return <ProjectView id={(await params).id} base="/film" />;
}
