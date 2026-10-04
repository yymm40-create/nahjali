import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireJawadApiUser } from "@/lib/jawad/server/access";
import { isUuid, signUpload, uploadViews, type UploadRow } from "@/lib/jawad/server/uploads";

/** JAWAD AI · step 1 of a reference upload: a pending record and a one-time upload URL (the browser uploads directly). */
export const POST = handle(async (req: Request) => {
  const { user } = await requireJawadApiUser();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(await signUpload(user.id, body));
});

/** JAWAD AI · fresh views (and links) of the user's own references, e.g. after coming back to the studio. */
export const GET = handle(async (req: Request) => {
  const { user } = await requireJawadApiUser();
  const ids = (new URL(req.url).searchParams.get("ids") ?? "").split(",").filter(isUuid).slice(0, 60);
  if (!ids.length) return NextResponse.json({ uploads: [] });
  const { data } = await createAdminClient().from("jawad_uploads").select("*").in("id", ids).eq("user_id", user.id);
  return NextResponse.json({ uploads: await uploadViews((data ?? []) as UploadRow[]) });
});
