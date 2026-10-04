import { FilmBaseProvider } from "@/app/film/FilmBase";

/**
 * «الفيلم السينمائي» inside JAWAD AI: the existing step-by-step film maker (same projects, stages, approvals, limits
 * and saved work as /film), shown in JAWAD AI's identity. Links between its pages stay under /jawad-ai/film.
 */
export default function JawadFilmLayout({ children }: { children: React.ReactNode }) {
  return (
    <FilmBaseProvider base="/jawad-ai/film">
      <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-5">{children}</div>
    </FilmBaseProvider>
  );
}
