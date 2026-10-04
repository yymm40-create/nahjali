import { NextResponse } from "next/server";
import { t } from "@/lib/mahdi/i18n";
import { cleanLine } from "@/lib/mahdi/server/validate";
import { mahdiRoute, readJson, requireId, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { REPORT_CATEGORIES, type ReportCategory } from "@/lib/mahdi/social";
import { ahsant, deletePost, postViews, report, usersById, visiblePost } from "@/lib/mahdi/server/social";

type Ctx = { params: Promise<{ id: string }> };

/** One post (for its own page), if I may see it. */
export const GET = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { supabase, user } = await requireProfile(req);
  const post = await visiblePost(supabase, requireId((await params).id));
  const [view] = await postViews([post], user.id);
  return NextResponse.json({ post: view });
});

/**
 * `{ react: "ahsant", on }` («أحسنت»; the older "dua" / "support" still work), or
 * `{ report: "reason", category: "singing" | "indecent" | "abuse" | "other" }`.
 */
export const POST = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { supabase, user } = await requireProfile(req);
  const id = requireId((await params).id);
  const body = await readJson(req);
  if (body.react === "ahsant") {
    const me = (await usersById([user.id])).get(user.id);
    if (!me) throw new UserError(t.social.post.needCommunity, 403);
    await ahsant(supabase, me, id, Boolean(body.on));
    return NextResponse.json({ ok: true });
  }
  if (body.react === "dua" || body.react === "support") {
    if (body.on) await supabase.from("mahdi_post_reactions").upsert({ post_id: id, user_id: user.id, kind: body.react }, { ignoreDuplicates: true });
    else await supabase.from("mahdi_post_reactions").delete().eq("post_id", id).eq("user_id", user.id).eq("kind", body.react);
    return NextResponse.json({ ok: true });
  }
  if ("report" in body) {
    const category: ReportCategory = REPORT_CATEGORIES.includes(body.category as ReportCategory) ? (body.category as ReportCategory) : "other";
    await report(supabase, user.id, { post: id }, category, cleanLine(body.report, 300));
    return NextResponse.json({ ok: true });
  }
  throw new UserError(t.errors.invalid, 400);
});

/** Deletes one of my own posts (and its file). */
export const DELETE = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { user } = await requireProfile(req);
  await deletePost(requireId((await params).id), user.id);
  return NextResponse.json({ ok: true });
});
