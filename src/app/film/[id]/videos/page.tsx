import VideosView from "../../_views/Videos";

export const metadata = { title: "توليد الفيديو | الجواد الذكي" };
export const dynamic = "force-dynamic";
// Finished videos are copied to storage while the page loads
export const maxDuration = 300;

// The page itself is shared with «الجواد الذكي!» (src/app/jawad-ai/film): same projects, stages and approvals.
export default async function VideosPage({ params }: PageProps<"/film/[id]/videos">) {
  return <VideosView id={(await params).id} base="/film" />;
}
