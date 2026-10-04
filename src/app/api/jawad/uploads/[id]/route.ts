import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireJawadApiUser } from "@/lib/jawad/server/access";
import { deleteUpload } from "@/lib/jawad/server/uploads";

/** JAWAD AI · deletes one of the user's references. */
export const DELETE = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { user } = await requireJawadApiUser();
  await deleteUpload(user.id, (await params).id);
  return NextResponse.json({ ok: true });
});
