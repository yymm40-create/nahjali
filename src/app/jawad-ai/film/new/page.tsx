import NewFilmView from "@/app/film/_views/NewFilm";

export const metadata = { title: "مشروع فيلم جديد" };

export default async function JawadNewFilm({ searchParams }: { searchParams: Promise<{ map?: string }> }) {
  return <NewFilmView base="/jawad-ai/film" map={(await searchParams).map === "1"} />;
}
