import SeriesHomeView from "../_views/SeriesHome";

export const metadata = { title: "المسلسل الذكي | الجواد الذكي" };
export const dynamic = "force-dynamic";

// Shared with «الجواد الذكي!» (src/app/jawad-ai/film/series).
export default function SeriesHomePage() {
  return <SeriesHomeView base="/film" />;
}
