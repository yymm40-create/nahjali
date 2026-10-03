import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { filmTrialUsers, requireFilmApiUser } from "@/lib/film/access";
import { projectFields } from "@/lib/film/validate";
import { FILM_LIMITS, FILM_PUBLIC_TRIAL } from "@config/film";
import { isAdmin } from "@config/site";

/** Creates a new film project from the user's title and story. */
export const POST = handle(async (req: Request) => {
  const user = await requireFilmApiUser();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const fields = projectFields(body, { requireTitle: true });

  const db = createAdminClient();
  const { count } = await db.from("film_projects").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  if ((count ?? 0) >= FILM_LIMITS.maxProjectsPerUser) {
    throw new UserError(`وصلت للحد الأقصى للمشاريع (${FILM_LIMITS.maxProjectsPerUser}).`, 403);
  }

  const { data, error } = await db
    .from("film_projects")
    .insert({ user_id: user.id, ...fields })
    .select("id")
    .single();
  if (error) throw error;
  // Public trial: two people starting at the same moment can't both take the last place
  if (FILM_PUBLIC_TRIAL.open && !isAdmin(user.email) && !(await filmTrialUsers()).includes(user.id)) {
    await db.from("film_projects").delete().eq("id", data.id);
    throw new UserError("اكتمل عدد المجرّبين في الفترة المجانية.", 403);
  }
  return NextResponse.json({ id: data.id });
});
