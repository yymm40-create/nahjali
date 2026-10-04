import ProjectView from "@/app/film/_views/Project";

export const metadata = { title: "مشروع فيلم" };
export const dynamic = "force-dynamic";

export default async function JawadFilmProject({ params }: PageProps<"/jawad-ai/film/[id]">) {
  return <ProjectView id={(await params).id} base="/jawad-ai/film" />;
}
