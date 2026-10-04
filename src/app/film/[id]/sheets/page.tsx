import SheetsView from "../../_views/Sheets";

export const metadata = { title: "صانع الشيت | نهج علي" };
export const dynamic = "force-dynamic";

// The page itself is shared with «الجواد الذكي!» (src/app/jawad-ai/film): same projects, stages and approvals.
export default async function SheetsPage({ params }: PageProps<"/film/[id]/sheets">) {
  return <SheetsView id={(await params).id} base="/film" />;
}
