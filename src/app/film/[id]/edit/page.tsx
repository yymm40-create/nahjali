import EditView from "../../_views/Edit";

export const metadata = { title: "المونتاج | الجواد الذكي" };
export const dynamic = "force-dynamic";

// The page itself is shared with «الجواد الذكي!» (src/app/jawad-ai/film): same projects, stages and approvals.
export default async function EditPage({ params }: PageProps<"/film/[id]/edit">) {
  return <EditView id={(await params).id} base="/film" />;
}
