import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** The deployment now live (the page compares it with the one it was loaded from: «في نسخة جديدة»). */
export function GET() {
  return NextResponse.json({ build: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? "dev" }, { headers: { "Cache-Control": "no-store" } });
}
