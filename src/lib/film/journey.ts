// «اختر رحلتك»: the journey a film project was started with (config/film-journey.ts), kept with the project and read by
// every route that asks Claude for it. Kept as a row of film_versions (stage and kind «journey», the choice in `data`):
// no migration to wait for, a copy of the project («من هنا») carries it, and a step undone never removes it. Server only.

import { createAdminClient } from "@/lib/supabase/admin";
import { claudeFor } from "@/lib/access-perks";
import { perksOf } from "@/lib/access";
import { isFilmJourney, type FilmJourney } from "@config/film-journey";
import { withClaude, withFilmJourney } from "./claude-model";

const db = () => createAdminClient();
export const JOURNEY_STAGE = "journey";

/** The project's journey; null for a project that never chose one (made before the journeys: the person's own pick answers). */
export async function projectJourney(projectId: string): Promise<FilmJourney | null> {
  const { data } = await db().from("film_versions").select("data").eq("project_id", projectId).eq("stage", JOURNEY_STAGE).eq("kind", JOURNEY_STAGE).order("version", { ascending: false }).limit(1).maybeSingle();
  const j = (data?.data as { journey?: unknown } | undefined)?.journey;
  return isFilmJourney(j) ? j : null;
}

/** Keeps the choice (each change is a new row: the latest one is the journey). */
export async function setProjectJourney(projectId: string, journey: FilmJourney): Promise<void> {
  const { data: last } = await db().from("film_versions").select("version,data").eq("project_id", projectId).eq("stage", JOURNEY_STAGE).eq("kind", JOURNEY_STAGE).order("version", { ascending: false }).limit(1).maybeSingle();
  if ((last?.data as { journey?: unknown } | undefined)?.journey === journey) return;
  const { error } = await db().from("film_versions").insert({
    project_id: projectId, stage: JOURNEY_STAGE, kind: JOURNEY_STAGE, ref_key: "", version: (Number(last?.version) || 0) + 1, body: "",
    data: { journey }, status: "approved", approved_at: new Date().toISOString(), created_by: "user",
  });
  if (error) throw error;
}

/**
 * Runs a project's Claude work with its journey's minds (each under the ceiling a code sets on this person); a project
 * without a journey answers with the person's own pick, as it always did.
 */
export async function withProjectClaude<T>(project: { id: string }, email: string | null | undefined, picked: unknown, fn: () => Promise<T>): Promise<T> {
  const journey = await projectJourney(project.id);
  if (!journey) return withClaude(await claudeFor(email, picked), fn);
  return withFilmJourney(journey, (await perksOf(email)).claudeModel, fn);
}
