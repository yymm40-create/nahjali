import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { getOwnedProject, requireFilmApiUser } from "@/lib/film/access";
import { studioVideos } from "@/lib/film/studio-link";

/** The user's finished videos in JAWAD AI's video section, to choose one for a film generation. */
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireFilmApiUser();
  await getOwnedProject((await params).id, user.id);
  return NextResponse.json({ videos: await studioVideos(user.id) }, { headers: { "Cache-Control": "no-store" } });
});
