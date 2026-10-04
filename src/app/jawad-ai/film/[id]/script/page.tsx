import ScriptView from "@/app/film/_views/Script";

export const metadata = { title: "السيناريست" };
export const dynamic = "force-dynamic";

export default async function JawadFilmScript({ params }: PageProps<"/jawad-ai/film/[id]/script">) {
  return <ScriptView id={(await params).id} base="/jawad-ai/film" />;
}
