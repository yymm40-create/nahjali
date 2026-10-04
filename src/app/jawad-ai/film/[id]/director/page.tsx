import DirectorView from "@/app/film/_views/Director";

export const metadata = { title: "المخرج السينمائي" };
export const dynamic = "force-dynamic";
// Finished videos are copied to storage while the page loads
export const maxDuration = 300;

export default async function JawadFilmDirector({ params }: PageProps<"/jawad-ai/film/[id]/director">) {
  return <DirectorView id={(await params).id} base="/jawad-ai/film" />;
}
