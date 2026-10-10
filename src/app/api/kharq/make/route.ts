import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requireKharqUser } from "@/lib/kharq/access";
import { confirm, follow } from "@/lib/kharq/make";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * «محمد الخارق» · the person's yes to a picture or a video he proposed, and the follow-up after it:
 * - { chatId, askId } → جواد starts it (a picture comes back here; a video is followed)
 * - { chatId, askId, step: "follow" } → where it stands now.
 * Nothing is generated without this press: his answer only proposes, with the price.
 */
export const POST = handle(async (req: Request) => {
  const { user } = await requireKharqUser();
  const b = (await req.json().catch(() => ({}))) as { chatId?: unknown; askId?: unknown; step?: unknown };
  if (typeof b.chatId !== "string" || !UUID.test(b.chatId)) throw new UserError("محادثة غير صحيحة.", 400);
  const askId = String(b.askId ?? "").trim();
  if (!askId) throw new UserError("ما وصلني أي طلب أصنعه.", 400);
  const origin = new URL(req.url).origin;
  const o = { userId: user.id, chatId: b.chatId, askId, email: user.email ?? null, origin };
  return NextResponse.json(b.step === "follow" ? await follow(o) : await confirm(o));
});
