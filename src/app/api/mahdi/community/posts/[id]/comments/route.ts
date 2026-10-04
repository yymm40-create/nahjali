import { NextResponse } from "next/server";
import { t } from "@/lib/mahdi/i18n";
import { mahdiRoute, readJson, requireId, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { addComment, commentsOf, usersById } from "@/lib/mahdi/server/social";
import { cleanText } from "@/lib/mahdi/server/validate";

type Ctx = { params: Promise<{ id: string }> };

/** The comments of a post I may see, oldest first. */
export const GET = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { supabase, user } = await requireProfile(req);
  return NextResponse.json({ comments: await commentsOf(supabase, user.id, requireId((await params).id)) });
});

/** Adds a comment `{ body }` (members of the community; the post's author is told). */
export const POST = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { supabase, user } = await requireProfile(req);
  const id = requireId((await params).id);
  const raw = await readJson(req);
  if (typeof raw.body === "string" && raw.body.trim().length > 500) throw new UserError(t.social.commentTooLong, 400);
  const body = cleanText(raw.body, 500);
  if (!body) throw new UserError(t.errors.invalid, 400);
  const me = (await usersById([user.id])).get(user.id);
  if (!me) throw new UserError(t.social.post.needCommunity, 403);
  await addComment(supabase, me, id, body);
  return NextResponse.json({ comments: await commentsOf(supabase, user.id, id) });
});

/** Deletes a comment `?comment=<id>`: my own, or any on my post (RLS decides). */
export const DELETE = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { supabase, user } = await requireProfile(req);
  const id = requireId((await params).id);
  const cid = requireId(new URL(req.url).searchParams.get("comment"));
  const { data } = await supabase.from("mahdi_post_comments").delete().eq("id", cid).eq("post_id", id).select("id");
  if (!data?.length) throw new UserError(t.errors.notFound, 404);
  return NextResponse.json({ comments: await commentsOf(supabase, user.id, id) });
});
