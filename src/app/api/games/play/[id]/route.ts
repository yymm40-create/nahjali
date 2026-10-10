import { NextResponse } from "next/server";
import { publicGame, reportError } from "@/lib/games/build";
import { assemble, playCsp } from "@config/games-build";

export const dynamic = "force-dynamic";

/** The addresses this request came on (behind Vercel the host the person typed is in x-forwarded-host). */
function origins(req: Request): string[] {
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || url.protocol.replace(":", "");
  const hosts = [req.headers.get("x-forwarded-host")?.split(",")[0]?.trim(), req.headers.get("host")].filter((h): h is string => !!h);
  return [url.origin, ...hosts.map((h) => `${proto}://${h}`)];
}

/**
 * A game's page, for anyone with its link (shown inside the play page's frame, /play/<id>). It runs fenced off: its own
 * sandbox (no cookies or storage of the site, nothing sent anywhere), its own pictures only.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const game = await publicGame(id).catch(() => null);
  if (!game?.html) return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  return new Response(assemble(game.html, game.files), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": playCsp(origins(req)),
      // a new version has its own address (?v=), so a short keep is enough
      "cache-control": "public, max-age=60, s-maxage=60",
      "x-robots-tag": "noindex",
    },
  });
}

/** A player's browser says the game hit an error (kept, the last few, for the next fix). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as { error?: unknown };
  if (typeof b.error === "string") await reportError(id, b.error.slice(0, 300)).catch(() => null);
  return NextResponse.json({ ok: true });
}
