import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { continueDirectorHandoff, prepareDirectorHandoff } from "@/lib/director/handoff";
import { requireJawadApiUser } from "@/lib/jawad/server/access";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
const UUID = /^[0-9a-f-]{36}$/i;

export const POST = handle(async (request: Request) => {
  const { user } = await requireJawadApiUser();
  const body = await request.json().catch(() => ({})) as { chatId?: unknown; action?: unknown };
  if (typeof body.chatId !== "string" || !UUID.test(body.chatId)) throw new UserError("محادثة غير صحيحة.", 400);
  return NextResponse.json(body.action === "continue" ? await continueDirectorHandoff(user.id, body.chatId) : await prepareDirectorHandoff(user.id, body.chatId));
});
