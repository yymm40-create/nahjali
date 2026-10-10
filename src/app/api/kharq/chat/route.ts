import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { claudeWhy } from "@/lib/film/anthropic";
import { robotTurn } from "@/lib/claude-run";
import { requireKharqUser } from "@/lib/kharq/access";
import { say } from "@/lib/kharq/chat";
import { KHARQ } from "@config/kharq";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const UUID = /^[0-9a-f-]{36}$/i;

/** «محمد الخارق» · a message to him: for those the dashboard lets in (the owner, or an email/code naming «kharq»). */
export const POST = handle(async (req: Request) => {
  const { user } = await requireKharqUser();
  const b = (await req.json().catch(() => ({}))) as { chatId?: unknown; message?: unknown; model?: unknown; attachments?: unknown };
  const message = String(b.message ?? "").trim();
  const attachments = Array.isArray(b.attachments) ? b.attachments : [];
  if (!message && !attachments.length) throw new UserError("اكتب رسالتك.");
  if (message.length > KHARQ.messageMax) throw new UserError(`الرسالة أطول من ${KHARQ.messageMax} حرف.`);
  const chatId = typeof b.chatId === "string" && UUID.test(b.chatId) ? b.chatId : null;
  const origin = new URL(req.url).origin;
  try {
    return NextResponse.json(
      await robotTurn(user, b.model, `محادثة ${KHARQ.persona}`, () => say({ userId: user.id, chatId, message, email: user.email ?? null, attachments, origin })),
    );
  } catch (e) {
    if (e instanceof UserError) throw e;
    if (e instanceof Error && e.message === "chat not found") throw new UserError("ما لقينا هذي المحادثة.", 404);
    console.error("kharq chat", e);
    throw new UserError(claudeWhy(e, `${KHARQ.persona} ما قدر يرد الحين؛ جرّب بعد شوي.`, user.email), 502);
  }
});
