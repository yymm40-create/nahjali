import SeriesView from "@/app/film/_views/Series";

export const metadata = { title: "المسلسل الذكي" };
export const dynamic = "force-dynamic";

export default async function JawadSeriesPage({ params }: PageProps<"/jawad-ai/film/series/[seriesId]">) {
  return <SeriesView id={(await params).seriesId} base="/jawad-ai/film" />;
}
