import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireJawadApiUser } from "@/lib/jawad/server/access";
import { JAWAD_BUCKET } from "@/lib/jawad/server/runtime";
import { isUuid } from "@/lib/jawad/server/uploads";
import { outputName } from "@/lib/jawad/server/works";

import { storage } from "@/lib/storage";
/** JAWAD AI · downloads one of the user's results (a short-lived link, only for its owner). */
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { user } = await requireJawadApiUser();
  const { id } = await params;
  if (!isUuid(id)) throw new UserError("طلب غير صحيح.", 400);
  const db = createAdminClient();
  const { data } = await db.from("jawad_outputs").select("storage_path,idx,job_id").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!data) throw new UserError("ما لقينا هذا العمل.", 404);
  const ext = String(data.storage_path).split(".").pop();
  const name = `jawad-ai-${String(data.job_id).slice(0, 8)}-${outputName(String(data.storage_path)) ?? data.idx + 1}.${ext}`;
  const { data: link, error } = await storage.from(JAWAD_BUCKET).createSignedUrl(data.storage_path, 600, { download: name });
  if (error) throw error;
  return NextResponse.redirect(link.signedUrl);
});
