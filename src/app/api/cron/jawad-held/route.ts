import { NextResponse } from "next/server";
import { sendHeldJobs } from "@/lib/jawad/server/jobs";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Every minute (vercel.json): «لامحدود»'s slow generations whose wait is over are sent, even when nobody has the studio open.
 * Sending happens once per job (runJob claims it), so an extra call changes nothing.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return new Response(null, { status: 404 });
  await sendHeldJobs().catch((e) => console.error("jawad held sweep failed", e));
  return NextResponse.json({ ok: true });
}
