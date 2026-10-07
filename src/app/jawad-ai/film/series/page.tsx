import SeriesHomeView from "@/app/film/_views/SeriesHome";

export const metadata = { title: "المسلسل الذكي" };
export const dynamic = "force-dynamic";

export default function JawadSeriesHome() {
  return <SeriesHomeView base="/jawad-ai/film" />;
}
