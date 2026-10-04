import FilmHomeView from "./_views/FilmHome";

export const metadata = { title: "صناعة فيلم | نهج علي" };

// The page itself is shared with «الجواد الذكي!» (src/app/jawad-ai/film): same projects, stages and approvals.
export default function FilmHome() {
  return <FilmHomeView base="/film" />;
}
