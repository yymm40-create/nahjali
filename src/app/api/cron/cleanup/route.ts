import { NextResponse } from "next/server";
import { deleteExpiredSourcePhotos } from "@/lib/orders";

/**
 * Daily Vercel Cron (vercel.json): deletes original photos that were never approved.
 * Safe to be public — it only deletes photos the privacy policy already says are deleted.
 */
export async function GET() {
  const checked = await deleteExpiredSourcePhotos();
  return NextResponse.json({ ok: true, checked });
}
