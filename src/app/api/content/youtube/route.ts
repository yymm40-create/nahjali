import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requireContentUser } from "@/lib/content/access";
import { startYoutube, youtubeEnabled, youtubeState } from "@/lib/content/youtube";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** «صانع المحتوى» · a YouTube link downloaded for «محمد باقر» (lib/content/youtube): POST starts, GET follows. */
export const POST = handle(async (req: Request) => {
  const { user } = await requireContentUser();
  if (!youtubeEnabled()) return NextResponse.json({ enabled: false });
  const b = (await req.json().catch(() => ({}))) as { url?: unknown };
  const url = String(b.url ?? "").trim();
  if (!url || url.length > 500) throw new UserError("الرابط غير صحيح.", 400);
  return NextResponse.json({ enabled: true, ...(await startYoutube(user.id, url)) });
});

export const GET = handle(async (req: Request) => {
  const { user } = await requireContentUser();
  const key = new URL(req.url).searchParams.get("key") ?? "";
  if (!/^yt:[\w-]{6,20}$/.test(key)) throw new UserError("تنزيل غير معروف.", 400);
  return NextResponse.json(await youtubeState(user.id, key));
});
