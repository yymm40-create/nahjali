import EditView from "@/app/film/_views/Edit";

export const metadata = { title: "المونتاج" };
export const dynamic = "force-dynamic";

export default async function JawadFilmEdit({ params }: PageProps<"/jawad-ai/film/[id]/edit">) {
  return <EditView id={(await params).id} base="/jawad-ai/film" />;
}
