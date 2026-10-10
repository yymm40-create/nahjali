import DirectorView from "../../_views/Director";

export const metadata = { title: "المخرج السينمائي | الجواد الذكي" };
export const dynamic = "force-dynamic";
// Finished videos are copied to storage while the page loads
export const maxDuration = 300;

// The page itself is shared with «الجواد الذكي!» (src/app/jawad-ai/film): same projects, stages and approvals.
export default async function DirectorPage({ params }: PageProps<"/film/[id]/director">) {
  return <DirectorView id={(await params).id} base="/film" />;
}
