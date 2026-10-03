import { NextResponse } from "next/server";
import { t } from "@/lib/mahdi/i18n";
import { check, mahdiRoute, readJson, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { syncPublicProfile } from "@/lib/mahdi/server/public";
import { parseBool } from "@/lib/mahdi/server/validate";

/** Sharing switches. Ranking and picture need the community switch; turning the community off removes the public copy and posts. */
export const PATCH = mahdiRoute(async (req: Request) => {
  const { supabase, user } = await requireProfile(req);
  const body = await readJson(req);
  const cur = (await supabase.from("mahdi_privacy").select("community, leaderboard, show_avatar").maybeSingle()).data ?? { community: false, leaderboard: false, show_avatar: false };
  const next = {
    community: "community" in body ? parseBool(body.community) : cur.community,
    leaderboard: "leaderboard" in body ? parseBool(body.leaderboard) : cur.leaderboard,
    show_avatar: "showAvatar" in body ? parseBool(body.showAvatar) : cur.show_avatar,
  };
  if (!next.community) {
    if (body.leaderboard === true || body.showAvatar === true) throw new UserError(t.privacy.needCommunity, 400);
    next.leaderboard = false;
    next.show_avatar = false;
  }
  check(await supabase.from("mahdi_privacy").upsert({ user_id: user.id, ...next }));
  // Leaving the community also leaves every challenge ranking (the general ranking switch alone does not)
  if (!next.community) await supabase.from("mahdi_challenge_members").update({ on_leaderboard: false }).eq("user_id", user.id);
  await syncPublicProfile(user.id);
  return NextResponse.json({ privacy: { community: next.community, leaderboard: next.leaderboard, showAvatar: next.show_avatar } });
});
