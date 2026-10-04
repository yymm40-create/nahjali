import FilmHomeView from "@/app/film/_views/FilmHome";

export const metadata = { title: "الفيلم السينمائي" };
export const dynamic = "force-dynamic";

export default function JawadFilmHome() {
  return <FilmHomeView base="/jawad-ai/film" />;
}
