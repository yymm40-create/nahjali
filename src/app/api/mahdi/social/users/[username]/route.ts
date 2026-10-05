import { NextResponse } from "next/server";
import { t } from "@/lib/mahdi/i18n";
import { mahdiRoute, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { peopleOf, profileView, personByUsername } from "@/lib/mahdi/server/social";

type Ctx = { params: Promise<{ username: string }> };

/**
 * A person's page: name, picture, counts, and how we follow each other. `?list=followers|following` returns the
 * people instead (only when I may see this person).
 */
export const GET = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { supabase, user } = await requireProfile(req);
  const person = await personByUsername(decodeURIComponent((await params).username));
  if (!person) throw new UserError(t.social.profile.notFound, 404);
  const view = await profileView(supabase, user.id, person);
  const list = new URL(req.url).searchParams.get("list");
  if (list === "followers" || list === "following") {
    if (!view.canSee) throw new UserError(t.social.profile.private, 403);
    return NextResponse.json({ people: await peopleOf(person.id, list) });
  }
  return NextResponse.json({ profile: view });
});
