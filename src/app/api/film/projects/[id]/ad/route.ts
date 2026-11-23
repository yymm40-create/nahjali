import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { robotTurn } from "@/lib/claude-run";
import { getOwnedProject, requireFilmApiUser } from "@/lib/film/access";
import { imitateReference } from "@/lib/film/intake";
import { adPlanOf, dropAdReferenceVideo, keepAdReferenceVideo, makeAd } from "@/lib/film/ad-brand";
import { UserError } from "@/lib/api";
import { storyLink, storyUpload } from "@/lib/film/story-link";

export const maxDuration = 300;

/**
 * «📣 خلّه إعلان»: a project made before becomes an ad (config/film-ad.ts). With a reference ad (`story`: a YouTube link
 * or the person's uploaded video, as the new project page writes it; `youtube.sheetId`: the link's frames the page laid
 * out), سجاد looks at it and hears it first and writes its style for the director to follow.
 */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireFilmApiUser();
  const { id } = await params;
  const project = await getOwnedProject(id, user.id, "screenwriter");
  const body = (await req.json().catch(() => ({}))) as { story?: unknown; youtube?: { sheetId?: unknown } | null; model?: unknown; videoFileId?: unknown; removeVideo?: unknown };
  // «📼 فيديو المرجع مع التوليد»: the reference ad's own clip (≤ 15 s), kept for the generations — any step of an ad
  if (body.videoFileId !== undefined || body.removeVideo) {
    if (!adPlanOf(project)) throw new UserError("حوّل المشروع لإعلان أول.", 409);
    if (body.removeVideo) {
      await dropAdReferenceVideo(project.id);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json(await keepAdReferenceVideo(project, user.id, body.videoFileId));
  }
  const story = typeof body.story === "string" ? body.story.trim().slice(0, 4000) : "";
  const link = storyLink(story);
  const upload = link ? null : storyUpload(story);
  if (!link && !upload) {
    const plan = await makeAd(project, {});
    return NextResponse.json({ ad: plan, coins: 0 });
  }
  const read = await robotTurn(user, body.model, "سجاد يقرا الإعلان المرجعي", () => imitateReference(user.id, story, body.youtube), undefined, { memory: "isolated" });
  const reference = link ? `رابط يوتيوب: ${link.url}` : `فيديو من جهازه: «${upload?.video?.name ?? ""}»`;
  const sheetId = link ? body.youtube?.sheetId : upload?.video?.sheetId;
  const plan = await makeAd(project, { imitate: read.imitate, reference, frames: { userId: user.id, sheetId } });
  return NextResponse.json({ ad: plan, coins: read.coins });
});
