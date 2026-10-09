import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requirePhotoUser } from "@/lib/photo/access";
import { addFile } from "@/lib/photo/files";
import { getProject } from "@/lib/photo/projects";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID = /^[0-9a-f-]{36}$/i;
const MAX_BYTES = 40 * 1024 * 1024;

/** «زهراء فوتو ماستر» · a picture from the person's device added to a project (as a base or a layer). Body: multipart `projectId`, `file`, `role`. */
export const POST = handle(async (req: Request) => {
  const { user } = await requirePhotoUser();
  const form = await req.formData().catch(() => null);
  const projectId = String(form?.get("projectId") ?? "");
  const file = form?.get("file");
  const role = form?.get("role") === "base" ? "base" : "layer";
  if (!UUID.test(projectId) || !(file instanceof Blob)) throw new UserError("طلب غير صحيح.", 400);
  if (file.size > MAX_BYTES) throw new UserError("الصورة أكبر من ٤٠ ميجا.", 413);
  if (!(await getProject(user.id, projectId))) throw new UserError("ما لقينا هذا المشروع.", 404);
  const name = file instanceof File && file.name ? file.name.replace(/\.[a-z0-9]+$/i, "") : "صورة";
  const f = await addFile({ userId: user.id, projectId, bytes: Buffer.from(await file.arrayBuffer()), name, role });
  return NextResponse.json({ file: { id: f.id, name: f.name, width: f.width, height: f.height, role: f.role } });
});
