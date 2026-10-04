import NewFilmView from "@/app/film/_views/NewFilm";

export const metadata = { title: "مشروع فيلم جديد" };

export default function JawadNewFilm() {
  return <NewFilmView base="/jawad-ai/film" />;
}
