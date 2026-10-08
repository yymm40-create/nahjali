import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { getOwnedProject, requireFilmApiUser } from "@/lib/film/access";
import { checkVideos } from "@/lib/film/director";
import { filmProgress } from "@/lib/film/progress";

/** «العداد»: the scene's progress and every piece being made now (polled while something runs). */
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireFilmApiUser();
  const project = await getOwnedProject((await params).id, user.id);
  // finished videos are saved on the way (the generation page's polling does the same)
  await checkVideos(project).catch(() => null);
  return NextResponse.json(await filmProgress(project), { headers: { "Cache-Control": "no-store" } });
});
