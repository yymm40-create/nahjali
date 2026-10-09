import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { claudeTrouble } from "@/lib/film/anthropic";
import { requireContentUser } from "@/lib/content/access";
import { say } from "@/lib/content/chat";
import { CONTENT } from "@config/content";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const UUID = /^[0-9a-f-]{36}$/i;

/** «صانع المحتوى» · a message to «محمد باقر» (with the ids of the person's uploads attached to it). */
export const POST = handle(async (req: Request) => {
  const { user } = await requireContentUser();
  const b = (await req.json().catch(() => ({}))) as { chatId?: unknown; message?: unknown; attachments?: unknown };
  const message = String(b.message ?? "").trim();
  const attachments = Array.isArray(b.attachments) ? b.attachments : [];
  if (!message && !attachments.length) throw new UserError("اكتب رسالتك.");
  if (message.length > CONTENT.messageMax) throw new UserError(`الرسالة أطول من ${CONTENT.messageMax} حرف.`);
  const chatId = typeof b.chatId === "string" && UUID.test(b.chatId) ? b.chatId : null;
  try {
    return NextResponse.json(await say(user.id, chatId, message, attachments, user.email));
  } catch (e) {
    if (e instanceof UserError) throw e;
    const why = claudeTrouble(e);
    if (why) throw new UserError(why, 503);
    if (e instanceof Error && e.message === "chat not found") throw new UserError("ما لقينا هذي المحادثة.", 404);
    if (e instanceof Error && e.message === "empty message") throw new UserError("اكتب رسالتك.");
    console.error("content chat", e);
    throw new UserError("محمد باقر ما قدر يرد الحين؛ جرّب بعد شوي.", 502);
  }
});
