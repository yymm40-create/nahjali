import { NextResponse } from "next/server";
import { cleanUsername, USERNAME_RE } from "@/lib/mahdi/engine";
import { t } from "@/lib/mahdi/i18n";
import { mahdiRoute, readJson, requireUser, UserError } from "@/lib/mahdi/server/api";
import { createAdminClient } from "@/lib/supabase/admin";

const RESERVED = new Set(["admin", "administrator", "mahdi", "nahjali", "support", "help", "root", "system", "owner", "moderator", "official", "api", "www", "null", "undefined"]);

function parse(v: unknown): string {
  const name = cleanUsername(typeof v === "string" ? v : "");
  if (!USERNAME_RE.test(name)) throw new UserError(t.username.invalid, 400);
  if (RESERVED.has(name)) throw new UserError(t.username.reserved, 400);
  return name;
}

/** Is a username free? `?check=name` → `{ available }` (exact match only; nobody can list names). */
export const GET = mahdiRoute(async (req: Request) => {
  const { user } = await requireUser(req);
  const name = parse(new URL(req.url).searchParams.get("check"));
  const { data } = await createAdminClient().from("site_usernames").select("user_id").eq("username", name).maybeSingle();
  return NextResponse.json({ available: !data || data.user_id === user.id });
});

/** Sets my site-wide username: `{ username }`. Unique for the whole site. */
export const PUT = mahdiRoute(async (req: Request) => {
  const { supabase, user } = await requireUser(req);
  const username = parse((await readJson(req)).username);
  const { error } = await supabase.from("site_usernames").upsert({ user_id: user.id, username });
  if (error) {
    if ((error as { code?: string }).code === "23505") throw new UserError(t.username.taken, 409);
    throw error;
  }
  return NextResponse.json({ username });
});
