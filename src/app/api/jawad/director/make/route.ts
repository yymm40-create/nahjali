import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { confirmDirectorMedia, followDirectorMedia } from "@/lib/director/make";
import { requireJawadApiUser } from "@/lib/jawad/server/access";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
const UUID = /^[0-9a-f-]{36}$/i;

export const POST = handle(async (request: Request) => {
  const { user } = await requireJawadApiUser();
  const body = await request.json().catch(() => ({})) as { chatId?: unknown; mediaId?: unknown; step?: unknown; settings?: Record<string, unknown> };
  if (typeof body.chatId !== "string" || !UUID.test(body.chatId)) throw new UserError("محادثة غير صحيحة.", 400);
  const mediaId = String(body.mediaId ?? "").trim();
  if (!mediaId) throw new UserError("ما وصلني التوليد المطلوب.", 400);
  if (body.step === "follow") return NextResponse.json(await followDirectorMedia(user.id, body.chatId, mediaId));
  return NextResponse.json(await confirmDirectorMedia({ userId: user.id, chatId: body.chatId, mediaId, email: user.email ?? null, origin: new URL(request.url).origin, settings: body.settings }));
});
