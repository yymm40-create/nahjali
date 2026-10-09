import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requirePhotoUser } from "@/lib/photo/access";
import { addFile, fileLinks } from "@/lib/photo/files";
import { getProject } from "@/lib/photo/projects";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID = /^[0-9a-f-]{36}$/i;
const MAX_BYTES = 40 * 1024 * 1024;

/** «زهراء فوتو ماستر» · the picture the browser drew (PNG, JPG or WebP), kept with the project. Body: multipart `projectId`, `file`. */
export const POST = handle(async (req: Request) => {
  const { user } = await requirePhotoUser();
  const form = await req.formData().catch(() => null);
  const projectId = String(form?.get("projectId") ?? "");
  const file = form?.get("file");
  if (!UUID.test(projectId) || !(file instanceof Blob)) throw new UserError("طلب غير صحيح.", 400);
  if (file.size > MAX_BYTES) throw new UserError("الصورة أكبر من المسموح.", 413);
  const project = await getProject(user.id, projectId);
  if (!project) throw new UserError("ما لقينا هذا المشروع.", 404);
  const saved = await addFile({ userId: user.id, projectId, bytes: Buffer.from(await file.arrayBuffer()), name: project.title || "photo", role: "export" });
  const links = await fileLinks(user.id, projectId, true);
  return NextResponse.json({ ok: true, fileId: saved.id, url: links.get(saved.id) ?? null });
});
