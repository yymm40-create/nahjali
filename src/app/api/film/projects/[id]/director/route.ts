import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { getOwnedProject, requireFilmApiUser } from "@/lib/film/access";
import { checkVideos, directorAction, type DirectorAction } from "@/lib/film/director";
import { latestJob } from "@/lib/film/sheets";

// Replies and videos are produced in the background (after()), within this route's time limit
export const maxDuration = 300;

/** Every user action with the director (see DirectorAction). */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireFilmApiUser();
  const { id } = await params;
  const project = await getOwnedProject(id, user.id, "director");
  const body = (await req.json().catch(() => ({}))) as DirectorAction;
  return NextResponse.json(await directorAction(project, user, body));
});

/** Polled while the director writes or videos are generated; finished videos are saved here. */
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireFilmApiUser();
  const { id } = await params;
  const project = await getOwnedProject(id, user.id);
  const [job, videosRunning] = await Promise.all([latestJob(id, "director"), checkVideos(project)]);
  return NextResponse.json(
    { status: job?.status ?? null, error: job?.status === "failed" ? job.error : null, videosRunning },
    { headers: { "Cache-Control": "no-store" } },
  );
});
