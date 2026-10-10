import VoicesView from "../../_views/Voices";

export const metadata = { title: "الأصوات | الجواد الذكي" };
export const dynamic = "force-dynamic";

// The page itself is shared with «الجواد الذكي!» (src/app/jawad-ai/film): same projects, stages and approvals.
export default async function VoicesPage({ params }: PageProps<"/film/[id]/voices">) {
  return <VoicesView id={(await params).id} base="/film" />;
}
