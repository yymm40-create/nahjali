import { NextResponse } from "next/server";
import { runDue } from "@/lib/islamic/library";
// the same secret as the «لأجل المهدي» dispatcher, so the owner sets nothing new
import { cronAuthorized } from "@/lib/mahdi/server/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;


/**
 * «الذكاء الإسلامي» · the timer's reading: called by Supabase pg_cron every 5 minutes (migration 0038); reads every
 * enabled source that isn't finished for ~4 minutes in all, so the library fills by itself with no page open.
 */
export async function POST(req: Request) {
  if (!(await cronAuthorized(req))) return new NextResponse(null, { status: 404 });
  try {
    return NextResponse.json({ read: await runDue(235_000) });
  } catch (err) {
    console.error("[islamic cron]", err);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
}
