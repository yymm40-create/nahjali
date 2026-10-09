import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { claudeTrouble } from "@/lib/film/anthropic";
import { requireDesignerUser } from "@/lib/designer/access";
import { say } from "@/lib/designer/chat";
import { DESIGNER } from "@config/designer";
import { isAdmin } from "@config/site";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const UUID = /^[0-9a-f-]{36}$/i;

/** «المصمم الذكي» · a message to «كاظم» (with the ids of the person's uploads attached to it). */
export const POST = handle(async (req: Request) => {
  const { user } = await requireDesignerUser();
  const b = (await req.json().catch(() => ({}))) as { chatId?: unknown; message?: unknown; attachments?: unknown };
  const message = String(b.message ?? "").trim();
  const attachments = Array.isArray(b.attachments) ? b.attachments : [];
  if (!message && !attachments.length) throw new UserError("اكتب رسالتك.");
  if (message.length > DESIGNER.messageMax) throw new UserError(`الرسالة أطول من ${DESIGNER.messageMax} حرف.`);
  const chatId = typeof b.chatId === "string" && UUID.test(b.chatId) ? b.chatId : null;
  try {
    return NextResponse.json(await say(user.id, chatId, message, attachments));
  } catch (e) {
    if (e instanceof UserError) throw e;
    const why = claudeTrouble(e);
    if (why) throw new UserError(why, 503);
    if (e instanceof Error && e.message === "chat not found") throw new UserError("ما لقينا هذي المحادثة.", 404);
    if (e instanceof Error && e.message === "empty message") throw new UserError("اكتب رسالتك.");
    console.error("designer chat", e);
    const raw = e instanceof Error ? e.message : typeof e === "object" && e ? JSON.stringify(e) : String(e);
    if (/designer_(chats|kv|files)|PGRST205|42P01|does not exist|schema cache/i.test(raw)) throw new UserError("قسم «المصمم الذكي» ما انضاف للحين في قاعدة البيانات: شغّل ملف SQL رقم 0044 في Supabase.", 503);
    throw new UserError(`كاظم ما قدر يرد الحين؛ جرّب بعد شوي.${isAdmin(user.email) ? ` (تفصيل للرئيس: ${raw.slice(0, 300)})` : ""}`, 502);
  }
});
