import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { getOwnedProject, requireFilmApiUser } from "@/lib/film/access";
import { takeBrandPicture } from "@/lib/film/ad-brand";
import { withProjectClaude } from "@/lib/film/journey";
import { confirmSheetUpload, latestJob, runningImageJobs, runningLikeness, sheetAction, sheetUploadUrl, takeSeriesCast, type MapChoice, type SheetAction } from "@/lib/film/sheets";

// Replies and images are produced in the background (after()), within this route's time limit
export const maxDuration = 800;

type Body =
  | SheetAction
  | { action: "upload_url"; sheetId: string; mime: string }
  | { action: "upload_confirm"; sheetId: string; path: string; mode?: MapChoice; /** «📤 ارفع صورة جاهزة» on a sheet's card: it becomes the item's picture as it is, now */ use?: boolean }
  | { action: "use_series_cast"; sheetId: string; castId: string }
  | { action: "use_brand"; sheetId: string; assetId: string };

/** Every user action with the sheet maker (see SheetAction), plus uploading the user's own picture for a map item. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireFilmApiUser();
  const { id } = await params;
  const project = await getOwnedProject(id, user.id, "sheets");
  const body = (await req.json().catch(() => ({}))) as Body;
  if (body.action === "upload_url") return NextResponse.json(await sheetUploadUrl(project, body.sheetId, body.mime));
  if (body.action === "upload_confirm") {
    if (body.use) {
      const assetId = await confirmSheetUpload(project, body.sheetId, body.path, "as_is", true);
      return NextResponse.json(await sheetAction(project, user, { action: "use_own_picture", sheetId: body.sheetId, assetId }));
    }
    await confirmSheetUpload(project, body.sheetId, body.path, body.mode);
    return NextResponse.json({ ok: true });
  }
  // a series' scene: a character, a place or the style taken from its series, as it is
  if (body.action === "use_series_cast") {
    await takeSeriesCast(project, body.sheetId, body.castId);
    return NextResponse.json({ ok: true });
  }
  // an ad: one of the brand's pictures taken as a map item's picture, as it is
  if (body.action === "use_brand") {
    await takeBrandPicture(project, body.sheetId, body.assetId);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json(await withProjectClaude(project, user.email, (body as { model?: unknown }).model, () => sheetAction(project, user, body)));
});

/** Polled while something is being written or generated. */
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireFilmApiUser();
  const { id } = await params;
  await getOwnedProject(id, user.id);
  // a real person's features being written count as pictures on the way (his single images follow by themselves)
  const [job, images, likeness] = await Promise.all([latestJob(id, "sheets"), runningImageJobs(id), runningLikeness(id)]);
  return NextResponse.json(
    { status: job?.status ?? null, error: job?.status === "failed" ? job.error : null, imagesRunning: images.length + likeness.length },
    { headers: { "Cache-Control": "no-store" } },
  );
});
