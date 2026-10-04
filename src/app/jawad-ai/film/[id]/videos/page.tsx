import VideosView from "@/app/film/_views/Videos";

export const metadata = { title: "توليد الفيديو" };
export const dynamic = "force-dynamic";
// Finished videos are copied to storage while the page loads
export const maxDuration = 300;

export default async function JawadFilmVideos({ params }: PageProps<"/jawad-ai/film/[id]/videos">) {
  return <VideosView id={(await params).id} base="/jawad-ai/film" />;
}
