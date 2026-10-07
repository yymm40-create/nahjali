import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireFilmApiUser } from "@/lib/film/access";
import { projectFields } from "@/lib/film/validate";
import { FILM_LIMITS } from "@config/film";

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

  const { data, error } = await db
    .from("film_projects")
    .insert({ user_id: user.id, ...fields })
    .select("id")
    .single();
  if (error) throw error;
  return NextResponse.json({ id: data.id });
});
