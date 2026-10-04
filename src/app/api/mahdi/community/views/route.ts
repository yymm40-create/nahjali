import { NextResponse } from "next/server";
import { mahdiRoute, readJson, requireProfile, UUID_RE } from "@/lib/mahdi/server/api";
import { recordViews } from "@/lib/mahdi/server/social";

/** Posts I have seen `{ posts: [ids] }`: each counts once per person. */
export const POST = mahdiRoute(async (req: Request) => {
  const { supabase, user } = await requireProfile(req);
  const body = await readJson(req);
  const ids = Array.isArray(body.posts) ? body.posts.filter((x): x is string => typeof x === "string" && UUID_RE.test(x)).slice(0, 50) : [];
  await recordViews(supabase, user.id, ids).catch(() => {});
  return NextResponse.json({ ok: true });
});
