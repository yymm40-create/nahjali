import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { claudeTrouble } from "@/lib/film/anthropic";
import { requirePhotoUser } from "@/lib/photo/access";
import { say } from "@/lib/photo/chat";
import { PHOTO } from "@config/photo";
import { isAdmin } from "@config/site";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const UUID = /^[0-9a-f-]{36}$/i;

/** «زهراء فوتو ماستر» · a message to «زهراء» with the canvas as the page has it (and a small picture of it). */
export const POST = handle(async (req: Request) => {
  const { user } = await requirePhotoUser();
  const b = (await req.json().catch(() => ({}))) as { projectId?: unknown; message?: unknown; doc?: unknown; preview?: unknown };
  const message = String(b.message ?? "").trim();
  if (!message) throw new UserError("اكتب رسالتك.");
  if (message.length > PHOTO.messageMax) throw new UserError(`الرسالة أطول من ${PHOTO.messageMax} حرف.`);
  if (typeof b.projectId !== "string" || !UUID.test(b.projectId)) throw new UserError("مشروع غير صحيح.", 400);
  try {
    return NextResponse.json(await say(user.id, user.email ?? null, { projectId: b.projectId, message, doc: b.doc, preview: b.preview }));
  } catch (e) {
    if (e instanceof UserError) throw e;
    const why = claudeTrouble(e);
    if (why) throw new UserError(why, 503);
    console.error("photo chat", e);
    const raw = e instanceof Error ? e.message : typeof e === "object" && e ? JSON.stringify(e) : String(e);
    if (/photo_(projects|files|kv)|PGRST205|42P01|does not exist|schema cache/i.test(raw)) throw new UserError("«زهراء فوتو ماستر» ما انضافت للحين في قاعدة البيانات: شغّل ملف SQL رقم 0046 في Supabase.", 503);
    throw new UserError(`زهراء ما قدرت ترد الحين؛ جرّب بعد شوي.${isAdmin(user.email) ? ` (تفصيل للرئيس: ${raw.slice(0, 300)})` : ""}`, 502);
  }
});
