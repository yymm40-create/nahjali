import SeriesView from "../../_views/Series";

export const metadata = { title: "المسلسل الذكي | الجواد الذكي" };
export const dynamic = "force-dynamic";

export default async function SeriesPage({ params }: PageProps<"/film/series/[seriesId]">) {
  return <SeriesView id={(await params).seriesId} base="/film" />;
}
