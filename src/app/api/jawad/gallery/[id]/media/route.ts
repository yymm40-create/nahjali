import { NextResponse } from "next/server";
import { jawadSession } from "@/lib/jawad/server/access";
import { mediaLink } from "@/lib/jawad/server/gallery";

export const dynamic = "force-dynamic";

/**
 * The picture or video of one gallery work, at an address that keeps working: each request checks the work is still
 * public (or the viewer is its owner / the site's owner) and redirects to a fresh short link to that one file.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const url = await mediaLink((await params).id, async () => (await jawadSession()).user).catch(() => null);
  if (!url) return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  // kept briefly by the viewer's browser only (the signed link lives an hour; turning a link off stops it within minutes)
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, max-age=300" } });
}
