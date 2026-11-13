import FilmHomeView from "@/app/film/_views/FilmHome";

export const metadata = { title: "الفيلم السينمائي", description: "صانع الأفلام بالذكاء الاصطناعي: سيناريست وصانع شيت ومخرج يصنعون فيلمك أو مشهدك السينمائي خطوة بخطوة، بأي ستايل." };
export const dynamic = "force-dynamic";

export default function JawadFilmHome() {
  return <FilmHomeView base="/jawad-ai/film" />;
}
