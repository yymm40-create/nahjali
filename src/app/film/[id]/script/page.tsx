import ScriptView from "../../_views/Script";

export const metadata = { title: "السيناريست | نهج علي" };
export const dynamic = "force-dynamic";

// The page itself is shared with «الجواد الذكي!» (src/app/jawad-ai/film): same projects, stages and approvals.
export default async function ScriptPage({ params }: PageProps<"/film/[id]/script">) {
  return <ScriptView id={(await params).id} base="/film" />;
}
