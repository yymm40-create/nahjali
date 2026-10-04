import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiUser } from "@/lib/api";
import { FILM_BUCKET } from "@/lib/film/types";
import { isUuid } from "@/lib/jawad/server/uploads";

/** JAWAD AI · downloads a picture or video of one of the user's film projects (owner checked through the project). */
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  const { id } = await params;
  if (!isUuid(id)) throw new UserError("طلب غير صحيح.", 400);
  const db = createAdminClient();
  const { data: a } = await db.from("film_assets").select("project_id,storage_path,ref_key,kind").eq("id", id).maybeSingle();
  if (!a?.storage_path) throw new UserError("ما لقينا هذا الملف.", 404);
  const { data: p } = await db.from("film_projects").select("user_id").eq("id", a.project_id).maybeSingle();
  if (!p || p.user_id !== user.id) throw new UserError("ما لقينا هذا الملف.", 404);
  const ext = String(a.storage_path).split(".").pop();
  const { data: link, error } = await db.storage.from(FILM_BUCKET).createSignedUrl(a.storage_path, 600, { download: `${a.ref_key || a.kind}.${ext}` });
  if (error) throw error;
  return NextResponse.redirect(link.signedUrl);
});
