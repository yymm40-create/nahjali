import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requireJawadApiUser } from "@/lib/jawad/server/access";
import { listGallery, publishToGallery, setShare, withdrawFromGallery } from "@/lib/jawad/server/gallery";
import { isGalleryKind } from "@config/jawad/gallery";

export const dynamic = "force-dynamic";

/** «معرض الناس», open to everyone: approved works, the featured first then the newest (?kind=image|video&page=0&limit=24). */
export const GET = handle(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const kind = q.get("kind");
  const r = await listGallery({ kind: isGalleryKind(kind) ? kind : null, page: Number(q.get("page")) || 0, limit: Number(q.get("limit")) || undefined });
  return NextResponse.json(r);
});

/**
 * The work's owner only, on their own finished picture or video:
 *   publish  { outputId, title }  → waits for the site owner's approval
 *   withdraw { outputId }         → out of the gallery
 *   share    { outputId, on, title? } → the permanent link on / off
 */
export const POST = handle(async (req: Request) => {
  const { user } = await requireJawadApiUser();
  const b = (await req.json().catch(() => ({}))) as { action?: unknown; outputId?: unknown; title?: unknown; on?: unknown };
  switch (b.action) {
    case "publish":
      return NextResponse.json({ item: await publishToGallery(user, b.outputId, b.title) });
    case "withdraw":
      return NextResponse.json({ item: await withdrawFromGallery(user, b.outputId) });
    case "share":
      return NextResponse.json({ item: await setShare(user, b.outputId, b.on === true, b.title) });
    default:
      throw new UserError("طلب غير صحيح.", 400);
  }
});
