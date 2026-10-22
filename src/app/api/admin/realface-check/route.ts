import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { isAdmin } from "@config/site";
import { realFacePing } from "@/lib/jawad/server/providers/realface";

export const dynamic = "force-dynamic";

/** The owner opens /api/admin/realface-check: whether «Seedance وجه واقعي» can reach its provider with the server's key. */
export const GET = handle(async () => {
  const user = await requireApiUser();
  if (!isAdmin(user.email)) throw new UserError("غير مسموح.", 404);
  return NextResponse.json(await realFacePing());
});
