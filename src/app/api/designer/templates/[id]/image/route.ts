import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { getTemplate } from "@/lib/designer/user-templates";
import { createAdminClient } from "@/lib/supabase/admin";
import { storage } from "@/lib/storage";
import { JAWAD_BUCKET } from "@/lib/jawad/server/runtime";

export const dynamic = "force-dynamic";

/** The picture of a designer's template (its empty design), for the picker and for drawing it: a short-lived link. */
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const row = /^u[0-9a-f]{8,32}$/.test(id) ? await getTemplate(id) : null;
  if (!row) throw new UserError("ما لقينا القالب.", 404);
  const { data } = await createAdminClient().from("jawad_uploads").select("storage_path").eq("id", row.upload).maybeSingle();
  if (!data?.storage_path) throw new UserError("صورة القالب انحذفت.", 404);
  const { data: s } = await storage.from(JAWAD_BUCKET).createSignedUrl(String(data.storage_path), 3600);
  if (!s?.signedUrl) throw new UserError("ما قدرنا نفتح صورة القالب.", 502);
  return NextResponse.redirect(s.signedUrl, 302);
});
