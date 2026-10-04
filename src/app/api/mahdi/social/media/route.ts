import { NextResponse } from "next/server";
import { t } from "@/lib/mahdi/i18n";
import { mahdiRoute, readJson, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { mediaUploadLink } from "@/lib/mahdi/server/media";

/** A one-time link to upload a photo or a short video straight to storage: `{ kind, size }` → `{ path, token }`. */
export const POST = mahdiRoute(async (req: Request) => {
  const { supabase, user } = await requireProfile(req);
  const { data: privacy } = await supabase.from("mahdi_privacy").select("community").maybeSingle();
  if (!privacy?.community) throw new UserError(t.social.post.needCommunity, 403);
  const body = await readJson(req);
  return NextResponse.json(await mediaUploadLink(user.id, body.kind, body.size));
});
