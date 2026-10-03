import { NextResponse } from "next/server";
import { t } from "@/lib/mahdi/i18n";
import { mahdiRoute, readJson, requireUser, UserError } from "@/lib/mahdi/server/api";
import { checkUsername, claimUsername } from "@/lib/username";
import type { UsernameProblem } from "@/lib/username-rules";

const message = (p: UsernameProblem) => (p === "taken" ? t.username.taken : p === "reserved" ? t.username.reserved : t.username.invalid);

/** Is a username free? `?check=name` → `{ available, name, problem }` (exact match only; nobody can list names). */
export const GET = mahdiRoute(async (req: Request) => {
  const { user } = await requireUser(req);
  const r = await checkUsername(new URL(req.url).searchParams.get("check") ?? "", user.id);
  return NextResponse.json({ available: !r.problem, name: r.name, problem: r.problem, message: r.problem ? message(r.problem) : "" });
});

/** Sets my site-wide username: `{ username }`. Unique for the whole site. */
export const PUT = mahdiRoute(async (req: Request) => {
  const { supabase, user } = await requireUser(req);
  const body = await readJson(req);
  const r = await claimUsername(supabase, user.id, typeof body.username === "string" ? body.username : "");
  if (r.problem) throw new UserError(message(r.problem), r.problem === "taken" ? 409 : 400);
  return NextResponse.json({ username: r.name });
});
