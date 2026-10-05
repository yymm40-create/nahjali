import { NextResponse } from "next/server";
import { t } from "@/lib/mahdi/i18n";
import { mahdiRoute, readJson, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { followAction, personByUsername, usersById } from "@/lib/mahdi/server/social";

const ACTIONS = ["follow", "unfollow", "accept", "decline", "remove"];

/** `{ username, action }`: follow / unfollow (or cancel a request), accept / decline a request, remove a follower. */
export const POST = mahdiRoute(async (req: Request) => {
  const { user } = await requireProfile(req);
  const body = await readJson(req);
  if (!ACTIONS.includes(String(body.action))) throw new UserError(t.errors.invalid, 400);
  const me = (await usersById([user.id])).get(user.id);
  if (!me) throw new UserError(t.social.post.needCommunity, 403);
  const other = await personByUsername(String(body.username ?? ""));
  if (!other) throw new UserError(t.social.profile.notFound, 404);
  return NextResponse.json({ state: await followAction(me, other, String(body.action)) });
});
