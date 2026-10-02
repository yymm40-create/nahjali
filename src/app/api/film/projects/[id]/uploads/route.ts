import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedProject, requireFilmApiUser } from "@/lib/film/access";
import { FILM_BUCKET, projectDir } from "@/lib/film/types";
import { FILM_LIMITS } from "@config/film";

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const BAD_FILE = "المرجع لازم يكون صورة JPG أو PNG أو WEBP وحجمها أقل من ٢٠ ميجا.";

/**
 * Step 1 of a reference upload: returns a one-time signed URL so the browser uploads
 * straight to storage (Vercel limits request bodies to 4.5 MB).
 */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireFilmApiUser();
  const { id } = await params;
  const project = await getOwnedProject(id, user.id);

  const { mime, bytes } = (await req.json().catch(() => ({}))) as { mime?: string; bytes?: number };
  if (!mime || !EXT[mime] || typeof bytes !== "number" || bytes <= 0 || bytes > FILM_LIMITS.maxUploadBytes) {
    throw new UserError(BAD_FILE, 400);
  }

  const db = createAdminClient();
  const { count } = await db
    .from("film_assets")
    .select("id", { count: "exact", head: true })
    .eq("project_id", project.id)
    .eq("kind", "upload");
  if ((count ?? 0) >= FILM_LIMITS.maxUploadsPerProject) {
    throw new UserError(`وصلت للحد الأقصى للمراجع (${FILM_LIMITS.maxUploadsPerProject}).`, 403);
  }

  const path = `${projectDir(project)}/uploads/${randomUUID()}.${EXT[mime]}`;
  const { data, error } = await db.storage.from(FILM_BUCKET).createSignedUploadUrl(path);
  if (error) throw error;
  return NextResponse.json({ path: data.path, token: data.token });
});
