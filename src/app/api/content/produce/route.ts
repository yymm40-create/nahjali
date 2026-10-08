import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requireContentUser } from "@/lib/content/access";
import { produce } from "@/lib/content/chat";
import { producedLinks } from "@/lib/content/files";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const UUID = /^[0-9a-f-]{36}$/i;

/** «صانع المحتوى» · the produce step: makes the carousel «محمد باقر» ordered in this conversation (GPT Image 2). */
export const POST = handle(async (req: Request) => {
  const { user } = await requireContentUser();
  const b = (await req.json().catch(() => ({}))) as { chatId?: unknown };
  const chatId = typeof b.chatId === "string" && UUID.test(b.chatId) ? b.chatId : null;
  if (!chatId) throw new UserError("محادثة غير صحيحة.", 400);
  try {
    const r = await produce(user.id, chatId);
    const [links, downloads] = await Promise.all([producedLinks(user.id, chatId), producedLinks(user.id, chatId, true)]);
    return NextResponse.json({ ...r, slides: r.slides.map((s) => ({ ...s, url: links.get(s.fileId) ?? null, download: downloads.get(s.fileId) ?? null })) });
  } catch (e) {
    if (e instanceof UserError) throw e;
    if (e instanceof Error && e.message === "chat not found") throw new UserError("ما لقينا هذي المحادثة.", 404);
    console.error("content produce", e);
    throw new UserError("ما قدرنا ننتج الشرائح الحين؛ جرّب مرة ثانية.", 502);
  }
});
