import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { claudeTrouble } from "@/lib/film/anthropic";
import { robotTurn } from "@/lib/claude-run";
import { requireBookletUser } from "@/lib/tables-booklet/access";
import { sayToNoor } from "@/lib/tables-booklet/server";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

const UUID = /^[0-9a-f-]{36}$/i;

/** «كتيب الجداول الذكي» · a message to «نور» (a new conversation carries who the booklet is for). */
export const POST = handle(async (req: Request) => {
  const user = await requireBookletUser();
  const b = (await req.json().catch(() => ({}))) as { chatId?: unknown; audience?: unknown; message?: unknown; model?: unknown };
  const chatId = typeof b.chatId === "string" && UUID.test(b.chatId) ? b.chatId : null;
  try {
    return NextResponse.json(await robotTurn(user, b.model, "محادثة نور (كتيب الجداول)", () => sayToNoor(user, chatId, b.audience, String(b.message ?? ""))));
  } catch (e) {
    if (e instanceof UserError) throw e;
    const why = claudeTrouble(e);
    if (why) throw new UserError(why, 503);
    console.error("booklet chat", e);
    throw new UserError("نور ما قدرت ترد الحين؛ جرّب بعد شوي.", 502);
  }
});
