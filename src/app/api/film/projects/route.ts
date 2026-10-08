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

  // «هل تبيني أبحث لتطوير القصة؟» is kept with the film (without migration 0037 the film is made without it)
  const research = body.research === "yes" || body.research === "no" ? { asked: body.research, items: [] } : null;
  const row: Record<string, unknown> = { user_id: user.id, ...fields, ...(research ? { research } : {}) };
  let made = await db.from("film_projects").insert(row).select("id").single();
  if (made.error && research) {
    delete row.research;
    made = await db.from("film_projects").insert(row).select("id").single();
  }
  if (made.error || !made.data) throw made.error ?? new Error("insert failed");
  return NextResponse.json({ id: made.data.id });
});
