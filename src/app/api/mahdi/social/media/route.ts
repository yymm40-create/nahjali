import { NextResponse } from "next/server";
import { SOCIAL_VIDEO } from "@config/mahdi";
import { t } from "@/lib/mahdi/i18n";
import { mahdiRoute, readJson, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { mediaUploadLink } from "@/lib/mahdi/server/media";

/** A one-time link to upload a photo (or a short video, when videos are on) straight to storage: `{ kind, size }` → `{ path, token }`. */
export const POST = mahdiRoute(async (req: Request) => {
  const { supabase, user } = await requireProfile(req);
  const { data: privacy } = await supabase.from("mahdi_privacy").select("community").maybeSingle();
  if (!privacy?.community) throw new UserError(t.social.post.needCommunity, 403);
  const body = await readJson(req);
  if (body.kind === "video" && !SOCIAL_VIDEO) throw new UserError(t.social.media.videoOff, 400);
  return NextResponse.json(await mediaUploadLink(user.id, body.kind, body.size));
});
