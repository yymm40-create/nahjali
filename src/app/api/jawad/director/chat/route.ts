import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { directorSay } from "@/lib/director/chat";
import { requireJawadApiUser } from "@/lib/jawad/server/access";
import { managedAgentConfigured } from "@/lib/managed-agent";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
const UUID = /^[0-9a-f-]{36}$/i;

export const POST = handle(async (request: Request) => {
  const { user } = await requireJawadApiUser();
  if (!managedAgentConfigured()) throw new UserError("وكيل جواد المخرج غير مربوط بالخادم بعد.", 503);
  const body = await request.json().catch(() => ({})) as { chatId?: unknown; message?: unknown; attachments?: unknown };
  const message = String(body.message ?? "").trim();
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];
  if (!message && !attachments.length) throw new UserError("اكتب رسالتك أو أرفق ملفاتك.");
  if (message.length > 20000) throw new UserError("الرسالة طويلة جدًا؛ قسّمها على رسالتين.");
  const chatId = typeof body.chatId === "string" && UUID.test(body.chatId) ? body.chatId : null;
  try {
    return NextResponse.json(await directorSay({ userId: user.id, chatId, message, attachments }));
  } catch (error) {
    if (error instanceof UserError) throw error;
    console.error("director chat", error);
    // the director's tables and session type come from migration 0074: without it nothing can be saved, so say so plainly
    const e = (error ?? {}) as { code?: unknown; message?: unknown };
    const text = `${String(e.code ?? "")} ${String(e.message ?? error)}`;
    if (/42P01|PGRST205|PGRST204|23514|jawad_director_chats|jawad_agent_sessions_context_type_check|context_type/i.test(text)) {
      throw new UserError("جواد المخرج يحتاج هجرة قاعدة البيانات 0074_jawad_director.sql: شغّلها مرة وحدة في Supabase (SQL Editor) ثم جرّب.", 503);
    }
    throw new UserError("جواد المخرج ما قدر يرد الآن. لم نستخدم أي وكيل بديل؛ جرّب بعد قليل.", 502);
  }
});
