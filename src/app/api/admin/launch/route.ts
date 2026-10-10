import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { forgetAccess } from "@/lib/access";
import { isPublicOpen, setPublicOpen } from "@/lib/launch";
import { setVisibility as gamesVisibility } from "@/lib/games/access";
import { setVisibility as contentVisibility } from "@/lib/content/access";
import { setVisibility as designerVisibility } from "@/lib/designer/access";
import { setVisibility as photoVisibility } from "@/lib/photo/access";
import { isAdmin } from "@config/site";

export const dynamic = "force-dynamic";

async function owner() {
  const user = await requireApiUser();
  if (!isAdmin(user.email)) throw new UserError("غير مسموح.", 404);
  return user;
}

export const GET = handle(async () => {
  await owner();
  return NextResponse.json({ open: await isPublicOpen() });
});

/** { open: true | false } — opening also opens the four sections that have their own switch («لكل الناس»). */
export const POST = handle(async (req: Request) => {
  const user = await owner();
  const b = (await req.json().catch(() => ({}))) as { open?: unknown };
  if (typeof b.open !== "boolean") throw new UserError("طلب غير صحيح.", 400);
  await setPublicOpen(b.open, user.email ?? user.id);
  if (b.open) await Promise.all([gamesVisibility("all"), contentVisibility("all"), designerVisibility("all"), photoVisibility("all")]);
  forgetAccess();
  return NextResponse.json({ open: b.open });
});
