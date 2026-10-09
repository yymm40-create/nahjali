import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requireContentUser } from "@/lib/content/access";
import { producedLinks } from "@/lib/content/files";
import { stepMedia } from "@/lib/content/media";
import { isAdmin } from "@config/site";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * «صانع المحتوى» · the media step: the pictures and videos «محمد باقر» handed to جواد. Each call starts what waits
 * (pictures are made now), follows the videos جواد is making, and returns every item's state — the page calls it
 * again while `running`. `retry` (item ids, or "failed") puts failed items back to waiting.
 */
export const POST = handle(async (req: Request) => {
  const { user } = await requireContentUser();
  const b = (await req.json().catch(() => ({}))) as { chatId?: unknown; retry?: unknown };
  const chatId = typeof b.chatId === "string" && UUID.test(b.chatId) ? b.chatId : null;
  if (!chatId) throw new UserError("محادثة غير صحيحة.", 400);
  const retry = b.retry === "failed" ? ("failed" as const) : Array.isArray(b.retry) ? b.retry.filter((x): x is string => typeof x === "string").slice(0, 12) : undefined;
  const owner = isAdmin(user.email);
  try {
    const r = await stepMedia(user.id, chatId, { retry, owner, email: user.email, origin: new URL(req.url).origin });
    const [links, downloads] = await Promise.all([producedLinks(user.id, chatId), producedLinks(user.id, chatId, true)]);
    return NextResponse.json({ ...r, items: r.items.map((x) => ({ ...x, url: x.fileId ? links.get(x.fileId) ?? null : null, download: x.fileId ? downloads.get(x.fileId) ?? null : null })) });
  } catch (e) {
    if (e instanceof UserError) throw e;
    if (e instanceof Error && e.message === "chat not found") throw new UserError("ما لقينا هذي المحادثة.", 404);
    console.error("content generate", e);
    throw new UserError("ما قدرنا نكمل الطلب الحين؛ جرّب مرة ثانية.", 502);
  }
});
