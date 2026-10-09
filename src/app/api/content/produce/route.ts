import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requireContentUser } from "@/lib/content/access";
import { producedLinks } from "@/lib/content/files";
import { produce } from "@/lib/content/produce";
import { isAdmin } from "@config/site";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * «صانع المحتوى» · the produce step: draws the next slides of the carousel «محمد باقر» ordered (GPT Image 2), a few at
 * a time — the page calls it again while `running`. `retry` (slide numbers, or "failed") draws those slides again.
 */
export const POST = handle(async (req: Request) => {
  const { user } = await requireContentUser();
  const b = (await req.json().catch(() => ({}))) as { chatId?: unknown; retry?: unknown };
  const chatId = typeof b.chatId === "string" && UUID.test(b.chatId) ? b.chatId : null;
  if (!chatId) throw new UserError("محادثة غير صحيحة.", 400);
  const retry = b.retry === "failed" ? ("failed" as const) : Array.isArray(b.retry) ? b.retry.map(Number).filter((n) => Number.isInteger(n) && n > 0 && n <= 40).slice(0, 40) : undefined;
  try {
    const r = await produce(user.id, chatId, { retry, owner: isAdmin(user.email), email: user.email, origin: new URL(req.url).origin });
    const [links, downloads] = await Promise.all([producedLinks(user.id, chatId), producedLinks(user.id, chatId, true)]);
    return NextResponse.json({
      ...r,
      slides: r.slides.map((s) => ({ ...s, url: links.get(s.fileId) ?? null, download: downloads.get(s.fileId) ?? null })),
      failed: r.failed.map(({ n, reason, detail, text }) => ({ n, reason, detail, text })),
    });
  } catch (e) {
    if (e instanceof UserError) throw e;
    if (e instanceof Error && e.message === "chat not found") throw new UserError("ما لقينا هذي المحادثة.", 404);
    console.error("content produce", e);
    throw new UserError("ما قدرنا ننتج الشرائح الحين؛ جرّب مرة ثانية.", 502);
  }
});
