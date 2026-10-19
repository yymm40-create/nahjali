import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { gameOwner, gameStats } from "@/lib/games/plays";
import { isAdmin } from "@config/site";

export const dynamic = "force-dynamic";

/** «📊 الإحصائيات»: how many opened the game, played it and for how long, from where — its owner and the site's owner. */
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const user = await requireApiUser();
  const owner = await gameOwner(id);
  if (!owner || (owner !== user.id && !isAdmin(user.email))) throw new UserError("ما لقينا هذي اللعبة.", 404);
  return NextResponse.json({ stats: await gameStats(id) });
});
