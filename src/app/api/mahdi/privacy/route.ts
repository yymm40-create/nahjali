import { NextResponse } from "next/server";
import { t } from "@/lib/mahdi/i18n";
import { check, mahdiRoute, readJson, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { syncPublicProfile } from "@/lib/mahdi/server/public";
import { notMigrated } from "@/lib/mahdi/server/social";
import { parseBool } from "@/lib/mahdi/server/validate";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Sharing switches. Ranking, picture and a private account need the community switch; turning the community off
 * removes the public copy and posts. Making the account public again lets in everyone who was waiting.
 */
export const PATCH = mahdiRoute(async (req: Request) => {
  const { supabase, user } = await requireProfile(req);
  const body = await readJson(req);
  const cur = ((await supabase.from("mahdi_privacy").select("*").maybeSingle()).data ?? {}) as Record<string, unknown>;
  const next = {
    community: "community" in body ? parseBool(body.community) : Boolean(cur.community),
    leaderboard: "leaderboard" in body ? parseBool(body.leaderboard) : Boolean(cur.leaderboard),
    show_avatar: "showAvatar" in body ? parseBool(body.showAvatar) : Boolean(cur.show_avatar),
    private_account: "privateAccount" in body ? parseBool(body.privateAccount) : Boolean(cur.private_account),
    stories_in_feed: "storiesInFeed" in body ? parseBool(body.storiesInFeed) : cur.stories_in_feed !== false,
  };
  if (!next.community) {
    if (body.leaderboard === true || body.showAvatar === true) throw new UserError(t.privacy.needCommunity, 400);
    next.leaderboard = false;
    next.show_avatar = false;
  }
  // Before migration 0020 the private account and stories switches do not exist yet
  let social = true;
  const res = await supabase.from("mahdi_privacy").upsert({ user_id: user.id, ...next });
  if (res.error && notMigrated(res.error)) {
    if ("privateAccount" in body || "storiesInFeed" in body) throw new UserError(t.social.notReady, 503);
    social = false;
    check(await supabase.from("mahdi_privacy").upsert({ user_id: user.id, community: next.community, leaderboard: next.leaderboard, show_avatar: next.show_avatar }));
  } else check(res);
  // Leaving the community also leaves every challenge ranking (the general ranking switch alone does not)
  if (!next.community) await supabase.from("mahdi_challenge_members").update({ on_leaderboard: false }).eq("user_id", user.id);
  if (social && cur.private_account && !next.private_account) await createAdminClient().from("mahdi_follows").update({ status: "accepted" }).eq("followee_id", user.id).eq("status", "pending");
  await syncPublicProfile(user.id);
  return NextResponse.json({
    privacy: { community: next.community, leaderboard: next.leaderboard, showAvatar: next.show_avatar, privateAccount: social && next.private_account, storiesInFeed: next.stories_in_feed },
  });
});
