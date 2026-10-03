import { NextResponse } from "next/server";
import { t } from "@/lib/mahdi/i18n";
import { cleanLine } from "@/lib/mahdi/server/validate";
import { mahdiRoute, readJson, requireId, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { createAdminClient } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

/** React (دعاء / تشجيع) or report: `{ react: "dua", on: true }` or `{ report: "reason" }`. */
export const POST = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { supabase, user } = await requireProfile(req);
  const id = requireId((await params).id);
  const body = await readJson(req);
  if (body.react === "dua" || body.react === "support") {
    if (body.on) await supabase.from("mahdi_post_reactions").upsert({ post_id: id, user_id: user.id, kind: body.react }, { ignoreDuplicates: true });
    else await supabase.from("mahdi_post_reactions").delete().eq("post_id", id).eq("user_id", user.id).eq("kind", body.react);
    return NextResponse.json({ ok: true });
  }
  if ("report" in body) {
    await supabase.from("mahdi_post_reports").upsert({ post_id: id, user_id: user.id, reason: cleanLine(body.report, 300) }, { ignoreDuplicates: true });
    return NextResponse.json({ ok: true });
  }
  throw new UserError(t.errors.invalid, 400);
});

/** Deletes one of my own posts. */
export const DELETE = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { user } = await requireProfile(req);
  const id = requireId((await params).id);
  const { data } = await createAdminClient().from("mahdi_posts").delete().eq("id", id).eq("user_id", user.id).select("id");
  if (!data?.length) throw new UserError(t.errors.notFound, 404);
  return NextResponse.json({ ok: true });
});
