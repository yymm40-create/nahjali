import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { pictureReview, pictureWrite } from "@/lib/claude-code/picture";
import { canDraw, savePicture } from "@/lib/jawad/server/claude-code-picture";

export const dynamic = "force-dynamic";
// a program for a big picture, then its reviews: each call waits for one long Claude answer
export const maxDuration = 800;

/** «Claude Code» in the image studio: write (or fix) the picture's program · review the rendered picture · save it. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (b.action === "save") return NextResponse.json(await savePicture(user, b));
  if (!(await canDraw(user.email, b.from))) throw new UserError("صناعة الصور مقفلة لحسابك حاليًا.", 403);
  if (b.action === "write") return NextResponse.json(await pictureWrite(user, b));
  if (b.action === "review") return NextResponse.json(await pictureReview(user, b));
  throw new UserError("طلب غير معروف.", 400);
});
