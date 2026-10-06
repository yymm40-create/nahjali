import { NextResponse } from "next/server";
import { deleteExpiredSourcePhotos } from "@/lib/orders";
import { advanceOpenJobs } from "@/lib/jawad/server/jobs";
import { studentSweep } from "@/lib/jawad/student/cleanup";
import { sweepEditor } from "@/lib/editor/server";

export const maxDuration = 300;

/**
 * Daily Vercel Cron (vercel.json): deletes original photos that were never approved.
 * Safe to be public — it only deletes photos the privacy policy already says are deleted.
 * Also moves JAWAD AI's unfinished jobs forward (saves finished videos, refunds stale ones) in case nobody had the
 * studio open; every step there happens once, so an extra call changes nothing.
 */
export async function GET(req: Request) {
  // With CRON_SECRET set in Vercel, Vercel's own cron sends it and nobody else can start this sweep
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return new Response(null, { status: 404 });
  const checked = await deleteExpiredSourcePhotos();
  await advanceOpenJobs(undefined, 50).catch((e) => console.error("jawad sweep failed", e));
  // «الطالب الذكي»: projects idle for 30 days are deleted with their files; unfinished steps continue
  await studentSweep().catch((e) => console.error("student sweep failed", e));
  // «الممنتج الذكي»: 3 days after an export the project's clips and files are deleted (the person was warned)
  await sweepEditor().catch((e) => console.error("editor sweep failed", e));
  return NextResponse.json({ ok: true, checked });
}
