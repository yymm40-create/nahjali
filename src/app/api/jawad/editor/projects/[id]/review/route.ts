import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requireEditorApiUser } from "@/lib/jawad/server/access";
import { requireEditorProject } from "@/lib/editor/server";
import { deleteReview, markSeen, ownerReply, ownerReview, resolveComment, shareVersion, signReviewUpload, updateReview } from "@/lib/editor/review-server";

// checking an uploaded video (up to 200 MB) reads it whole once
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };
const noStore = { headers: { "Cache-Control": "no-store" } };

/** «حيدرة كت» · «تعليقات المراجعة»: the project's review link, its versions and the client's comments (the owner only). */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { user } = await requireEditorApiUser();
  const p = await requireEditorProject((await ctx.params).id, user.id);
  return NextResponse.json(await ownerReview(p, user.id), noStore);
});

/**
 * `{ action, … }`: sign (a one-time upload URL for the video), share (`uploadId` or `fromExport`, + `expiry`,
 * `allowDownload` for a new link), settings (`active`, `allowDownload`, `expiry`), reply, resolve, seen, delete.
 */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const { user } = await requireEditorApiUser();
  const p = await requireEditorProject((await ctx.params).id, user.id);
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  switch (b.action) {
    case "sign":
      return NextResponse.json(await signReviewUpload(p, user.id, b));
    case "share":
      return NextResponse.json(await shareVersion(p, user.id, b));
    case "settings":
      await updateReview(p, user.id, b);
      break;
    case "reply":
      await ownerReply(p, user.id, b);
      break;
    case "resolve":
      await resolveComment(p, user.id, b);
      break;
    case "seen":
      await markSeen(p, user.id);
      break;
    case "delete":
      await deleteReview(p, user.id);
      break;
    default:
      throw new UserError("طلب غير معروف.", 400);
  }
  return NextResponse.json(await ownerReview(p, user.id), noStore);
});
