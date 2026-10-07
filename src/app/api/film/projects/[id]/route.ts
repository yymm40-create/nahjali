import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedProject, requireFilmApiUser } from "@/lib/film/access";
import { projectFields } from "@/lib/film/validate";

/** Autosave of the project's title, story, fixed facts and duration. */
export const PATCH = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireFilmApiUser();
  const { id } = await params;
  await getOwnedProject(id, user.id, "screenwriter");

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const fields = projectFields(body, { requireTitle: false });
  if (Object.keys(fields).length === 0) return NextResponse.json({ ok: true });

  const db = createAdminClient();
  // Once the screenwriter has the story, changes go through the screenwriter (so nothing changes silently)
  const { count } = await db.from("film_messages").select("id", { count: "exact", head: true }).eq("project_id", id);
  if ((count ?? 0) > 0) throw new UserError("القصة صارت عند السيناريست. اطلب أي تعديل من صفحة السيناريست.", 409);

  const { data, error } = await db
    .from("film_projects")
    .update(fields)
    .eq("id", id)
    .select("updated_at")
    .single();
  if (error) throw error;
  return NextResponse.json({ ok: true, savedAt: data.updated_at });
});
