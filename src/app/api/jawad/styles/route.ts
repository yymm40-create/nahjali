import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { makeStylePicture, STYLE_PICTURE_USD, stylePicturesSafe } from "@/lib/film/style-pictures";
import { isAdmin } from "@config/site";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** «الستايل»: the pictures of the library's styles (by id; a style missing here shows its family's tile). */
export const GET = handle(async () => {
  await requireApiUser();
  return NextResponse.json({ pictures: await stylePicturesSafe(), usd: Math.round(STYLE_PICTURE_USD * 1000) / 1000 }, { headers: { "Cache-Control": "private, max-age=60" } });
});

/** The owner draws one style's picture (the page in /admin/film calls it style by style). */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  if (!isAdmin(user.email)) throw new UserError("غير مسموح.", 404);
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (b.action !== "draw") throw new UserError("طلب غير معروف.", 400);
  return NextResponse.json(await makeStylePicture(String(b.id ?? "")));
});
