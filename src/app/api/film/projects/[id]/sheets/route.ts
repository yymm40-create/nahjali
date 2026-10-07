import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { getOwnedProject, requireFilmApiUser } from "@/lib/film/access";
import { confirmSheetUpload, latestJob, runningImageJobs, sheetAction, sheetUploadUrl, type MapChoice, type SheetAction } from "@/lib/film/sheets";

// Replies and images are produced in the background (after()), within this route's time limit
export const maxDuration = 300;

type Body = SheetAction | { action: "upload_url"; sheetId: string; mime: string } | { action: "upload_confirm"; sheetId: string; path: string; mode?: MapChoice };

/** Every user action with the sheet maker (see SheetAction), plus uploading the user's own picture for a map item. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireFilmApiUser();
  const { id } = await params;
  const project = await getOwnedProject(id, user.id, "sheets");
  const body = (await req.json().catch(() => ({}))) as Body;
  if (body.action === "upload_url") return NextResponse.json(await sheetUploadUrl(project, body.sheetId, body.mime));
  if (body.action === "upload_confirm") {
    await confirmSheetUpload(project, body.sheetId, body.path, body.mode);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json(await sheetAction(project, user, body));
});

/** Polled while something is being written or generated. */
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireFilmApiUser();
  const { id } = await params;
  await getOwnedProject(id, user.id);
  const [job, images] = await Promise.all([latestJob(id, "sheets"), runningImageJobs(id)]);
  return NextResponse.json(
    { status: job?.status ?? null, error: job?.status === "failed" ? job.error : null, imagesRunning: images.length },
    { headers: { "Cache-Control": "no-store" } },
  );
});
