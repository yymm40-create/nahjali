import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { publicWork } from "@/lib/jawad/server/gallery";

export const dynamic = "force-dynamic";

/** One public work (in the gallery, or shared while its link is on) — what «جرّبه» fills the studio with. */
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const item = await publicWork((await params).id);
  if (!item) throw new UserError("هذا العمل ما عاد موجود في المعرض.", 404);
  return NextResponse.json({ item });
});
