import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requirePhotoUser } from "@/lib/photo/access";
import { gradeReview, gradeWrite } from "@/lib/claude-code/grade";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** «زهراء فوتو ماستر» · «Claude Code» colour: write (or fix) the grade program, and review it before/after. */
export const POST = handle(async (req: Request) => {
  const { user } = await requirePhotoUser();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (b.action === "write") return NextResponse.json(await gradeWrite(user, "زهراء", b));
  if (b.action === "review") return NextResponse.json(await gradeReview(user, "زهراء", b));
  throw new UserError("طلب غير معروف.", 400);
});
