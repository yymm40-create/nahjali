import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runDue } from "@/lib/islamic/library";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: Request): boolean {
  // the same secret as the «لأجل المهدي» dispatcher, so the owner sets nothing new
  const secret = process.env.MAHDI_CRON_SECRET;
  if (!secret || secret.length < 24) return false;
  const a = Buffer.from(req.headers.get("authorization") ?? "");
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * «الذكاء الإسلامي» · the timer's reading: called by Supabase pg_cron every 5 minutes (migration 0038); reads every
 * enabled source that isn't finished for ~4 minutes in all, so the library fills by itself with no page open.
 */
export async function POST(req: Request) {
  if (!authorized(req)) return new NextResponse(null, { status: 404 });
  try {
    return NextResponse.json({ read: await runDue(235_000) });
  } catch (err) {
    console.error("[islamic cron]", err);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
}
