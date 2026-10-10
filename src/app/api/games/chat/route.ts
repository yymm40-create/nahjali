import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { claudeTrouble } from "@/lib/film/anthropic";
import { requireGamesUser } from "@/lib/games/access";
import { say } from "@/lib/games/chat";
import { robotTurn } from "@/lib/claude-run";
import { GAMES } from "@config/games";
import { isAdmin } from "@config/site";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

const UUID = /^[0-9a-f-]{36}$/i;

/** «صانع الألعاب الذكي» · a message to «قنبر»: for those the dashboard lets in (the owner, or an email/code naming «games»). */
export const POST = handle(async (req: Request) => {
  const { user } = await requireGamesUser();
  const b = (await req.json().catch(() => ({}))) as { chatId?: unknown; message?: unknown; model?: unknown };
  const message = String(b.message ?? "").trim();
  if (!message) throw new UserError("اكتب رسالتك.");
  if (message.length > GAMES.messageMax) throw new UserError(`الرسالة أطول من ${GAMES.messageMax} حرف.`);
  const chatId = typeof b.chatId === "string" && UUID.test(b.chatId) ? b.chatId : null;
  try {
    return NextResponse.json(await robotTurn(user, b.model, "محادثة قنبر", () => say(user.id, chatId, message, user.email)));
  } catch (e) {
    const why = claudeTrouble(e);
    if (why) throw new UserError(why, 503);
    if (e instanceof Error && e.message === "chat not found") throw new UserError("ما لقينا هذي المحادثة.", 404);
    console.error("games chat", e);
    const raw = e instanceof Error ? e.message : String(e);
    throw new UserError(`قنبر ما قدر يرد الحين؛ جرّب بعد شوي.${isAdmin(user.email) ? ` (تفصيل للرئيس: ${raw.slice(0, 300)})` : ""}`, 502);
  }
});
