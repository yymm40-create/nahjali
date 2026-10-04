import { NextResponse } from "next/server";
import { t } from "@/lib/mahdi/i18n";
import { mahdiRoute, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { enhanceCover, enhancePrice } from "@/lib/mahdi/server/cover-enhance";

export const runtime = "nodejs";
// GPT Image 2 takes up to a minute or two
export const maxDuration = 300;

/** What «حسّن الصورة» costs me now, in coins (0 = free for me). */
export const GET = mahdiRoute(async (req: Request) => {
  const { user } = await requireProfile(req);
  return NextResponse.json({ coins: await enhancePrice(user) });
});

/** Enhances a photo of a book cover (form data: `photo`). Returns the new image as a data URL, and the coins taken. */
export const POST = mahdiRoute(async (req: Request) => {
  const { user } = await requireProfile(req);
  const form = await req.formData().catch(() => null);
  if (!form) throw new UserError(t.errors.invalid, 400);
  return NextResponse.json(await enhanceCover(user, form.get("photo")));
});
