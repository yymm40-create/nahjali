import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requirePhotoUser } from "@/lib/photo/access";
import { projectFiles } from "@/lib/photo/files";
import { deleteProject, getProject, listProjects, openBlank, openFromDesigner, openFromUpload, openFromWork, saveProject } from "@/lib/photo/projects";
import { cutoutReady } from "@/lib/photo/make";
import { PHOTO } from "@config/photo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID = /^[0-9a-f-]{36}$/i;
const HEX = /^#[0-9a-fA-F]{6}$/;

/** «زهراء فوتو ماستر» · my projects: the list, or one (`?id=`) with its pictures. */
export const GET = handle(async (req: Request) => {
  const { user } = await requirePhotoUser();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ projects: await listProjects(user.id) });
  if (!UUID.test(id)) throw new UserError("مشروع غير صحيح.", 400);
  const project = await getProject(user.id, id);
  if (!project) throw new UserError("ما لقينا هذا المشروع.", 404);
  const files = await projectFiles(user.id, id);
  return NextResponse.json({ project, files, cutout: cutoutReady() });
});

/**
 * A new project. Body: { from: "blank", width, height, bg } | { from: "upload", uploadId } | { from: "work", outputId } |
 * { from: "designer", chatId, at? }. Returns { id } (the page opens /jawad-ai/photo/<id>).
 */
export const POST = handle(async (req: Request) => {
  const { user } = await requirePhotoUser();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const tableHint = (e: unknown) => {
    const raw = e instanceof Error ? e.message : typeof e === "object" && e ? JSON.stringify(e) : String(e);
    if (!(e instanceof UserError) && /photo_(projects|files|kv)|PGRST205|42P01|does not exist|schema cache/i.test(raw)) throw new UserError("«زهراء فوتو ماستر» ما انضافت للحين في قاعدة البيانات: شغّل ملف SQL رقم 0046 في Supabase.", 503);
    throw e;
  };
  try {
    switch (b.from) {
      case "blank": {
        const w = Math.round(Number(b.width) || 1080);
        const h = Math.round(Number(b.height) || 1350);
        if (w < PHOTO.minSide || h < PHOTO.minSide || w > 20000 || h > 20000) throw new UserError("مقاس اللوحة خارج المدى.", 400);
        return NextResponse.json({ id: await openBlank(user.id, w, h, HEX.test(String(b.bg)) ? String(b.bg) : "#FFFFFF") });
      }
      case "upload":
        if (typeof b.uploadId !== "string" || !UUID.test(b.uploadId)) throw new UserError("صورة غير صحيحة.", 400);
        return NextResponse.json({ id: await openFromUpload(user.id, b.uploadId) });
      case "work":
        if (typeof b.outputId !== "string" || !UUID.test(b.outputId)) throw new UserError("عمل غير صحيح.", 400);
        return NextResponse.json({ id: await openFromWork(user.id, b.outputId) });
      case "designer":
        if (typeof b.chatId !== "string" || !UUID.test(b.chatId)) throw new UserError("محادثة غير صحيحة.", 400);
        return NextResponse.json({ id: await openFromDesigner(user.id, b.chatId, Number.isInteger(b.at) ? Number(b.at) : undefined) });
      default:
        throw new UserError("طلب غير معروف.", 400);
    }
  } catch (e) {
    return tableHint(e);
  }
});

/** The page's edits (the canvas document, the title). Body: { id, doc?, title? }. */
export const PUT = handle(async (req: Request) => {
  const { user } = await requirePhotoUser();
  const b = (await req.json().catch(() => ({}))) as { id?: unknown; doc?: unknown; title?: unknown };
  if (typeof b.id !== "string" || !UUID.test(b.id)) throw new UserError("مشروع غير صحيح.", 400);
  await saveProject(user.id, b.id, { ...(b.doc !== undefined ? { doc: b.doc } : {}), ...(typeof b.title === "string" ? { title: b.title } : {}) });
  return NextResponse.json({ ok: true });
});

export const DELETE = handle(async (req: Request) => {
  const { user } = await requirePhotoUser();
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!UUID.test(id)) throw new UserError("مشروع غير صحيح.", 400);
  await deleteProject(user.id, id);
  return NextResponse.json({ ok: true });
});
