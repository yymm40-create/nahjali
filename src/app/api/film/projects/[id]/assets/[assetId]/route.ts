import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedProject, requireFilmApiUser } from "@/lib/film/access";
import { FILM_BUCKET } from "@/lib/film/types";

import { storage } from "@/lib/storage";
/** Deletes one of the user's own reference uploads (generated files are handled by their stage). */
export const DELETE = handle(async (_req: Request, { params }: { params: Promise<{ id: string; assetId: string }> }) => {
  const user = await requireFilmApiUser();
  const { id, assetId } = await params;
  const project = await getOwnedProject(id, user.id);

  const db = createAdminClient();
  const { data: asset } = await db
    .from("film_assets")
    .select("*")
    .eq("id", assetId)
    .eq("project_id", project.id)
    .maybeSingle();
  if (!asset) throw new UserError("ما لقينا الملف.", 404);
  if (asset.kind !== "upload") throw new UserError("هذا الملف ينحذف من مرحلته.", 409);

  if (asset.storage_path) await storage.from(FILM_BUCKET).remove([asset.storage_path]);
  await db.from("film_assets").delete().eq("id", asset.id);
  return NextResponse.json({ ok: true });
});
