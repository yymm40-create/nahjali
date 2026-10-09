import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requirePhotoUser } from "@/lib/photo/access";
import { returnToDesigner } from "@/lib/photo/projects";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID = /^[0-9a-f-]{36}$/i;
const MAX_BYTES = 40 * 1024 * 1024;

/**
 * «زهراء فوتو ماستر» · the edited design goes back to «كاظم». Body: multipart `projectId`, `artwork` (PNG of everything but
 * the words), `final` (PNG of the whole design, optional), `summary` (what was changed). Returns { url } to open his chat.
 */
export const POST = handle(async (req: Request) => {
  const { user } = await requirePhotoUser();
  const form = await req.formData().catch(() => null);
  const projectId = String(form?.get("projectId") ?? "");
  const artwork = form?.get("artwork");
  const final = form?.get("final");
  if (!UUID.test(projectId) || !(artwork instanceof Blob)) throw new UserError("طلب غير صحيح.", 400);
  if (artwork.size > MAX_BYTES || (final instanceof Blob && final.size > MAX_BYTES)) throw new UserError("الصورة أكبر من المسموح.", 413);
  const r = await returnToDesigner(
    user.id,
    projectId,
    { artwork: Buffer.from(await artwork.arrayBuffer()), ...(final instanceof Blob ? { final: Buffer.from(await final.arrayBuffer()) } : {}) },
    String(form?.get("summary") ?? "").slice(0, 2000),
  );
  return NextResponse.json({ ok: true, ...r });
});
