import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { CARTOON_PICTURE_USD, cartoonPictures, makeCartoonPicture, makePlaceSheet, placeSheets } from "@/lib/jawad/server/cartoon-pictures";
import { isAdmin } from "@config/site";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** The pictures of the cartoon section's looks (by id; a look missing here shows its coloured tile) and the places' environment sheets (by «place--look»). */
export const GET = handle(async () => {
  await requireApiUser();
  return NextResponse.json({ pictures: await cartoonPictures(), places: await placeSheets(), usd: Math.round(CARTOON_PICTURE_USD * 1000) / 1000 }, { headers: { "Cache-Control": "private, max-age=60" } });
});

/** The owner draws one look's picture, or one place's environment sheet in a look (the page in /admin/film calls them one by one). Never by itself. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  if (!isAdmin(user.email)) throw new UserError("غير مسموح.", 404);
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (b.action === "place") return NextResponse.json(await makePlaceSheet(String(b.place ?? ""), String(b.id ?? "")));
  if (b.action !== "draw") throw new UserError("طلب غير معروف.", 400);
  return NextResponse.json(await makeCartoonPicture(String(b.id ?? "")));
});
