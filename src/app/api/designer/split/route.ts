import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requireDesignerUser } from "@/lib/designer/access";
import { fileLinks } from "@/lib/designer/files";
import { splitReady, splitUpload } from "@/lib/designer/split";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const UUID = /^[0-9a-f-]{36}$/i;

/** «المصمم الذكي» · splits one of the person's uploaded pictures into layers (the subject cut out over the original). */
export const POST = handle(async (req: Request) => {
  const { user } = await requireDesignerUser();
  const b = (await req.json().catch(() => ({}))) as { chatId?: unknown; uploadId?: unknown };
  const chatId = typeof b.chatId === "string" && UUID.test(b.chatId) ? b.chatId : null;
  const uploadId = typeof b.uploadId === "string" && UUID.test(b.uploadId) ? b.uploadId : null;
  if (!chatId || !uploadId) throw new UserError("طلب غير صحيح.", 400);
  if (!splitReady()) throw new UserError("تفكيك الصور إلى طبقات غير مفعّل على الخادم حاليًا.", 503);
  try {
    const design = await splitUpload(user.id, chatId, uploadId);
    const links = await fileLinks(user.id, chatId);
    return NextResponse.json({ design: { ...design, artworkUrl: design.artwork ? links.get(design.artwork) ?? null : null, layers: design.layers.map((l) => (l.kind === "image" ? { ...l, url: links.get(l.fileId) ?? null } : l)) } });
  } catch (e) {
    if (e instanceof UserError) throw e;
    if (e instanceof Error && e.message === "chat not found") throw new UserError("ما لقينا هذي المحادثة.", 404);
    console.error("designer split", e);
    throw new UserError("تعذّر تفكيك الصورة الحين؛ جرّب مرة ثانية.", 502);
  }
});
