import { NextResponse } from "next/server";
import { t } from "@/lib/mahdi/i18n";
import { mahdiRoute, readJson, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { syncPublicProfile } from "@/lib/mahdi/server/public";
import { addStory, storyGroups } from "@/lib/mahdi/server/stories";

/** The live stories I may see, grouped by person. */
export const GET = mahdiRoute(async (req: Request) => {
  const { supabase, user } = await requireProfile(req);
  return NextResponse.json({ groups: await storyGroups(supabase, user.id) });
});

/** A new story `{ kind: "photo" | "video" | "quote", media?, text, style }` (24 hours). */
export const POST = mahdiRoute(async (req: Request) => {
  const { supabase, user } = await requireProfile(req);
  const { data: privacy } = await supabase.from("mahdi_privacy").select("community").maybeSingle();
  if (!privacy?.community) throw new UserError(t.social.post.needCommunity, 403);
  await syncPublicProfile(user.id);
  await addStory(supabase, user.id, await readJson(req));
  return NextResponse.json({ groups: await storyGroups(supabase, user.id) });
});
