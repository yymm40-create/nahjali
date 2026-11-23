import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireFilmApiUser } from "@/lib/film/access";
import { projectFields } from "@/lib/film/validate";
import { FILM_LIMITS } from "@config/film";
import { normalizeJourneyIntake } from "@/lib/film/intake";
import { setProjectJourney } from "@/lib/film/journey";
import { isFilmJourney } from "@config/film-journey";
import { keepAdPictures } from "@/lib/film/ad-brand";
import type { FilmProject } from "@/lib/film/types";

/** Creates a new film project from the user's title and story. */
export const POST = handle(async (req: Request) => {
  const user = await requireFilmApiUser();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const fields = projectFields(body, { requireTitle: true });

  const db = createAdminClient();
  // a series' scenes have their own limits (lib/film/series.ts)
  const { data: mine } = await db.from("film_projects").select("*").eq("user_id", user.id).limit(500);
  const count = (mine ?? []).filter((p) => !p.series_id).length;
  if (count >= FILM_LIMITS.maxProjectsPerUser) {
    throw new UserError(`وصلت للحد الأقصى للمشاريع (${FILM_LIMITS.maxProjectsPerUser}).`, 403);
  }

  // «هل تبيني أبحث لتطوير القصة؟» is kept with the film (without migration 0037 the film is made without it)
  const research = body.research === "yes" || body.research === "no" ? { asked: body.research, items: [] } : null;
  const intake = body.workflowVersion === 2 ? normalizeJourneyIntake(body.intake) : null;
  if (intake?.questions.some((question) => question.required)) throw new UserError("كمّل أسئلة سجاد قبل إنشاء المشروع.", 409);
  const row: Record<string, unknown> = { user_id: user.id, ...fields, ...(research ? { research } : {}), ...(intake ? { intake, workflow_version: 2 } : {}) };
  let made = await db.from("film_projects").insert(row).select("id").single();
  // the columns that came with a migration: without it the film is still made, one piece lighter («kind» → a scene)
  for (const drop of ["intake", "workflow_version", "kind", "research"]) {
    if (!made.error || !(drop in row)) continue;
    delete row[drop];
    made = await db.from("film_projects").insert(row).select("id").single();
  }
  if (made.error || !made.data) throw made.error ?? new Error("insert failed");
  // «اختر رحلتك»: the mind that writes this film, kept with it (a film whose choice could not be kept is still made: it
  // answers with the person's own pick, and the choice can be made again from its pages)
  if (isFilmJourney(body.journey)) await setProjectJourney(made.data.id, body.journey).catch((e) => console.error("film journey not kept", e));
  // «📣 إعلان»: the brand's pictures and the reference ad's frames, given before there was a project, become its references
  if (intake?.ad) {
    const project = { id: made.data.id, user_id: user.id } as FilmProject;
    await keepAdPictures(project, user.id, body.brand, body.adReferenceSheetId).catch((e) => console.error("ad pictures not kept", e));
  }
  return NextResponse.json({ id: made.data.id });
});
