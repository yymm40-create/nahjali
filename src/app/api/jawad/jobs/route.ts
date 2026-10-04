import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { coinBalance } from "@/lib/coins";
import { requireJawadApiUser } from "@/lib/jawad/server/access";
import { advanceJob, type JobRow } from "@/lib/jawad/server/jobs";
import { isUuid } from "@/lib/jawad/server/uploads";
import { jobViews } from "@/lib/jawad/server/works";

export const maxDuration = 300;

/**
 * JAWAD AI · the studio's polling: the state of the user's given jobs. Unfinished ones are first moved forward from
 * the provider's real state (and finished videos saved), so the page survives refreshes and new sign-ins.
 */
export const GET = handle(async (req: Request) => {
  const { user } = await requireJawadApiUser();
  const ids = (new URL(req.url).searchParams.get("ids") ?? "").split(",").filter(isUuid).slice(0, 30);
  if (!ids.length) return NextResponse.json({ jobs: [], balance: await coinBalance(user.id) });
  const db = createAdminClient();
  const load = async () => ((await db.from("jawad_jobs").select("*").in("id", ids).eq("user_id", user.id)).data ?? []) as JobRow[];
  for (const j of await load()) await advanceJob(j).catch((e) => console.error("jawad advance failed", j.id, e));
  return NextResponse.json({ jobs: await jobViews(await load()), balance: await coinBalance(user.id) });
});
