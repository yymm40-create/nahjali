import NewFilmView from "../_views/NewFilm";

export const metadata = { title: "مشروع فيلم جديد | الجواد الذكي" };

// The page itself is shared with «الجواد الذكي!» (src/app/jawad-ai/film): same projects, stages and approvals.
export default function NewFilmPage() {
  return <NewFilmView base="/film" />;
}
