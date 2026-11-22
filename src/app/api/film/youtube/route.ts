import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requireFilmApiUser } from "@/lib/film/access";
import { isYoutubeLink } from "@/lib/film/story-link";
import { startYoutube, youtubeEnabled, youtubeState } from "@/lib/content/youtube";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * «صانع الأفلام» · the story given as a YouTube link («🔗 رابط يوتيوب», lib/film/story-link): the video is downloaded
 * the same way «صانع المحتوى» does it (lib/content/youtube: Apify, paid by the site, a day's limit per person), so the
 * new-film page can take its frames for «سجاد» to look at. POST starts, GET follows.
 */
export const POST = handle(async (req: Request) => {
  const user = await requireFilmApiUser();
  if (!youtubeEnabled()) return NextResponse.json({ enabled: false });
  const b = (await req.json().catch(() => ({}))) as { url?: unknown };
  const url = String(b.url ?? "").trim();
  if (!url || url.length > 500 || !isYoutubeLink(url)) throw new UserError("هذا مو رابط فيديو يوتيوب.", 400);
  return NextResponse.json({ enabled: true, ...(await startYoutube(user.id, url)) });
});

export const GET = handle(async (req: Request) => {
  const user = await requireFilmApiUser();
  const key = new URL(req.url).searchParams.get("key") ?? "";
  if (!/^yt:[\w-]{6,20}$/.test(key)) throw new UserError("تنزيل غير معروف.", 400);
  return NextResponse.json(await youtubeState(user.id, key));
});
