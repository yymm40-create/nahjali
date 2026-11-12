import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requireJawadOwner } from "@/lib/jawad/server/access";
import { reviewWork } from "@/lib/jawad/server/gallery";
import { isReviewAction } from "@config/jawad/gallery";

export const dynamic = "force-dynamic";

/** The site's owner only (404 for everyone else): «معرض الناس» review — { id, action: approve|reject|hide|feature|unfeature }. */
export const POST = handle(async (req: Request) => {
  const owner = await requireJawadOwner();
  const b = (await req.json().catch(() => ({}))) as { id?: unknown; action?: unknown };
  if (!isReviewAction(b.action)) throw new UserError("طلب غير صحيح.", 400);
  return NextResponse.json({ item: await reviewWork(owner.email ?? owner.id, b.id, b.action) });
});
