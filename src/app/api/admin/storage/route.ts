import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { isAdmin } from "@config/site";
import { copyFromSupabase } from "@/lib/storage/migrate";

export const maxDuration = 300;

/** Owner only: copies the old Supabase files to R2 for about four minutes; the page calls it again until done. */
export const POST = handle(async () => {
  const user = await requireApiUser();
  if (!isAdmin(user.email)) throw new UserError("غير مسموح.", 404);
  return NextResponse.json(await copyFromSupabase(240_000));
});
