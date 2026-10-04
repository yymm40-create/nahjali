import { NextResponse } from "next/server";
import { buildTimeline } from "@/lib/mahdi/engine";
import { t } from "@/lib/mahdi/i18n";
import { challengeHabits, toItems } from "@/lib/mahdi/client/derive";
import { buildShare, SHARE_KINDS, type ShareKind } from "@/lib/mahdi/client/share";
import { mahdiRoute, readJson, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { loadSnapshot } from "@/lib/mahdi/server/snapshot";
import { syncPublicProfile } from "@/lib/mahdi/server/public";
import { createAdminClient } from "@/lib/supabase/admin";
import { MEDIA_POST_KINDS, type MediaPostKind } from "@/lib/mahdi/social";
import { checkUploadedMedia } from "@/lib/mahdi/server/media";
import { feed, notMigrated, postViews, userByUsername } from "@/lib/mahdi/server/social";
import { cleanLine, cleanText } from "@/lib/mahdi/server/validate";

/**
 * A page of posts, newest first: `?feed=following` (people I follow and me; the default), `?feed=explore` (public
 * accounts) or `?user=<username>` (one person's page). The database decides what I may see.
 */
export const GET = mahdiRoute(async (req: Request) => {
  const { supabase, user } = await requireProfile(req);
  const sp = new URL(req.url).searchParams;
  const before = sp.get("before");
  const username = sp.get("user");
  if (username) {
    const person = await userByUsername(username);
    if (!person) throw new UserError(t.social.profile.notFound, 404);
    return NextResponse.json(await feed(supabase, user.id, { kind: "user", userId: person.id, before }));
  }
  return NextResponse.json(await feed(supabase, user.id, { kind: sp.get("feed") === "explore" ? "explore" : "following", before }));
});

/**
 * Posts something. A photo, a quote or a video (`{ kind, caption, media | quote }`, the file already uploaded with a
 * link from /api/mahdi/social/media), or an achievement card whose numbers are computed here from the user's real
 * data, never taken from the browser.
 */
export const POST = mahdiRoute(async (req: Request) => {
  const { supabase, user, profile } = await requireProfile(req);
  const { data: privacy } = await supabase.from("mahdi_privacy").select("community").maybeSingle();
  if (!privacy?.community) throw new UserError(t.share.needCommunity, 403);
  const body = await readJson(req);

  // At most 10 posts a day per person
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await supabase.from("mahdi_posts").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since);
  if ((count ?? 0) >= 10) throw new UserError(t.social.post.tooMany, 429);

  if (MEDIA_POST_KINDS.includes(body.kind as MediaPostKind)) {
    const kind = body.kind as MediaPostKind;
    const caption = cleanText(body.caption, 1000);
    let row: Record<string, unknown> = { user_id: user.id, kind, caption, payload: {} };
    if (kind === "quote") {
      const q = (body.quote ?? {}) as { text?: unknown; by?: unknown };
      const text = cleanText(q.text, 500);
      if (!text) throw new UserError(t.social.post.needQuote, 400);
      row.payload = { text, by: cleanLine(q.by, 80) };
    } else {
      const m = await checkUploadedMedia(user.id, body.media, kind === "photo" ? "image" : "video");
      row = { ...row, media_path: m.path, media_kind: m.kind, media_ms: m.ms, width: m.width, height: m.height };
    }
    await syncPublicProfile(user.id);
    const { data, error } = await createAdminClient().from("mahdi_posts").insert(row).select("*").single();
    if (error) {
      if (notMigrated(error) || error.code === "23514") throw new UserError(t.social.notReady, 503);
      throw error;
    }
    const [view] = await postViews([data], user.id);
    return NextResponse.json({ id: data.id, post: view });
  }

  const kind = body.kind as ShareKind;
  if (!SHARE_KINDS.includes(kind)) throw new UserError(t.errors.invalid, 400);
  const closing = typeof body.closing === "string" && (t.share.closings as readonly string[]).includes(body.closing) ? body.closing : "";

  const snap = await loadSnapshot(supabase, profile);
  const tl = buildTimeline(toItems([...snap.habits, ...challengeHabits(snap)], snap.logs), snap.logsFrom, snap.today, { asOf: snap.today, weekStart: profile.weekStart });
  const payload = buildShare(tl, snap, {
    kind,
    showDelta: body.showDelta === true,
    projectId: typeof body.projectId === "string" ? body.projectId : undefined,
    habitId: typeof body.habitId === "string" ? body.habitId : undefined,
    milestoneId: typeof body.milestoneId === "string" ? body.milestoneId : undefined,
    bookId: typeof body.bookId === "string" ? body.bookId : undefined,
  });
  if (!payload) throw new UserError(t.reports.noData, 400);

  await syncPublicProfile(user.id);
  const { data, error } = await createAdminClient().from("mahdi_posts").insert({ user_id: user.id, kind, payload, closing }).select("id").single();
  if (error) throw error;
  return NextResponse.json({ id: data.id, payload });
});
