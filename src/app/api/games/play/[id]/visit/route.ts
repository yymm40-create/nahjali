import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { beat } from "@/lib/games/plays";
import { deviceOf } from "@/lib/games/plays-shared";

export const dynamic = "force-dynamic";

/**
 * The game's counter: a player's browser says the game is on screen (a sitting opened, or the seconds since the last
 * beat). Anyone with the link; the body may come as text (navigator.sendBeacon when the page closes).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = ((await req.text().then((t) => JSON.parse(t)).catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const { data } = await (await createClient()).auth.getUser().catch(() => ({ data: { user: null } }));
  const session = await beat(
    id,
    {
      visitor: String(b.visitor ?? ""),
      session: typeof b.session === "string" ? b.session : null,
      add: Number(b.add) || 0,
      source: typeof b.source === "string" ? b.source : "",
      device: deviceOf(req.headers.get("user-agent") ?? ""),
    },
    data.user?.id ?? null,
  ).catch(() => null);
  return NextResponse.json({ session });
}
