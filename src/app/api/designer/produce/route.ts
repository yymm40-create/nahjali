import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requireDesignerUser } from "@/lib/designer/access";
import { getChat } from "@/lib/designer/chats";
import { fileLinks } from "@/lib/designer/files";
import { codeBrief, failDesign, produceFromCode, retry } from "@/lib/designer/produce";
import { isAdmin } from "@config/site";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * «المصمم الذكي» · the produce step, in two calls: first the brief «حيدرا ماكس» designs from (جواد paints the picture it
 * needs first, with GPT Image 2 and no writing in it); then the PNG the page drew comes back and becomes the design.
 * `retry` draws the last design again. `failed` (the page could not draw it): the design is kept as failed, so a reload
 * shows «أعد المحاولة» instead of drawing for ever (and never starts a paid drawing again by itself).
 */
export const POST = handle(async (req: Request) => {
  const { user } = await requireDesignerUser();
  const b = (await req.json().catch(() => ({}))) as { chatId?: unknown; retry?: unknown; failed?: unknown; png?: unknown; pngUpload?: unknown; rounds?: unknown; scores?: unknown; program?: unknown; edited?: unknown };
  const chatId = typeof b.chatId === "string" && UUID.test(b.chatId) ? b.chatId : null;
  if (!chatId) throw new UserError("محادثة غير صحيحة.", 400);
  if (typeof b.failed === "string") {
    await failDesign(user.id, chatId, b.failed);
    return NextResponse.json({ ok: true });
  }
  try {
    if (b.retry === true) {
      const chat = await getChat(user.id, chatId);
      if (!chat) throw new UserError("ما لقينا هذي المحادثة.", 404);
      await retry(user.id, chat);
    }
    // «حيدرا ماكس»: the page draws the design itself — first it gets the brief, then it sends the picture back
    if (typeof b.png !== "string" && typeof b.pngUpload !== "string") {
      const brief = await codeBrief(user.id, chatId, { email: user.email, origin: new URL(req.url).origin });
      if (!brief) throw new UserError("ما فيه تصميم ينتظر الرسم في هذي المحادثة.", 409);
      return NextResponse.json({ code: brief });
    }
    const r = await produceFromCode(user.id, chatId, b);
    const links = await fileLinks(user.id, chatId);
    return NextResponse.json({
      ...r,
      design: { ...r.design, artworkUrl: r.design.artwork ? links.get(r.design.artwork) ?? null : null, layers: r.design.layers.map((l) => (l.kind === "image" ? { ...l, url: links.get(l.fileId) ?? null } : l)), ...(isAdmin(user.email) ? {} : { detail: undefined }) },
    });
  } catch (e) {
    if (e instanceof Error && e.message === "chat not found") throw new UserError("ما لقينا هذي المحادثة.", 404);
    const shown = e instanceof UserError ? e : new UserError("ما قدرنا نرسم التصميم الحين؛ جرّب مرة ثانية.", 502);
    if (!(e instanceof UserError)) console.error("designer produce", e);
    await failDesign(user.id, chatId, shown.message, isAdmin(user.email) && !(e instanceof UserError) && e instanceof Error ? e.message : undefined).catch(() => null);
    throw shown;
  }
});
