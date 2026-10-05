import { FilmBaseProvider } from "@/app/film/FilmBase";
import SectionHint from "@/components/jawad/SectionHint";

/**
 * «الفيلم السينمائي» inside JAWAD AI: the existing step-by-step film maker (same projects, stages, approvals, limits
 * and saved work as /film), shown in JAWAD AI's identity. Links between its pages stay under /jawad-ai/film.
 */
export default function JawadFilmLayout({ children }: { children: React.ReactNode }) {
  return (
    <FilmBaseProvider base="/jawad-ai/film">
      {/* the film maker's own look: a dark theatre in warm gold (sections.css) */}
      <div className="jw-sec" data-jw-section="film">
        <div className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-16 pt-6">
          <SectionHint kind="film" />
          {children}
        </div>
      </div>
    </FilmBaseProvider>
  );
}
