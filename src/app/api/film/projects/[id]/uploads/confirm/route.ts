import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedProject, requireFilmApiUser } from "@/lib/film/access";
import { FILM_BUCKET, projectDir } from "@/lib/film/types";
import { FILM_LIMITS } from "@config/film";

import { storage } from "@/lib/storage";
/** Step 2 of a reference upload: checks the stored file and records it in the project. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireFilmApiUser();
  const { id } = await params;
  const project = await getOwnedProject(id, user.id);

  const { path, fileName } = (await req.json().catch(() => ({}))) as { path?: string; fileName?: string };
  const dir = `${projectDir(project)}/uploads`;
  if (!path || !path.startsWith(`${dir}/`) || path.includes("..")) throw new UserError("ملف غير صحيح.", 400);

  const db = createAdminClient();
  const name = path.slice(dir.length + 1);
  const { data: list, error } = await storage.from(FILM_BUCKET).list(dir, { search: name });
  if (error) throw error;
  const file = list?.find((f) => f.name === name);
  if (!file) throw new UserError("ما وصل الملف، جرّب ترفعه مرة ثانية.", 400);

  const size = Number(file.metadata?.size ?? 0);
  const mime = String(file.metadata?.mimetype ?? "");
  if (!FILM_LIMITS.uploadMimes.includes(mime) || size <= 0 || size > FILM_LIMITS.maxUploadBytes) {
    await storage.from(FILM_BUCKET).remove([path]);
    throw new UserError("المرجع لازم يكون صورة JPG أو PNG أو WEBP وحجمها أقل من ٢٠ ميجا.", 400);
  }

  // Idempotent: confirming the same file twice keeps one record
  const existing = await db.from("film_assets").select("id").eq("storage_path", path).maybeSingle();
  if (existing.data) return NextResponse.json({ id: existing.data.id });

  const { data, error: e2 } = await db
    .from("film_assets")
    .insert({
      project_id: project.id,
      kind: "upload",
      storage_path: path,
      file_name: (fileName ?? "").slice(0, 120) || name,
      mime,
      bytes: size,
      status: "uploaded",
    })
    .select("id")
    .single();
  if (e2) throw e2;
  return NextResponse.json({ id: data.id });
});
