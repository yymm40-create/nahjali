import VoicesView from "@/app/film/_views/Voices";

export const metadata = { title: "الأصوات" };
export const dynamic = "force-dynamic";

export default async function JawadFilmVoices({ params }: PageProps<"/jawad-ai/film/[id]/voices">) {
  return <VoicesView id={(await params).id} base="/jawad-ai/film" />;
}
